import { api } from './api'
import type { Buyer, InventoryMovement, Invoice, StoreSettings } from '@/types'
export const inventoryApi = {
  movements: () => api<InventoryMovement[]>('/transactions'),
  receive: (data: object) =>
    api<InventoryMovement>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
  invoices: (
    filters: {
      kind?: 'SALE' | 'PURCHASE' | 'RETURN'
      openOnly?: boolean
      customerId?: number
      buyer?: string
      product?: string
      from?: string
      to?: string
    } = {},
  ) => {
    const query = new URLSearchParams(
      Object.entries(filters)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => [key, String(value)]),
    )
    return api<Invoice[]>(`/invoices${query.size ? `?${query}` : ''}`)
  },
  returnableInvoice: (id: number) => api<Invoice>(`/invoices/${id}/returnable`),
  invoice: (id: number) => api<Invoice>(`/invoices/${id}`),
  createInvoice: (data: object) =>
    api<Invoice>('/invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateInvoice: (id: number, data: object) =>
    api<Invoice>(`/invoices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  assignParty: (id: number, customerId: number) =>
    api<Invoice>(`/invoices/${id}/party`, {
      method: 'PATCH',
      body: JSON.stringify({ customerId }),
    }),
  updatePayment: (id: number, paymentAmount: number) =>
    api<Invoice>(`/invoices/${id}/payment`, {
      method: 'PATCH',
      body: JSON.stringify({ paymentAmount, currency: 'TOMAN' }),
    }),
  finalizationPreview: (id: number) =>
    api<{ token: string; invoice: Invoice }>(`/invoices/${id}/finalization`),
  finalizeInvoice: (id: number, token: string, paymentAmount: number, discount: number) =>
    api<Invoice>(`/invoices/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify({ token, paymentAmount, discount, currency: 'TOMAN' }),
    }),
  settings: () => api<StoreSettings>('/store-settings'),
  saveSettings: (data: object) =>
    api<StoreSettings>('/store-settings', { method: 'PUT', body: JSON.stringify(data) }),
  buyers: () => api<Buyer[]>('/buyers'),
  createBuyer: (data: object) =>
    api<Buyer>('/buyers', { method: 'POST', body: JSON.stringify(data) }),
  updateBuyer: (id: number, data: object) =>
    api<Buyer>(`/buyers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBuyer: (id: number) => api<{ deleted: boolean }>(`/buyers/${id}`, { method: 'DELETE' }),
}
