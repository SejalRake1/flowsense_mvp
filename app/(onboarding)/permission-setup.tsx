import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';
import { Shield, Lock, CreditCard, CheckCircle } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSION_POINTS = [
  {
    icon: Shield,
    title: 'Payment notifications only',
    description: 'We only read alerts from payment apps'
  },
  {
    icon: Lock,
    title: 'Data stays encrypted',
    description: 'Your information never leaves unencrypted'
  },
  {
    icon: CreditCard,
    title: 'No bank passwords',
    description: 'We never ask for account access'
  },
];

export default function PermissionSetupScreen() {
  const [loading, setLoading] = useState(false);

  const openNotificationSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      } else {
        await Linking.openSettings();
      }
    } catch {
      // Fallback to app settings
      await Linking.openSettings();
    }
  };

  const handleProceed = async () => {
    setLoading(true);

    try {
      await AsyncStorage.setItem('flowsense_permission_granted', 'true');

      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const phone = user.phone || '';
        const { error: upsertError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            phone,
            onboarding_completed: true,
            notification_enabled: true
          }, { onConflict: 'id' });

        if (upsertError) {
          console.error('Failed to update user:', upsertError);
        }

        router.replace('/(onboarding)/ready');
      }
    } catch (err) {
      console.error('Error during proceeding:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>One permission.</Text>
        <Text style={styles.subtitle}>Full automation.</Text>
      </View>

      <View style={styles.pointsContainer}>
        {PERMISSION_POINTS.map((point, index) => (
          <View key={index} style={styles.point}>
            <View style={styles.pointIconContainer}>
              <point.icon color={Colors.primary} size={20} strokeWidth={2} />
            </View>
            <View style={styles.pointContent}>
              <Text style={styles.pointTitle}>{point.title}</Text>
              <Text style={styles.pointDescription}>{point.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={styles.enableBtn}
        onPress={openNotificationSettings}
        activeOpacity={0.8}
      >
        <Text style={styles.enableBtnText}>Enable Notification Access</Text>
      </TouchableOpacity>

      <Text style={styles.hint}>
        Come back after enabling FlowSense in the list
      </Text>

      <TouchableOpacity
        style={[styles.proceedBtn, loading && styles.buttonDisabled]}
        onPress={handleProceed}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.proceedBtnText}>
          {loading ? 'Setting up...' : "I've enabled it →"}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxxl + Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xxl + Spacing.md,
  },
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
    color: Colors.primary,
  },
  pointsContainer: {
    marginBottom: Spacing.xxl + Spacing.lg,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  pointIconContainer: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointContent: {
    flex: 1,
    paddingTop: 4,
  },
  pointTitle: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.text,
    marginBottom: 3,
  },
  pointDescription: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    lineHeight: 20,
  },
  enableBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: Radius.full,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  enableBtnText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.textInverse,
  },
  hint: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  proceedBtn: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  buttonDisabled: {
    backgroundColor: Colors.neutral100,
    borderColor: Colors.neutral300,
  },
  proceedBtnText: {
    fontSize: Typography.sizes.base,
    fontWeight: Typography.weights.semibold,
    color: Colors.primary,
  },
});
