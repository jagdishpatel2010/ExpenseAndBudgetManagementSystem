/**
 * Root navigator.
 *
 * Chooses which navigation tree to show based on auth state:
 * - while bootstrapping (restoring a stored session): a loading screen
 * - logged out: the auth stack (Login / Register)
 * - logged in as a regular user: the main tabbed app
 * - logged in as an admin: the admin stack
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Loading } from '../components/UI';
import { colors } from '../theme';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import MainTabs from './MainTabs';
import AddTransactionScreen from '../screens/transactions/AddTransactionScreen';
import TransactionDetailScreen from '../screens/transactions/TransactionDetailScreen';
import CategoryScreen from '../screens/categories/CategoryScreen';
import BudgetScreen from '../screens/budgets/BudgetScreen';
import ReportScreen from '../screens/reports/ReportScreen';
import ChangePasswordScreen from '../screens/profile/ChangePasswordScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';

const Stack = createNativeStackNavigator();

/** Shared header styling for stacked screens. */
const screenOptions = {
  headerStyle: { backgroundColor: colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

export default function RootNavigator() {
  const { user, bootstrapping } = useAuth();

  if (bootstrapping) {
    return <Loading label="Starting up..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          // ----- Logged-out stack -----
          <>
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
          </>
        ) : user.role === 'admin' ? (
          // ----- Admin stack -----
          <Stack.Screen
            name="AdminDashboard"
            component={AdminDashboardScreen}
            options={{ title: 'Admin Console' }}
          />
        ) : (
          // ----- Regular user app -----
          <>
            <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="AddTransaction" component={AddTransactionScreen} options={{ title: 'Add Transaction' }} />
            <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} options={{ title: 'Transaction' }} />
            <Stack.Screen name="Categories" component={CategoryScreen} options={{ title: 'Categories' }} />
            <Stack.Screen name="Budgets" component={BudgetScreen} options={{ title: 'Monthly Budgets' }} />
            <Stack.Screen name="Report" component={ReportScreen} options={{ title: 'Monthly Report' }} />
            <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Change Password' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
