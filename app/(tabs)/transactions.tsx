import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Modal,
  Animated,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { X, Search } from 'lucide-react-native';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const CATEGORY_FILTERS = ['All', 'Food', 'Shopping', 'Transport', 'Bills', 'Entertainment', 'Others'];
const CATEGORY_COLUMNS = ['all', 'food', 'shopping', 'transport', 'bills', 'entertainment', 'others'];

const CATEGORY_COLORS: Record<string, string> = {
  food: '#F97316',
  shopping: '#EC4899',
  transport: '#3B82F6',
  bills: '#6B7280',
  entertainment: '#7C3AED',
  subscriptions: '#8B5CF6',
  recharge: '#10B981',
  travel: '#F59E0B',
  transfers: '#6366F1',
  others: '#0F6E56',
};

type Transaction = {
  id: string;
  amount: number;
  type: 'debit' | 'credit';
  merchant_raw: string | null;
  merchant_normalized: string | null;
  category: string;
  transacted_at: string;
  upi_ref_id: string | null;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTimeIST(dateString: string): string {
  const date = new Date(dateString);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  return istDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateIST(dateString: string): string {
  const date = new Date(dateString);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffset);
  return istDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getDateGroup(dateString: string): { label: string; date: Date } {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

  if (date >= today) return { label: 'Today', date };
  if (date >= yesterday) return { label: 'Yesterday', date };
  return { label: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }), date };
}

function SkeletonRow() {
  return (
    <View style={styles.txRow}>
      <View style={[styles.txIcon, { backgroundColor: Colors.neutral200 }]} />
      <View style={styles.txBody}>
        <View style={{ width: 120, height: 14, backgroundColor: Colors.neutral200, borderRadius: Radius.sm }} />
        <View style={{ width: 60, height: 11, backgroundColor: Colors.neutral200, borderRadius: Radius.sm, marginTop: 6 }} />
      </View>
      <View style={{ width: 70, height: 16, backgroundColor: Colors.neutral200, borderRadius: Radius.sm }} />
    </View>
  );
}

export default function TransactionsScreen() {
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState(0);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const PAGE_SIZE = 20;

  const fetchTransactions = useCallback(async (reset = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const currentPage = reset ? 0 : page;
      let query = supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('transacted_at', { ascending: false });

      if (searchQuery) {
        query = query.ilike('merchant_normalized', `%${searchQuery}%`);
      }

      if (activeFilter > 0) {
        const category = CATEGORY_COLUMNS[activeFilter];
        query = query.eq('category', category);
      }

      const { from, to } = [(currentPage) * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1];
      query = query.range(from, to);

      const { data, error } = await query;

      if (!error && data) {
        if (reset) {
          setTransactions(data as Transaction[]);
          setPage(0);
        } else {
          setTransactions((prev) => [...prev, ...(data as Transaction[])]);
        }
        setHasMore(data.length === PAGE_SIZE);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [searchQuery, activeFilter, page]);

  useEffect(() => {
    setLoading(true);
    fetchTransactions(true);
  }, [searchQuery, activeFilter]);

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      fetchTransactions(true);
    }, 300);
  };

  const handleFilterChange = (index: number) => {
    setActiveFilter(index);
    setLoading(true);
    setPage(0);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      setLoadingMore(true);
      setPage((prev) => prev + 1);
      fetchTransactions(false);
    }
  };

  const handleTxPress = (tx: Transaction) => {
    setSelectedTx(tx);
    setModalVisible(true);
  };

  const groupedTransactions = transactions.reduce((groups, tx) => {
    const group = getDateGroup(tx.transacted_at);
    const key = group.label;
    if (!groups[key]) groups[key] = [];
    groups[key].push(tx);
    return groups;
  }, {} as Record<string, Transaction[]>);

  const dateOrder = Array.from(new Set(transactions.map((tx) => getDateGroup(tx.transacted_at).label)));

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Transactions</Text>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search color={Colors.textTertiary} size={18} strokeWidth={2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search merchants..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterContent}
        >
          {CATEGORY_FILTERS.map((tab, i) => (
            <TouchableOpacity
              key={tab}
              style={[styles.filterChip, i === activeFilter && styles.filterChipActive]}
              onPress={() => handleFilterChange(i)}
              activeOpacity={0.8}
            >
              <Text style={[styles.filterChipText, i === activeFilter && styles.filterChipTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {loading ? (
            [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyText}>
                Your UPI payments will appear here automatically
              </Text>
            </View>
          ) : (
            <>
              {dateOrder.map((dateLabel) => (
                <View key={dateLabel}>
                  <Text style={styles.dateHeader}>{dateLabel}</Text>
                  {groupedTransactions[dateLabel].map((tx) => {
                    const catColor = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS.others;
                    const catInitial = tx.category.charAt(0).toUpperCase();
                    const isDebit = tx.type === 'debit';

                    return (
                      <TouchableOpacity
                        key={tx.id}
                        style={styles.txRow}
                        onPress={() => handleTxPress(tx)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.txIcon, { backgroundColor: `${catColor}20` }]}>
                          <Text style={[styles.txIconText, { color: catColor }]}>{catInitial}</Text>
                        </View>
                        <View style={styles.txBody}>
                          <Text style={styles.txMerchant} numberOfLines={1}>
                            {tx.merchant_normalized || 'Unknown'}
                          </Text>
                          <Text style={styles.txMeta}>
                            {tx.category.charAt(0).toUpperCase() + tx.category.slice(1)}
                          </Text>
                        </View>
                        <View style={styles.txRight}>
                          <Text style={[styles.txAmount, isDebit ? styles.txAmountDebit : styles.txAmountCredit]}>
                            {isDebit ? '-' : '+'}{formatCurrency(tx.amount)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {hasMore && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={handleLoadMore}
                  disabled={loadingMore}
                  activeOpacity={0.7}
                >
                  {loadingMore ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : (
                    <Text style={styles.loadMoreText}>Load more transactions</Text>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </ScrollView>
      </View>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Transaction Details</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <X color={Colors.text} size={24} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {selectedTx && (
              <>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Merchant (raw)</Text>
                  <Text style={styles.modalValue}>{selectedTx.merchant_raw || '—'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Merchant</Text>
                  <Text style={styles.modalValue}>{selectedTx.merchant_normalized || 'Unknown'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Category</Text>
                  <Text style={styles.modalValue}>{selectedTx.category.charAt(0).toUpperCase() + selectedTx.category.slice(1)}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Amount</Text>
                  <Text style={styles.modalValue}>{formatCurrency(selectedTx.amount)}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Date & Time</Text>
                  <Text style={styles.modalValue}>{formatDateIST(selectedTx.transacted_at)} IST</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Type</Text>
                  <View style={[styles.typeBadge, selectedTx.type === 'debit' ? styles.typeBadgeDebit : styles.typeBadgeCredit]}>
                    <Text style={[styles.typeBadgeText, selectedTx.type === 'debit' ? styles.typeBadgeDebitText : styles.typeBadgeCreditText]}>
                      {selectedTx.type.charAt(0).toUpperCase() + selectedTx.type.slice(1)}
                    </Text>
                  </View>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>UPI Ref</Text>
                  <Text style={styles.modalValue}>{selectedTx.upi_ref_id || '—'}</Text>
                </View>
                <View style={styles.modalRow}>
                  <Text style={styles.modalLabel}>Source</Text>
                  <Text style={styles.modalValue}>Notification</Text>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    color: Colors.text,
    fontWeight: Typography.weights.bold,
  },
  searchRow: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.text,
  },
  filterScroll: {
    marginBottom: Spacing.md,
  },
  filterContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  filterChipTextActive: {
    color: Colors.textInverse,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  dateHeader: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  txIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txIconText: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
  },
  txBody: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  txMerchant: {
    fontSize: Typography.sizes.base,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
  },
  txMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
  },
  txAmountDebit: {
    color: '#DC2626',
  },
  txAmountCredit: {
    color: Colors.primary,
  },
  loadMoreBtn: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.md,
  },
  loadMoreText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.semibold,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 21,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.sizes.lg,
    color: Colors.text,
    fontWeight: Typography.weights.bold,
  },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalLabel: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
  },
  modalValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    fontWeight: Typography.weights.medium,
    flex: 1,
    textAlign: 'right',
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  typeBadgeDebit: {
    backgroundColor: '#FEE2E2',
  },
  typeBadgeCredit: {
    backgroundColor: Colors.primaryMuted,
  },
  typeBadgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  typeBadgeDebitText: {
    color: '#DC2626',
  },
  typeBadgeCreditText: {
    color: Colors.primary,
  },
});
