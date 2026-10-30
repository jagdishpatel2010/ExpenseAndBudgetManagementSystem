/**
 * App configuration.
 *
 * API_BASE_URL points at the Next.js backend. Adjust the host depending on how
 * you run the app:
 * - Web / iOS simulator:        http://localhost:4000
 * - Android emulator:           http://10.0.2.2:4000 (maps to host localhost)
 * - Physical device (Expo Go):  http://<your-computer-LAN-IP>:4000
 *
 * The value can be overridden at runtime with the EXPO_PUBLIC_API_URL env var
 * (Expo automatically exposes EXPO_PUBLIC_* variables to the client).
 */
import { Platform } from 'react-native';

/** Resolve a sensible default backend URL per platform. */
function defaultBaseUrl() {
  if (Platform.OS === 'android') {
    // Android emulator cannot reach the host via "localhost".
    return 'http://10.0.2.2:4000';
  }
  return 'http://localhost:4000';
}

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || defaultBaseUrl();

// Currency formatting locale/symbol used across the app (Indian Rupee).
export const CURRENCY = {
  locale: 'en-IN',
  code: 'INR',
  symbol: '₹',
};
