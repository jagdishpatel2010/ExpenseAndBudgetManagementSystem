/**
 * API service functions grouped by domain.
 *
 * Each function is a thin wrapper over `apiRequest` that documents the endpoint
 * it calls and the shape of data it returns. Screens import these rather than
 * calling `apiRequest` directly, keeping endpoint paths in one place.
 */
import { apiRequest } from './client';

// ---------- Auth ----------
export const AuthApi = {
  /** POST /api/auth/login -> { token, user } */
  login: (email, password) =>
    apiRequest('/api/auth/login', { method: 'POST', body: { email, password } }),
  /** POST /api/auth/register -> { token, user } */
  register: (name, email, password) =>
    apiRequest('/api/auth/register', {
      method: 'POST',
      body: { name, email, password },
    }),
  /** GET /api/auth/me -> { user } */
  me: () => apiRequest('/api/auth/me'),
};

// ---------- Profile ----------
export const ProfileApi = {
  get: () => apiRequest('/api/profile'),
  update: (payload) => apiRequest('/api/profile', { method: 'PUT', body: payload }),
  changePassword: (currentPassword, newPassword) =>
    apiRequest('/api/profile/password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};

// ---------- Transactions ----------
export const TransactionApi = {
  /**
   * GET /api/transactions with optional filters.
   * @param {object} [filters] - { type, categoryId, from, to, q, page, limit }
   */
  list: (filters = {}) => {
    const qs = new URLSearchParams(
      Object.entries(filters).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    return apiRequest(`/api/transactions${qs ? `?${qs}` : ''}`);
  },
  get: (id) => apiRequest(`/api/transactions/${id}`),
  create: (payload) =>
    apiRequest('/api/transactions', { method: 'POST', body: payload }),
  update: (id, payload) =>
    apiRequest(`/api/transactions/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiRequest(`/api/transactions/${id}`, { method: 'DELETE' }),
};

// ---------- Categories ----------
export const CategoryApi = {
  list: (type) => apiRequest(`/api/categories${type ? `?type=${type}` : ''}`),
  create: (payload) =>
    apiRequest('/api/categories', { method: 'POST', body: payload }),
  update: (id, payload) =>
    apiRequest(`/api/categories/${id}`, { method: 'PUT', body: payload }),
  remove: (id) => apiRequest(`/api/categories/${id}`, { method: 'DELETE' }),
};

// ---------- Budgets ----------
export const BudgetApi = {
  list: (month) => apiRequest(`/api/budgets${month ? `?month=${month}` : ''}`),
  set: (payload) => apiRequest('/api/budgets', { method: 'POST', body: payload }),
  remove: (id) => apiRequest(`/api/budgets/${id}`, { method: 'DELETE' }),
};

// ---------- Summary / Charts / Reports ----------
export const InsightsApi = {
  summary: () => apiRequest('/api/summary'),
  charts: (month) => apiRequest(`/api/charts${month ? `?month=${month}` : ''}`),
  monthlyReport: (month) =>
    apiRequest(`/api/reports/monthly${month ? `?month=${month}` : ''}`),
};

// ---------- Notifications ----------
export const NotificationApi = {
  list: () => apiRequest('/api/notifications'),
  markAllRead: () => apiRequest('/api/notifications', { method: 'POST' }),
  markRead: (id) => apiRequest(`/api/notifications/${id}`, { method: 'POST' }),
  remove: (id) => apiRequest(`/api/notifications/${id}`, { method: 'DELETE' }),
};

// ---------- Admin ----------
export const AdminApi = {
  stats: () => apiRequest('/api/admin/stats'),
  activity: (limit = 50) => apiRequest(`/api/admin/activity?limit=${limit}`),
  categories: () => apiRequest('/api/admin/categories'),
  createCategory: (payload) =>
    apiRequest('/api/admin/categories', { method: 'POST', body: payload }),
  support: () => apiRequest('/api/admin/support'),
  resolveSupport: (id) =>
    apiRequest(`/api/admin/support?id=${id}`, { method: 'POST' }),
  /** GET /api/admin/users -> { users } (account metadata only, no finances) */
  users: () => apiRequest('/api/admin/users'),
  /** POST /api/admin/users -> { user }; payload = { name, email, password, role } */
  createUser: (payload) =>
    apiRequest('/api/admin/users', { method: 'POST', body: payload }),
};
