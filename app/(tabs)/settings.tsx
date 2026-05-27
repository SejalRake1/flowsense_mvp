import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Switch, Alert, Share, Linking } from 'react-native';
import { Colors, Spacing, Typography, Radius } from '../../constants/theme';
import { Smartphone, Bell, Shield, Settings as SettingsIcon, LogOut, ChevronRight, FileText, Trash2, Info, Share2, Download } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSION_KEY = 'flowsense_permission_granted';
const ALERT_SPIKES_KEY = 'flowsense_alert_spikes';
const ALERT_SUBS_KEY = 'flowsense_alert_subs';
const ALERT_WEEKLY_KEY = 'flowsense_alert_weekly';

type SettingsRowProps = {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggleChange?: (value: boolean) => void;
  danger?: boolean;
  children?: React.ReactNode;
};

function SettingsRow({ icon, label, value, onPress, showArrow = true, toggle, toggleValue, onToggleChange, danger, children }: SettingsRowProps) {
  return (
    <TouchableOpacity style={styles.row} activeOpacity={onPress ? 0.7 : 1} onPress={onPress}>
      <View style={[styles.rowIcon, danger && styles.rowIconDanger]}>{icon}</View>
      <Text style={[styles.rowLabel, danger && styles.rowLabelDanger]}>{label}</Text>
      <View style={styles.rowRight}>
        {children}
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
        {toggle ? (
          <Switch
            value={toggleValue}
            onValueChange={onToggleChange}
            trackColor={{ true: Colors.primary }}
          />
        ) : null}
        {showArrow && !toggle ? <ChevronRight color={Colors.neutral300} size={18} strokeWidth={2} /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const [phone, setPhone] = useState('—');
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [alertSpikes, setAlertSpikes] = useState(true);
  const [alertSubs, setAlertSubs] = useState(true);
  const [alertWeekly, setAlertWeekly] = useState(true);

  useEffect(() => {
    loadSettings();
    fetchUserPhone();
  }, []);

  const loadSettings = async () => {
    const perm = await AsyncStorage.getItem(PERMISSION_KEY);
    setPermissionGranted(perm === 'true');

    const spikes = await AsyncStorage.getItem(ALERT_SPIKES_KEY);
    setAlertSpikes(spikes !== 'false');

    const subs = await AsyncStorage.getItem(ALERT_SUBS_KEY);
    setAlertSubs(subs !== 'false');

    const weekly = await AsyncStorage.getItem(ALERT_WEEKLY_KEY);
    setAlertWeekly(weekly !== 'false');
  };

  const fetchUserPhone = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.phone) {
      const p = user.phone;
      const masked = p.substring(0, 6) + '••••' + p.substring(p.length - 4);
      setPhone(masked);
    }
  };

  const handleToggleAlert = (key: string, setter: (v: boolean) => void) => async (value: boolean) => {
    setter(value);
    await AsyncStorage.setItem(key, String(value));
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(onboarding)/phone-login');
        },
      },
    ]);
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const handleExportData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: transactions } = await supabase
        .from('transactions')
        .select('transacted_at, merchant_normalized, category, amount, type')
        .eq('user_id', user.id)
        .order('transacted_at', { ascending: false });

      if (!transactions || transactions.length === 0) {
        Alert.alert('No Data', 'You have no transactions to export.');
        return;
      }

      const headers = 'Date,Merchant,Category,Amount,Type\n';
      const rows = transactions.map((t) => {
        const date = new Date(t.transacted_at).toLocaleDateString('en-IN');
        const merchant = (t.merchant_normalized || 'Unknown').replace(/,/g, ' ');
        const category = t.category;
        const amount = t.amount;
        const type = t.type;
        return `${date},${merchant},${category},${amount},${type}`;
      }).join('\n');

      const csv = headers + rows;

      await Share.share({
        message: csv,
        title: 'FlowSense Transactions Export',
      });
    } catch (err) {
      console.error('Error exporting data:', err);
    }
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data',
      'This permanently deletes all your FlowSense data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;

              await supabase
                .from('users')
                .update({ data_deletion_requested: true })
                .eq('id', user.id);

              await supabase.auth.signOut();
              router.replace('/(onboarding)/phone-login');
            } catch (err) {
              console.error('Error deleting data:', err);
            }
          },
        },
      ]
    );
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://flowsense.app/privacy');
  };

  const handleShare = async () => {
    await Share.share({
      message: 'I use FlowSense to track my UPI spending automatically. Try it free!',
      title: 'Share FlowSense',
    });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.groupLabel}>Account</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Smartphone color={Colors.primary} size={18} strokeWidth={2} />}
            label="Phone number"
            value={phone}
            showArrow={false}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<LogOut color={Colors.error} size={18} strokeWidth={2} />}
            label="Sign out"
            danger
            showArrow={false}
            onPress={handleSignOut}
          />
        </View>

        <Text style={styles.groupLabel}>Notification Access</Text>
        <View style={styles.group}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Bell color={Colors.primary} size={18} strokeWidth={2} />
            </View>
            <Text style={styles.rowLabel}>Status</Text>
            <View style={styles.rowRight}>
              <View style={[styles.statusDot, permissionGranted ? styles.statusDotActive : styles.statusDotInactive]} />
              <Text style={[styles.statusText, permissionGranted ? styles.statusActive : styles.statusInactive]}>
                {permissionGranted ? 'Active, tracking payments' : 'Disabled, tap to fix'}
              </Text>
            </View>
          </View>
          <View style={styles.divider} />
          <SettingsRow
            icon={<SettingsIcon color={Colors.primary} size={18} strokeWidth={2} />}
            label="Open Settings"
            onPress={handleOpenSettings}
          />
        </View>

        <Text style={styles.groupLabel}>Notifications</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Bell color={Colors.warning} size={18} strokeWidth={2} />}
            label="Spending spike alerts"
            toggle
            toggleValue={alertSpikes}
            onToggleChange={handleToggleAlert(ALERT_SPIKES_KEY, setAlertSpikes)}
            showArrow={false}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Bell color={Colors.secondary} size={18} strokeWidth={2} />}
            label="Subscription reminders"
            toggle
            toggleValue={alertSubs}
            onToggleChange={handleToggleAlert(ALERT_SUBS_KEY, setAlertSubs)}
            showArrow={false}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Bell color={Colors.primary} size={18} strokeWidth={2} />}
            label="Weekly summary"
            toggle
            toggleValue={alertWeekly}
            onToggleChange={handleToggleAlert(ALERT_WEEKLY_KEY, setAlertWeekly)}
            showArrow={false}
          />
        </View>

        <Text style={styles.groupLabel}>Data & Privacy</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Download color={Colors.primary} size={18} strokeWidth={2} />}
            label="Export my data"
            value="CSV"
            onPress={handleExportData}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Trash2 color={Colors.error} size={18} strokeWidth={2} />}
            label="Delete all my data"
            danger
            showArrow={false}
            onPress={handleDeleteData}
          />
        </View>

        <Text style={styles.groupLabel}>About</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Info color={Colors.neutral500} size={18} strokeWidth={2} />}
            label="Version"
            value="1.0.0"
            showArrow={false}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Shield color={Colors.neutral500} size={18} strokeWidth={2} />}
            label="Privacy Policy"
            onPress={handlePrivacyPolicy}
          />
          <View style={styles.divider} />
          <SettingsRow
            icon={<Share2 color={Colors.neutral500} size={18} strokeWidth={2} />}
            label="Share FlowSense"
            onPress={handleShare}
          />
        </View>
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
  title: {
    fontSize: Typography.sizes.xxl,
    color: Colors.text,
    fontWeight: Typography.weights.bold,
    marginBottom: Spacing.xl,
    marginTop: Spacing.sm,
  },
  groupLabel: {
    fontSize: Typography.sizes.xs,
    color: Colors.textTertiary,
    fontWeight: Typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  group: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.sm,
    backgroundColor: Colors.neutral50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconDanger: {
    backgroundColor: Colors.errorLight,
  },
  rowLabel: {
    flex: 1,
    fontSize: Typography.sizes.base,
    color: Colors.text,
    fontWeight: Typography.weights.medium,
  },
  rowLabelDanger: {
    color: Colors.error,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  rowValue: {
    fontSize: Typography.sizes.sm,
    color: Colors.textTertiary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 58,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotActive: {
    backgroundColor: Colors.success,
  },
  statusDotInactive: {
    backgroundColor: Colors.error,
  },
  statusText: {
    fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium,
  },
  statusActive: {
    color: Colors.success,
  },
  statusInactive: {
    color: Colors.error,
  },
});
