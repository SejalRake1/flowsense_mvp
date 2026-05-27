import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Bell, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react-native';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const { width } = Dimensions.get('window');

const CATEGORIES = [
  { id: 'food', name: 'Food', icon: '🍔', color: '#FF6B6B' },
  { id: 'shopping', name: 'Shopping', icon: '🛍️', color: '#4ECDC4' },
  { id: 'transport', name: 'Transport', icon: '🚗', color: '#45B7D1' },
  { id: 'bills', name: 'Bills', icon: '📄', color: '#96CEB4' },
  { id: 'entertainment', name: 'Entertainment', icon: '🎬', color: '#FFEAA7' },
  { id: 'recharge', name: 'Recharge', icon: '📱', color: '#DDA0DD' },
  { id: 'travel', name: 'Travel', icon: '✈️', color: '#98D8C8' },
  { id: 'transfers', name: 'Transfers', icon: '💸', color: '#F7DC6F' },
  { id: 'subscriptions', name: 'Subscriptions', icon: '🔁', color: '#BB8FCE' },
  { id: 'others', name: 'Others', icon: '📦', color: '#85C1E9' },
];

type Transaction = {
  id: string;
  amount: number;
  type: 'debit' | 'credit';
  merchant_normalized: string | null;
  category: string;
  transacted_at: string;
};

type Insight = {
  id: string;
  title: string;
  body: string;
};

type UserData = {
  name: string | null;
};

type MonthlyStats = {
  total: number;
  count: number;
  lastMonthTotal: number;
  changePercent: number;
  changeDirection: 'up' | 'down' | 'same';
};

type CategorySpending = {
  category: string;
  amount: number;
  percent: number;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function Skeleton({ width: w, height: h, style }: { width: number; height: number; style?: any }) {
  return <View style={[{ width: w, height: h, backgroundColor: Colors.neutral200, borderRadius: Radius.sm }, style]} />;
}

function CategorySkeleton() {
  return (
    <View style={styles.categoryTile}>
      <Skeleton width={32} height={32} style={{ borderRadius: Radius.md, marginBottom: Spacing.sm }} />
      <Skeleton width={50} height={12} style={{ marginBottom: 4 }} />
      <Skeleton width={40} height={16} />
    </View>
  );
}

function TransactionSkeleton() {
  return (
    <View style={styles.transactionRow}>
      <Skeleton width={44} height={44} style={{ borderRadius: Radius.md }} />
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <Skeleton width={120} height={14} style={{ marginBottom: 6 }} />
        <Skeleton width={80} height={12} />
      </View>
      <Skeleton width={60} height={18} />
    </View>
  );
}

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<UserData>({ name: null });
  const [stats, setStats] = useState<MonthlyStats>({
    total: 0,
    count: 0,
    lastMonthTotal: 0,
    changePercent: 0,
    changeDirection: 'same',
  });
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

      const [userResult, currentMonthTx, lastMonthTx, recentTx, insightsResult] = await Promise.all([
        supabase.from('users').select('name').eq('id', authUser.id).maybeSingle(),
        supabase
          .from('transactions')
          .select('amount, category')
          .eq('user_id', authUser.id)
          .eq('type', 'debit')
          .gte('transacted_at', currentMonthStart.toISOString()),
        supabase
          .from('transactions')
          .select('amount')
          .eq('user_id', authUser.id)
          .eq('type', 'debit')
          .gte('transacted_at', lastMonthStart.toISOString())
          .lte('transacted_at', lastMonthEnd.toISOString()),
        supabase
          .from('transactions')
          .select('id, amount, type, merchant_normalized, category, transacted_at')
          .eq('user_id', authUser.id)
          .order('transacted_at', { ascending: false })
          .limit(5),
        supabase.from('insights').select('id, title, body').eq('user_id', authUser.id).eq('is_read', false).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ]);

      setUser({ name: userResult.data?.name || null });

      const total = currentMonthTx.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      const count = currentMonthTx.data?.length || 0;
      const lastMonthTotal = lastMonthTx.data?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      let changePercent = 0;
      let changeDirection: 'up' | 'down' | 'same' = 'same';
      if (lastMonthTotal > 0) {
        changePercent = Math.round(((total - lastMonthTotal) / lastMonthTotal) * 100);
        changeDirection = total > lastMonthTotal ? 'up' : total < lastMonthTotal ? 'down' : 'same';
      }

      setStats({ total, count, lastMonthTotal, changePercent, changeDirection });

      const categoryMap: Record<string, number> = {};
      currentMonthTx.data?.forEach((t) => {
        const cat = t.category || 'others';
        categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
      });

      const categoryData = CATEGORIES.map((cat) => ({
        category: cat.id,
        amount: categoryMap[cat.id] || 0,
        percent: total > 0 ? Math.round(((categoryMap[cat.id] || 0) / total) * 100) : 0,
      }));
      setCategorySpending(categoryData);
      setTransactions(recentTx.data || []);
      setInsight(insightsResult.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const firstName = user.name?.split(' ')[0] || 'there';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}, {loading ? '...' : firstName}</Text>
            <Text style={styles.date}>{formatDate()}</Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} activeOpacity={0.7}>
            <Bell color={Colors.text} size={22} strokeWidth={2} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <Text style={styles.balanceLabel}>This Month</Text>
            {!loading && stats.changeDirection !== 'same' && (
              <View style={[styles.changeBadge, stats.changeDirection === 'down' ? styles.changeDown : styles.changeUp]}>
                {stats.changeDirection === 'down' ? (
                  <TrendingDown color={Colors.success} size={14} strokeWidth={2} />
                ) : (
                  <TrendingUp color={Colors.error} size={14} strokeWidth={2} />
                )}
                <Text style={[styles.changeText, stats.changeDirection === 'down' ? styles.changeDownText : styles.changeUpText]}>
                  {stats.changePercent}%
                </Text>
              </View>
            )}
          </View>
          {loading ? (
            <Skeleton width={120} height={40} style={{ marginTop: Spacing.xs }} />
          ) : (
            <Text style={styles.balanceAmount}>{formatCurrency(stats.total)}</Text>
          )}
          <Text style={styles.balanceSubtext}>
            {loading ? '...' : `${stats.count} transaction${stats.count !== 1 ? 's' : ''}`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Categories</Text>
          {loading ? (
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((_, i) => (
                <CategorySkeleton key={i} />
              ))}
            </View>
          ) : (
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const spending = categorySpending.find((s) => s.category === cat.id);
                const amount = spending?.amount || 0;
                const percent = spending?.percent || 0;

                return (
                  <View key={cat.id} style={styles.categoryTile}>
                    <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                    <Text style={styles.categoryName}>{cat.name}</Text>
                    <Text style={styles.categoryAmount}>{formatCurrency(amount)}</Text>
                    <View style={styles.categoryBar}>
                      <View style={[styles.categoryBarFill, { width: `${percent}%`, backgroundColor: cat.color }]} />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Transactions</Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.seeAllText}>See all</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            [...Array(3)].map((_, i) => <TransactionSkeleton key={i} />)
          ) : transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🌱</Text>
              <Text style={styles.emptyTitle}>No transactions yet</Text>
              <Text style={styles.emptyText}>Your UPI transactions will appear here once synced.</Text>
            </View>
          ) : (
            transactions.map((tx) => {
              const categoryInfo = CATEGORIES.find((c) => c.id === tx.category);
              const isDebit = tx.type === 'debit';

              return (
                <TouchableOpacity key={tx.id} style={styles.transactionRow} activeOpacity={0.7}>
                  <View style={[styles.txIcon, { backgroundColor: `${categoryInfo?.color}20` }]}>
                    <Text style={styles.txEmoji}>{categoryInfo?.icon || '📦'}</Text>
                  </View>
                  <View style={styles.txBody}>
                    <Text style={styles.txMerchant} numberOfLines={1}>
                      {tx.merchant_normalized || 'Unknown'}
                    </Text>
                    <Text style={styles.txMeta}>
                      {categoryInfo?.name} • {formatTimeAgo(tx.transacted_at)}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, isDebit ? styles.txAmtDebit : styles.txAmtCredit]}>
                    {isDebit ? '-' : '+'}{formatCurrency(tx.amount)}
                  </Text>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {!loading && insight && (
          <View style={styles.insightBanner}>
            <View style={styles.insightBar} />
            <View style={styles.insightContent}>
              <Text style={styles.insightTitle}>{insight.title}</Text>
              <Text style={styles.insightBody} numberOfLines={2}>
                {insight.body}
              </Text>
            </View>
            <TouchableOpacity style={styles.insightArrow} activeOpacity={0.7}>
              <ArrowRight color={Colors.primary} size={18} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  greeting: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.3,
  },
  date: {
    fontSize: Typography.sizes.md,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  bellDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.error,
    borderWidth: 2,
    borderColor: Colors.surface,
  },
  balanceCard: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: Typography.weights.medium,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  changeDown: {
    backgroundColor: 'rgba(39, 174, 96, 0.2)',
  },
  changeUp: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
  },
  changeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
  },
  changeDownText: {
    color: Colors.success,
  },
  changeUpText: {
    color: Colors.error,
  },
  balanceAmount: {
    fontSize: Typography.sizes.xxxl,
    color: Colors.textInverse,
    fontWeight: Typography.weights.bold,
    marginTop: Spacing.sm,
  },
  balanceSubtext: {
    fontSize: Typography.sizes.sm,
    color: 'rgba(255,255,255,0.6)',
    marginTop: Spacing.xs,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.md,
  },
  seeAllText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
    marginBottom: Spacing.md,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -Spacing.xs,
  },
  categoryTile: {
    width: (width - Spacing.lg * 2 - Spacing.sm) / 2,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginHorizontal: Spacing.xs,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryEmoji: {
    fontSize: 24,
    marginBottom: Spacing.xs,
  },
  categoryName: {
    fontSize: Typography.sizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.weights.medium,
  },
  categoryAmount: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginTop: 2,
  },
  categoryBar: {
    height: 3,
    backgroundColor: Colors.neutral200,
    borderRadius: 2,
    marginTop: Spacing.sm,
    overflow: 'hidden',
  },
  categoryBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  transactionRow: {
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
  txEmoji: {
    fontSize: 20,
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
  txAmount: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.bold,
  },
  txAmtDebit: {
    color: Colors.text,
  },
  txAmtCredit: {
    color: Colors.success,
  },
  emptyState: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 20,
  },
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  insightBar: {
    width: 4,
    height: '100%',
    backgroundColor: Colors.primary,
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  insightContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  insightTitle: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
  },
  insightBody: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  insightArrow: {
    padding: Spacing.sm,
  },
});
