/**
 * App entry point.
 *
 * Wraps the navigation tree in the SafeArea and Auth providers. The actual
 * route selection (auth stack vs. main app) lives in RootNavigator, which
 * reacts to the authenticated user from AuthContext.
 */
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
