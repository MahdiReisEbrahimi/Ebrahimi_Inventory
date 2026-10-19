import { api } from './api'
import type { Buyer, InventoryMovement, Invoice, StoreSettings } from '@/types'
export const inventoryApi = {
  movements: () => api<InventoryMovement[]>('/transactions'),
  receive: (data: object) => api<InventoryMovement>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  invoices: (filters: { customerId?: number; buyer?: string; product?: string; from?: string; to?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '').map(([key, value]) => [key, String(value)]))
    return api<Invoice[]>(`/invoices${query.size ? `?${query}` : ''}`)
  },
  invoice: (id: number) => api<Invoice>(`/invoices/${id}`),
  createInvoice: (data: object) => api<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  settings: () => api<StoreSettings>('/store-settings'),
  saveSettings: (data: object) => api<StoreSettings>('/store-settings', { method: 'PUT', body: JSON.stringify(data) }),
  buyers: () => api<Buyer[]>('/buyers'),
  createBuyer: (data: object) => api<Buyer>('/buyers', { method: 'POST', body: JSON.stringify(data) }),
  updateBuyer: (id: number, data: object) => api<Buyer>(`/buyers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBuyer: (id: number) => api<{ deleted: boolean }>(`/buyers/${id}`, { method: 'DELETE' }),
}
