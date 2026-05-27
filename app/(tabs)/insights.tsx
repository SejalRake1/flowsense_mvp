import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  RefreshControl,
  Animated,
  Pressable,
} from 'react-native';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';
import { supabase } from '../../lib/supabase';

const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
  spike: { bg: '#F97316', text: '#FFFFFF' },
  pattern: { bg: '#0F6E56', text: '#FFFFFF' },
  subscription: { bg: '#7C3AED', text: '#FFFFFF' },
  anomaly: { bg: '#DC2626', text: '#FFFFFF' },
  weekly_summary: { bg: '#6B7280', text: '#FFFFFF' },
  spending: { bg: '#0F6E56', text: '#FFFFFF' },
  saving: { bg: '#27AE60', text: '#FFFFFF' },
  warning: { bg: '#F97316', text: '#FFFFFF' },
  tip: { bg: '#0F6E56', text: '#FFFFFF' },
};

type Insight = {
  id: string;
  title: string;
  body: string;
  type: string;
  created_at: string;
  dismissed_at: string | null;
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{ width: 80, height: 20, backgroundColor: Colors.neutral200, borderRadius: Radius.full }} />
        <View style={{ width: 60, height: 12, backgroundColor: Colors.neutral200, borderRadius: Radius.sm }} />
      </View>
      <View style={{ width: '70%', height: 16, backgroundColor: Colors.neutral200, borderRadius: Radius.sm, marginTop: Spacing.md }} />
      <View style={{ width: '100%', height: 12, backgroundColor: Colors.neutral200, borderRadius: Radius.sm, marginTop: Spacing.sm }} />
      <View style={{ width: '80%', height: 12, backgroundColor: Colors.neutral200, borderRadius: Radius.sm, marginTop: 4 }} />
    </View>
  );
}

function InsightCard({ insight, onDismiss }: { insight: Insight; onDismiss: (id: string) => void }) {
  const [translateX] = useState(new Animated.Value(0));
  const [showDismiss, setShowDismiss] = useState(false);

  const badgeColors = BADGE_COLORS[insight.type] || BADGE_COLORS.pattern;
  const badgeLabel = insight.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  const handleSwipe = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const handleSwipeEnd = (event: any) => {
    if (event.nativeEvent.translationX < -80) {
      setShowDismiss(true);
    } else {
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
      }).start();
    }
  };

  const handleDismiss = () => {
    Animated.timing(translateX, {
      toValue: -400,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss(insight.id);
    });
  };

  return (
    <View style={styles.cardWrapper}>
      {showDismiss && (
        <Pressable style={styles.dismissBtn} onPress={handleDismiss}>
          <Text style={styles.dismissBtnText}>Dismiss</Text>
        </Pressable>
      )}
      <Animated.View
        style={[
          styles.card,
          { transform: [{ translateX }] }
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors.text }]}>{badgeLabel}</Text>
          </View>
          <Text style={styles.cardDate}>{formatDate(insight.created_at)}</Text>
        </View>
        <Text style={styles.cardTitle}>{insight.title}</Text>
        <Text style={styles.cardBody} numberOfLines={3}>{insight.body}</Text>
      </Animated.View>
    </View>
  );
}

export default function InsightsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [insights, setInsights] = useState<Insight[]>([]);

  const fetchInsights = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('insights')
        .select('*')
        .eq('user_id', user.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setInsights(data as Insight[]);
      }
    } catch (err) {
      console.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchInsights();
  }, [fetchInsights]);

  const handleDismiss = async (id: string) => {
    try {
      await supabase
        .from('insights')
        .update({ dismissed_at: new Date().toISOString() })
        .eq('id', id);
      setInsights((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error('Error dismissing insight:', err);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const response = await fetch(
        'https://cywntdkggaugujrvklaf.supabase.co/functions/v1/generate-insights',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN5d250ZGtnZ2F1Z3VqcnZrbGFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NTUwMDMsImV4cCI6MjA5NTQzMTAwM30.IaK3j57JAKRrwg52A-Pzn8sdwb21IylTIoNzC2vEXdk`,
          },
          body: JSON.stringify({ user_id: user.id }),
        }
      );

      if (response.ok) {
        fetchInsights();
      } else {
        console.error('Failed to generate insights');
      }
    } catch (err) {
      console.error('Error generating insights:', err);
    } finally {
      setGenerating(false);
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
          <Text style={styles.title}>Your Money Story</Text>
          <Text style={styles.subtitle}>Insights based on your spending</Text>
        </View>

        {loading ? (
          [...Array(3)].map((_, i) => <SkeletonCard key={i} />)
        ) : insights.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyCircle}>
              <Text style={styles.emptyIcon}>✦</Text>
            </View>
            <Text style={styles.emptyTitle}>No insights yet</Text>
            <Text style={styles.emptyText}>
              Make a few UPI payments and we'll start spotting patterns
            </Text>
          </View>
        ) : (
          insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} onDismiss={handleDismiss} />
          ))
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
        onPress={handleGenerate}
        disabled={generating}
        activeOpacity={0.8}
      >
        <Text style={styles.generateBtnText}>
          {generating ? 'Generating...' : 'Generate Insights ✦'}
        </Text>
      </TouchableOpacity>
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
    paddingBottom: 100,
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
  cardWrapper: {
    marginBottom: Spacing.md,
    position: 'relative',
  },
  dismissBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: Colors.error,
    borderRadius: Radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissBtnText: {
    color: Colors.textInverse,
    fontWeight: Typography.weights.semibold,
    fontSize: Typography.sizes.sm,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.full,
  },
  badgeText: {
    fontSize: Typography.sizes.xs,
    fontWeight: Typography.weights.semibold,
    textTransform: 'capitalize',
  },
  cardDate: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
  },
  cardTitle: {
    fontSize: Typography.sizes.base,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginTop: Spacing.md,
  },
  cardBody: {
    fontSize: Typography.sizes.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  emptyIcon: {
    fontSize: 32,
    color: Colors.primary,
  },
  emptyTitle: {
    fontSize: Typography.sizes.lg,
    color: Colors.text,
    fontWeight: Typography.weights.semibold,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: Typography.sizes.base,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  generateBtn: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    right: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateBtnDisabled: {
    backgroundColor: Colors.neutral400,
  },
  generateBtnText: {
    fontSize: Typography.sizes.base,
    color: Colors.textInverse,
    fontWeight: Typography.weights.semibold,
  },
});
