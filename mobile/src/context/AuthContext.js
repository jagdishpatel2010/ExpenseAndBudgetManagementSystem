/**
 * Authentication context.
 *
 * Holds the current user and token, exposes login/register/logout, and restores
 * the session from storage on startup. Screens consume this via `useAuth()`.
 *
 * Note on token storage: for this demo the JWT is kept in AsyncStorage so it
 * also works on web. For a production app on device, expo-secure-store is the
 * more secure choice for at-rest token storage.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { loadToken, setToken } from '../api/client';
import { AuthApi } from '../api/services';

const AuthContext = createContext(null);

/**
 * Provider that wraps the app and supplies auth state + actions.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - App tree.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  // `bootstrapping` guards the initial token-restore so we don't flash the
  // login screen before we know whether a valid session exists.
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    // Restore any stored token and validate it against /auth/me on launch.
    (async () => {
      try {
        const token = await loadToken();
        if (token) {
          const data = await AuthApi.me();
          setUser(data.user);
        }
      } catch {
        // Invalid/expired token - clear it and start logged out.
        await setToken(null);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const data = await AuthApi.login(email, password);
    await setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (name, email, password) => {
    const data = await AuthApi.register(name, email, password);
    await setToken(data.token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await setToken(null);
    setUser(null);
  }, []);

  // Allow screens to patch the cached user (e.g. after a profile update).
  const updateUser = useCallback((partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  }, []);

  const value = useMemo(
    () => ({ user, bootstrapping, login, register, logout, updateUser }),
    [user, bootstrapping, login, register, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the auth context.
 * @returns {{ user: object|null, bootstrapping: boolean,
 *   login: Function, register: Function, logout: Function, updateUser: Function }}
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
