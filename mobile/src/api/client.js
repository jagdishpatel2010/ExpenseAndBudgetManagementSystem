/**
 * Thin REST API client wrapping fetch.
 *
 * Responsibilities:
 * - Prefix every request with the configured API base URL.
 * - Attach the stored JWT as a Bearer token when present.
 * - Parse the standard { success, data, error } envelope and throw an Error
 *   with a user-safe message on failure so screens can catch and display it.
 * - Persist/clear the token in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

const TOKEN_KEY = 'auth.token';

let inMemoryToken = null;

/** Load the token from storage into memory (called once at startup). */
export async function loadToken() {
  inMemoryToken = await AsyncStorage.getItem(TOKEN_KEY);
  return inMemoryToken;
}

/** Persist the auth token (or clear it when null). */
export async function setToken(token) {
  inMemoryToken = token;
  if (token) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  } else {
    await AsyncStorage.removeItem(TOKEN_KEY);
  }
}

/** @returns {string|null} The current in-memory token. */
export function getToken() {
  return inMemoryToken;
}

/**
 * Perform an API request.
 *
 * @param {string} path - Path beginning with '/', e.g. '/api/summary'.
 * @param {object} [options]
 * @param {string} [options.method='GET'] - HTTP method.
 * @param {object} [options.body] - JSON-serializable request body.
 * @returns {Promise<any>} The `data` field from the response envelope.
 * @throws {Error} With a user-safe message (and optional `.details`) on failure.
 */
export async function apiRequest(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    // Network-level failure (server down, wrong host, no connectivity).
    throw new Error(
      'Cannot reach the server. Check your connection and the API URL.'
    );
  }

  // Some endpoints (CSV export) may return non-JSON; guard the parse.
  let payload = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok || (payload && payload.success === false)) {
    const message =
      (payload && payload.error) || `Request failed (${response.status})`;
    const err = new Error(message);
    if (payload && payload.details) {
      err.details = payload.details;
    }
    throw err;
  }

  return payload ? payload.data : null;
}

export { API_BASE_URL };
