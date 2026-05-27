import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl } from 'react-native';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

type Subscription = {
  id: string;
  merchant_name: string;
  detected_amount: number;
  frequency: string;
  last_charged_at: string | null;
  next_expected_at: string | null;
  is_active: boolean;
};

type SpendingPattern = {
  id: string;
  title: string;
  stat: string;
  detail: string;
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDaysAgo(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays} days ago`;
}

function formatDaysUntil(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 'Soon';
  return `in ${diffDays} days`;
}

function SkeletonCard() {
  return (
    <View style={styles.subCard}>
      <View style={styles.subHeader}>
        <View style={[styles.subIcon, { backgroundColor: Colors.neutral200 }]} />
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={{ width: 120, height: 16, backgroundColor: Colors.neutral200, borderRadius: Radius.sm }} />
          <View style={{ width: 80, height: 12, backgroundColor: Colors.neutral200, borderRadius: Radius.sm, marginTop: 6 }} />
        </View>
      </View>
      <View style={styles.subInfo}>
        <View style={{ width: 100, height: 11, backgroundColor: Colors.neutral200, borderRadius: Radius.sm }} />
        <View style={{ width: 80, height: 11, backgroundColor: Colors.neutral200, borderRadius: Radius.sm }} />
      </View>
    </View>
  );
}

export default function LeaksScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [patterns, setPatterns] = useState<SpendingPattern[]>([]);
  const [savingsEstimate, setSavingsEstimate] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const [subResult, txResult] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('detected_amount', { ascending: false }),
        supabase
          .from('transactions')
          .select('amount, type, category, merchant_normalized, transacted_at')
          .eq('user_id', user.id)
          .eq('type', 'debit')
          .gte('transacted_at', monthStart.toISOString()),
      ]);

      const subs = (subResult.data || []) as Subscription[];
      setSubscriptions(subs);
      const monthlySavings = subs.reduce((sum, s) => sum + Number(s.detected_amount), 0);
      setSavingsEstimate(monthlySavings);

      const transactions = txResult.data || [];
      const calculatedPatterns: SpendingPattern[] = [];

      const weekendTx = transactions.filter((t) => {
        const d = new Date(t.transacted_at);
        const day = d.getDay();
        return day === 0 || day === 6;
      });
      const weekdayTx = transactions.filter((t) => {
        const d = new Date(t.transacted_at);
        const day = d.getDay();
        return day !== 0 && day !== 6;
      });
      const weekendTotal = weekendTx.reduce((sum, t) => sum + Number(t.amount), 0);
      const weekdayTotal = weekdayTx.reduce((sum, t) => sum + Number(t.amount), 0);
      const totalMonth = weekendTotal + weekdayTotal;
      if (totalMonth > 0) {
        const weekendPercent = Math.round((weekendTotal / totalMonth) * 100);
        calculatedPatterns.push({
          id: 'weekend',
          title: 'Weekend Spender',
          stat: `${weekendPercent}% of your spending happens on weekends`,
          detail: `${formatCurrency(weekendTotal)} on weekends vs ${formatCurrency(weekdayTotal)} on weekdays`,
        });
      }

      const lateNightTx = transactions.filter((t) => {
        const d = new Date(t.transacted_at);
        const h = d.getHours();
        return h >= 22 || h <= 2;
      });
      const lateNightTotal = lateNightTx.reduce((sum, t) => sum + Number(t.amount), 0);
      if (lateNightTx.length > 0) {
        calculatedPatterns.push({
          id: 'lateNight',
          title: 'Late Night',
          stat: `${lateNightTx.length} transaction${lateNightTx.length > 1 ? 's' : ''} worth ${formatCurrency(lateNightTotal)} after 10pm this month`,
          detail: `Most expensive: ${formatCurrency(Math.max(...lateNightTx.map((t) => Number(t.amount))))}`,
        });
      }

      const microTx = transactions.filter((t) => Number(t.amount) < 200);
      const microTotal = microTx.reduce((sum, t) => sum + Number(t.amount), 0);
      if (microTx.length > 0) {
        calculatedPatterns.push({
          id: 'micro',
          title: 'Micro Transactions',
          stat: `${microTx.length} small payment${microTx.length > 1 ? 's' : ''} under ${formatCurrency(200)} added up to ${formatCurrency(microTotal)}`,
          detail: `Average: ${formatCurrency(microTotal / microTx.length)} each`,
        });
      }

      const merchantTotals: Record<string, number> = {};
      transactions.forEach((t) => {
        const merchant = t.merchant_normalized || 'Others';
        merchantTotals[merchant] = (merchantTotals[merchant] || 0) + Number(t.amount);
      });
      const sortedMerchants = Object.entries(merchantTotals).sort((a, b) => b[1] - a[1]);
      if (sortedMerchants.length > 0) {
        const [topMerchant, topAmount] = sortedMerchants[0];
        calculatedPatterns.push({
          id: 'topMerchant',
          title: 'Top Merchant',
          stat: `${formatCurrency(topAmount)} went to ${topMerchant}`,
          detail: 'Your top spend this month',
        });
      }

      setPatterns(calculatedPatterns);
    } catch (err) {
      console.error('Error fetching leaks data:', err);
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

  const handleNotSubscription = async (id: string) => {
    try {
      await supabase
        .from('subscriptions')
        .update({ is_active: false })
        .eq('id', id);
      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error('Error updating subscription:', err);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Money Leaks</Text>
          <Text style={styles.subtitle}>Recurring charges and spending habits</Text>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Subscriptions</Text>
            {!loading && subscriptions.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{subscriptions.length}</Text>
              </View>
            )}
          </View>

          {loading ? (
            [...Array(2)].map((_, i) => <SkeletonCard key={i} />)
          ) : subscriptions.length === 0 ? (
            <View style={styles.emptySub}>
              <Text style={styles.emptySubText}>No subscriptions detected yet</Text>
            </View>
          ) : (
            subscriptions.map((sub) => (
              <View key={sub.id} style={styles.subCard}>
                <View style={styles.subHeader}>
                  <View style={styles.subIcon}>
                    <Text style={styles.subIconText}>{sub.merchant_name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.subInfoTop}>
                    <Text style={styles.subMerchant}>{sub.merchant_name}</Text>
                    <Text style={styles.subAmount}>{formatCurrency(sub.detected_amount)} · {sub.frequency}</Text>
                  </View>
                </View>
                <View style={styles.subInfo}>
                  <Text style={styles.subMeta}>Last charged: {formatDaysAgo(sub.last_charged_at)}</Text>
                  <Text style={styles.subMeta}>Next: {formatDaysUntil(sub.next_expected_at)}</Text>
                </View>
                <View style={styles.subActions}>
                  <TouchableOpacity style={styles.reminderBtn} activeOpacity={0.7}>
                    <Text style={styles.reminderBtnText}>Cancel reminder</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.notSubBtn} onPress={() => handleNotSubscription(sub.id)} activeOpacity={0.7}>
                    <Text style={styles.notSubBtnText}>Not a subscription</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Habits we noticed</Text>

          {loading ? (
            [...Array(4)].map((_, i) => <View key={i} style={styles.patternCard} />)
          ) : patterns.length === 0 ? (
            <View style={styles.emptyPattern}>
              <Text style={styles.emptyPatternText}>Add transactions to see your spending patterns</Text>
            </View>
          ) : (
            patterns.map((pattern) => (
              <View key={pattern.id} style={styles.patternCard}>
                <Text style={styles.patternTitle}>{pattern.title}</Text>
                <Text style={styles.patternStat}>{pattern.stat}</Text>
                <Text style={styles.patternDetail}>{pattern.detail}</Text>
              </View>
            ))
          )}
        </View>

        {!loading && savingsEstimate > 0 && (
          <View style={styles.savingsCard}>
            <Text style={styles.savingsText}>
              Reviewing your subscriptions could save you {formatCurrency(savingsEstimate)} per month
            </Text>
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
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    color: Colors.text,
    fontWeight: Typography.weights.bold,
  },
  subtitle: {
    fontSize: Typography.sizes.base,
    color: Colors.textTertiary,
    marginTop: 4,
    fontWeight: Typography.weights.medium,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.sizes.md,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  countBadgeText: {
    fontSize: Typography.sizes.xs,
    color: Colors.textInverse,
    fontWeight: Typography.weights.semibold,
  },
  emptySub: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptySubText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
  },
  subCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: '#7C3AED20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subIconText: {
    fontSize: 18,
    fontWeight: Typography.weights.bold,
    color: '#7C3AED',
  },
  subInfoTop: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  subMerchant: {
    fontSize: Typography.sizes.base,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
  },
  subAmount: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  subInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  subMeta: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
  },
  subActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  reminderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
    alignItems: 'center',
  },
  reminderBtnText: {
    fontSize: Typography.sizes.sm,
    color: Colors.primary,
    fontWeight: Typography.weights.medium,
  },
  notSubBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  notSubBtnText: {
    fontSize: Typography.sizes.sm,
    color: Colors.error,
    fontWeight: Typography.weights.medium,
  },
  emptyPattern: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyPatternText: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  patternCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  patternTitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginBottom: 6,
  },
  patternStat: {
    fontSize: Typography.sizes.sm,
    color: Colors.text,
    lineHeight: 20,
    fontWeight: Typography.weights.medium,
  },
  patternDetail: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  savingsCard: {
    backgroundColor: '#DCFCE7',
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#22C55E20',
  },
  savingsText: {
    fontSize: Typography.sizes.base,
    color: '#166534',
    fontWeight: Typography.weights.medium,
    textAlign: 'center',
    lineHeight: 22,
  },
});
