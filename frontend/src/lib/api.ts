import { auth } from './auth';

// Relative URL — Next.js proxies this to BACKEND_URL env var at runtime.
// This avoids baking the server IP into the JS bundle at build time.
const API_BASE = '/api/backend/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = auth.getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    auth.logout();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(error.message || 'Request failed');
  }

  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ access_token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      }),
  },
  products: {
    search: (query: string) =>
      request<any[]>(`/products?search=${encodeURIComponent(query)}`),
    getAll: (page = 1, limit = 20, search?: string) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      return request<any>(`/products?${params}`);
    },
    create: (data: any) =>
      request<any>('/products', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<any>(`/products/${id}`, { method: 'DELETE' }),
  },
  sales: {
    create: (data: any) =>
      request<any>('/sales', { method: 'POST', body: JSON.stringify(data) }),
    getAll: (page = 1, limit = 50, cashier?: string, date?: string) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (cashier) params.set('cashier', cashier);
      if (date) params.set('date', date);
      return request<any>(`/sales?${params}`);
    },
    getById: (id: string) => request<any>(`/sales/${id}`),
    getByReceipt: (receiptNumber: string) => request<any>(`/sales/receipt/${encodeURIComponent(receiptNumber)}`),
    todaySummary: () => request<any>('/sales/today'),
    voidSale: (id: string, data: { reason?: string; userId?: string; userName?: string }) =>
      request<any>(`/sales/${id}/void`, { method: 'POST', body: JSON.stringify(data) }),
    returnItems: (id: string, data: { items: { saleItemId: string; quantity: number }[]; reason?: string; userId?: string; userName?: string }) =>
      request<any>(`/sales/${id}/return`, { method: 'POST', body: JSON.stringify(data) }),
  },
  inventory: {
    getAll: (page = 1, limit = 20, search?: string) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (search) params.set('search', search);
      return request<any>(`/inventory?${params}`);
    },
    getLowStock: () => request<any[]>('/inventory/low-stock'),
    adjust: (productId: string, quantity: number, reason?: string) =>
      request<any>(`/inventory/${productId}/adjust`, {
        method: 'POST',
        body: JSON.stringify({ quantity, reason }),
      }),
    addBatch: (productId: string, data: { quantity: number; costPrice: number; reference?: string }) =>
      request<any>(`/inventory/${productId}/batches`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getBatches: (productId: string) =>
      request<any[]>(`/inventory/${productId}/batches`),
  },
  users: {
    getAll: (page = 1, limit = 20) =>
      request<any>(`/users?page=${page}&limit=${limit}`),
    create: (data: any) =>
      request<any>('/users', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: any) =>
      request<any>(`/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<any>(`/users/${id}`, { method: 'DELETE' }),
  },
  reports: {
    salesByDay: (days = 30) =>
      request<any[]>(`/reports/sales-by-day?days=${days}`),
    salesSummary: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return request<any>(`/reports/sales-summary?${params}`);
    },
    topProducts: (limit = 10, from?: string, to?: string) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return request<any[]>(`/reports/top-products?${params}`);
    },
    paymentBreakdown: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return request<any[]>(`/reports/payment-breakdown?${params}`);
    },
    salesByCashier: (from?: string, to?: string) => {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return request<any[]>(`/reports/sales-by-cashier?${params}`);
    },
    inventoryMovements: (productId?: string, from?: string, to?: string, page = 1, limit = 50) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (productId) params.set('productId', productId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      return request<any>(`/reports/inventory-movements?${params}`);
    },
    transactions: (date: string, page = 1, limit = 20) => {
      const params = new URLSearchParams({ date, page: String(page), limit: String(limit) });
      return request<any>(`/reports/transactions?${params}`);
    },
  },
  audit: {
    getAll: (page = 1, limit = 50, filters?: { action?: string; userId?: string; from?: string; to?: string }) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters?.action) params.set('action', filters.action);
      if (filters?.userId) params.set('userId', filters.userId);
      if (filters?.from) params.set('from', filters.from);
      if (filters?.to) params.set('to', filters.to);
      return request<any>(`/audit-logs?${params}`);
    },
  },
  sync: {
    status: () => request<any>('/sync/status'),
    retry: () => request<any>('/sync/retry', { method: 'POST' }),
  },
};
