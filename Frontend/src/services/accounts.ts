import { api } from './api'
import type {
  PartyAccount,
  AccountReturnProduct,
  AccountFinalizationPreview,
  Invoice,
} from '@/types'
export const accountsApi = {
  list: (all = false) =>
    api<{ accounts: PartyAccount[]; unassignedCount: number }>(`/accounts?all=${all}`),
  detail: (id: number) => api<PartyAccount>(`/accounts/${id}`),
  cash: (
    id: number,
    data: { amount: number; kind: 'PAYMENT' | 'REFUND'; requestKey: string; description: string },
  ) => api<PartyAccount>(`/accounts/${id}/cash`, { method: 'POST', body: JSON.stringify(data) }),
  returnable: (id: number) =>
    api<{ products: AccountReturnProduct[] }>(`/accounts/${id}/returnable`),
  returnGoods: (
    id: number,
    data: { items: { productId: number; quantity: number }[]; notes: string; requestKey: string },
  ) => api<PartyAccount>(`/accounts/${id}/returns`, { method: 'POST', body: JSON.stringify(data) }),
  finalization: (id: number, discount?: number) =>
    api<AccountFinalizationPreview>(
      `/accounts/${id}/finalization${discount == null ? '' : `?discount=${discount}`}`,
    ),
  finalize: (
    id: number,
    data: { token: string; discount: number; paymentAmount: number; requestKey: string },
  ) =>
    api<{ account: PartyAccount; statement: Invoice }>(`/accounts/${id}/finalize`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
}
