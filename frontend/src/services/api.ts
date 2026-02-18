import axios from 'axios';

// В production задайте VITE_API_URL (полный URL до /api), например https://your-api.onrender.com/api
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const addressSuggestApi = {
  suggest: (query: string, count = 10) =>
    api.get<{ suggestions: { value: string; unrestricted_value?: string }[] }>('/address-suggest', {
      params: { q: query, count },
      timeout: 10000,
    }),
};

// Подставляем токен из localStorage при его наличии
const token = localStorage.getItem('token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

export function setAuthToken(t: string | null) {
  if (t) {
    api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
    localStorage.setItem('token', t);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
}

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  is_first?: boolean;
}

export const authApi = {
  register: (data: { email: string; password: string; name?: string }) =>
    api.post<{ token: string; user: AuthUser }>('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: AuthUser }>('/auth/login', data),
  me: () => api.get<AuthUser>('/auth/me'),
};

export interface Property {
  id: number;
  name: string;
  address?: string;
  total_area?: number;
  units_count?: number;
  occupied_units?: number;
  monthly_revenue?: number;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: number;
  property_id: number;
  unit_number: string;
  area: number;
  price_per_sqm: number;
  status: 'vacant' | 'rented' | 'maintenance';
  monthly_rent: number;
  category?: string | null;
  current_tenant_id?: number;
  current_tenant_name?: string;
  current_lease_id?: number;
  property_name?: string;
  tenant_name?: string;
  created_at: string;
  updated_at: string;
}

/** Предустановленные категории помещений + «Другое» (свой вариант) */
export const UNIT_CATEGORY_OTHER = '__other__';
export const UNIT_CATEGORIES = [
  'Цех',
  'Торговая площадь',
  'Офис',
  'Склад',
  'Подсобное помещение',
  'Парковка',
  'Коворкинг',
  'Переговорная',
  'Общепит',
  'Земля',
] as const;

export interface PropertyDocument {
  id: number;
  property_id: number;
  name: string;
  type: 'plan' | 'document';
  file_name: string;
  mime_type?: string;
  size?: number;
  content?: string;
  created_at: string;
  updated_at?: string;
}

export const propertiesApi = {
  getAll: () => api.get<Property[]>('/properties'),
  getById: (id: number) => api.get<Property>(`/properties/${id}`),
  create: (data: Partial<Property>) => api.post<Property>('/properties', data),
  update: (id: number, data: Partial<Property>) => api.put<Property>(`/properties/${id}`, data),
  delete: (id: number) => api.delete(`/properties/${id}`),
  getUnits: (id: number) => api.get<Unit[]>(`/properties/${id}/units`),
  getDocuments: (propertyId: number) =>
    api.get<Omit<PropertyDocument, 'content'>[]>(`/properties/${propertyId}/documents`),
  uploadDocument: (propertyId: number, data: { name: string; type: 'plan' | 'document'; file_name: string; mime_type?: string; content: string }) =>
    api.post<PropertyDocument>(`/properties/${propertyId}/documents`, data),
  getDocument: (propertyId: number, docId: number) =>
    api.get<PropertyDocument>(`/properties/${propertyId}/documents/${docId}`),
  deleteDocument: (propertyId: number, docId: number) =>
    api.delete(`/properties/${propertyId}/documents/${docId}`),
};

export const unitsApi = {
  getAll: (propertyId?: number) => {
    const params = propertyId ? { property_id: propertyId } : {};
    return api.get<Unit[]>('/units', { params });
  },
  getById: (id: number) => api.get<Unit>(`/units/${id}`),
  create: (data: Partial<Unit>) => api.post<Unit>('/units', data),
  update: (id: number, data: Partial<Unit>) => api.put<Unit>(`/units/${id}`, data),
  delete: (id: number) => api.delete(`/units/${id}`),
  getProfitability: (id: number, month?: number, year?: number) => {
    const params: any = {};
    if (month) params.month = month;
    if (year) params.year = year;
    return api.get(`/units/${id}/profitability`, { params });
  },
};

export interface Tenant {
  id: number;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  tax_id?: string;
  created_at: string;
}

export interface Lease {
  id: number;
  unit_id: number;
  tenant_id: number;
  start_date: string;
  end_date?: string;
  monthly_rent: number;
  deposit?: number;
  status: 'active' | 'completed' | 'terminated';
  created_at: string;
}

export interface MandatoryPayment {
  id: number;
  unit_id?: number;
  property_id?: number;
  payment_type: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'yearly';
  start_date: string;
  end_date?: string;
  is_cost: number;
  created_at: string;
}

export interface TenantPayment {
  id: number;
  lease_id: number;
  unit_id: number;
  tenant_id: number;
  planned_amount: number;
  actual_amount?: number;
  payment_date?: string;
  month: number;
  year: number;
  status: 'expected' | 'received' | 'overdue' | 'partially_paid';
  is_paid: number;
  payment_method?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const tenantsApi = {
  getAll: () => api.get<Tenant[]>('/tenants'),
  getById: (id: number) => api.get<Tenant>(`/tenants/${id}`),
  create: (data: Partial<Tenant>) => api.post<Tenant>('/tenants', data),
  update: (id: number, data: Partial<Tenant>) => api.put<Tenant>(`/tenants/${id}`, data),
  delete: (id: number) => api.delete(`/tenants/${id}`),
};

export const leasesApi = {
  getAll: (status?: string) => {
    const params = status ? { status } : {};
    return api.get<Lease[]>('/leases', { params });
  },
  getById: (id: number) => api.get<Lease>(`/leases/${id}`),
  create: (data: Partial<Lease>) => api.post<Lease>('/leases', data),
  update: (id: number, data: Partial<Lease>) => api.put<Lease>(`/leases/${id}`, data),
  delete: (id: number) => api.delete(`/leases/${id}`),
};

export const mandatoryPaymentsApi = {
  getAll: (unitId?: number, propertyId?: number) => {
    const params: any = {};
    if (unitId) params.unit_id = unitId;
    if (propertyId) params.property_id = propertyId;
    return api.get<MandatoryPayment[]>('/mandatory-payments', { params });
  },
  getById: (id: number) => api.get<MandatoryPayment>(`/mandatory-payments/${id}`),
  create: (data: Partial<MandatoryPayment>) => api.post<MandatoryPayment>('/mandatory-payments', data),
  update: (id: number, data: Partial<MandatoryPayment>) => api.put<MandatoryPayment>(`/mandatory-payments/${id}`, data),
  delete: (id: number) => api.delete(`/mandatory-payments/${id}`),
};

export const tenantPaymentsApi = {
  getAll: (month?: number, year?: number, leaseId?: number) => {
    const params: any = {};
    if (month) params.month = month;
    if (year) params.year = year;
    if (leaseId) params.lease_id = leaseId;
    return api.get<TenantPayment[]>('/tenant-payments', { params });
  },
  create: (data: Partial<TenantPayment>) => api.post<TenantPayment>('/tenant-payments', data),
  update: (id: number, data: Partial<TenantPayment>) => api.put<TenantPayment>(`/tenant-payments/${id}`, data),
  markPaid: (id: number, data?: Partial<TenantPayment>) => api.post<TenantPayment>(`/tenant-payments/${id}/mark-paid`, data),
  generateMonthly: (month: number, year: number) => api.post('/tenant-payments/generate-monthly', { month, year }),
};

/** Статус оплаты: invoiced — счёт выставлен; paid — оплачен; deferred — отложенный платёж */
export type TransactionPaymentStatus = 'invoiced' | 'paid' | 'deferred';

export interface Transaction {
  id: number;
  unit_id?: number | null;
  property_id?: number | null;
  lease_id?: number;
  type: 'income' | 'expense';
  category?: string;
  category_detail?: string | null;
  amount: number;
  date: string;
  description?: string;
  is_planned: number;
  is_tenant_payment?: number;
  related_payment_id?: number;
  payer?: string;
  unit_number?: string;
  property_name?: string;
  status?: TransactionPaymentStatus;
  scheduled_pay_date?: string | null;
  created_at?: string;
}

export interface CalendarItem extends Transaction {
  calendar_type: 'planned_income' | 'planned_expense' | 'deferred';
  display_date: string;
}

export interface CalendarResponse {
  by_date: Record<string, CalendarItem[]>;
  dates: string[];
}

export const transactionsApi = {
  getAll: (params?: { type?: string; is_planned?: boolean; unit_id?: number; property_id?: number; start_date?: string; end_date?: string }) =>
    api.get<Transaction[]>('/transactions', { params }),
  getCalendar: (params: { start_date: string; end_date: string }) =>
    api.get<CalendarResponse>('/transactions/calendar', { params }),
  create: (data: Partial<Transaction>) => api.post<Transaction>('/transactions', data),
  update: (id: number, data: Partial<Transaction>) => api.put<Transaction>(`/transactions/${id}`, data),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};

export interface InvoiceRequest {
  leaseId: number;
  period?: string;
  sendEmail: boolean;
}

export interface InvoiceResponse {
  success: boolean;
  invoice: {
    number: string;
    date: string;
    dueDate: string;
    html: string;
    pdf: string;
  };
  emailSent: boolean;
  emailError?: string;
}

export const invoicesApi = {
  generate: (data: InvoiceRequest) =>
    api.post<InvoiceResponse>('/invoices/generate', data),
};

export default api;
