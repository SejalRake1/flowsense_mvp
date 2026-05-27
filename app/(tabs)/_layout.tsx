import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { Home, BarChart2, CreditCard, Droplets, Settings } from 'lucide-react-native';
import { Colors } from '../../constants/theme';

function TabBarIcon({ icon: Icon, color, size }: { icon: any; color: string; size: number }) {
  return <Icon color={color} size={size} strokeWidth={2} />;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.neutral400,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 10,
          elevation: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Home} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={BarChart2} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'Transactions',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={CreditCard} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="leaks"
        options={{
          title: 'Leaks',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Droplets} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <TabBarIcon icon={Settings} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
