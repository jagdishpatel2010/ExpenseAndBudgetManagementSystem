/**
 * Bottom tab navigator for the main (regular user) app.
 *
 * Tabs: Home dashboard, Transaction history, Analysis charts, Notifications,
 * and Profile. Emoji glyphs are used as tab icons to avoid pulling in an icon
 * font dependency, keeping the setup lightweight.
 */
import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors } from '../theme';

import DashboardScreen from '../screens/dashboard/DashboardScreen';
import HistoryScreen from '../screens/transactions/HistoryScreen';
import AnalysisScreen from '../screens/analysis/AnalysisScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';

const Tab = createBottomTabNavigator();

// Map each route to its tab emoji icon.
const ICONS = {
  Home: '🏠',
  History: '📄',
  Analysis: '📊',
  Alerts: '🔔',
  Profile: '👤',
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // Render the per-route emoji; color dims when inactive.
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 20, color }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'Transactions' }} />
      <Tab.Screen name="Analysis" component={AnalysisScreen} options={{ title: 'Analysis' }} />
      <Tab.Screen name="Alerts" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
