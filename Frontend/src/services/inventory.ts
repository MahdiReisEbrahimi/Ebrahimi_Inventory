import { api } from './api'
import type { InventoryMovement, Invoice, StoreSettings } from '@/types'
export const inventoryApi = {
  movements: () => api<InventoryMovement[]>('/transactions'),
  receive: (data: object) => api<InventoryMovement>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  invoices: () => api<Invoice[]>('/invoices'),
  invoice: (id: number) => api<Invoice>(`/invoices/${id}`),
  createInvoice: (data: object) => api<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  settings: () => api<StoreSettings>('/store-settings'),
  saveSettings: (data: object) => api<StoreSettings>('/store-settings', { method: 'PUT', body: JSON.stringify(data) }),
}
