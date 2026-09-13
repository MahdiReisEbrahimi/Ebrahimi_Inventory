import type { PageResult, PriceHistory, Product } from '@/types'
import { api } from './api'
export const productsApi = {
  list: (params: Record<string, string | number | boolean | undefined>) =>
    api<PageResult<Product>>(
      `/products?${new URLSearchParams(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ).toString()}`,
    ),
  get: (id: number) => api<Product>(`/products/${id}`),
  create: (data: object) =>
    api<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: object) =>
    api<Product>(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  status: (id: number, isActive: boolean) =>
    api<Product>(`/products/${id}/status`, { method: 'PATCH', body: JSON.stringify({ isActive }) }),
  remove: (id: number) => api<void>(`/products/${id}`, { method: 'DELETE' }),
  history: (id: number) => api<PageResult<PriceHistory>>(`/products/${id}/price-history`),
  previewBulk: (data: object) =>
    api<{
      affectedProducts: number
      items: { id: number; name: string; oldPrice: number; newPrice: number }[]
    }>('/products/bulk-price-update/preview', { method: 'POST', body: JSON.stringify(data) }),
  bulk: (data: object) =>
    api<{ affectedProducts: number }>('/products/bulk-price-update', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
