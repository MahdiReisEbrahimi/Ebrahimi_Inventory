export interface Category {
  id: number
  name: string
  _count?: { products: number }
}
export interface Product {
  id: number
  name: string
  sku: string
  categoryId: number
  category: Category
  unit: string
  buyPrice: number
  sellPrice: number
  stock: number
  minStock: number
  description?: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}
export interface PageResult<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}
export interface PriceHistory {
  id: number
  oldPrice: number | null
  newPrice: number | null
  oldBuyPrice: number | null
  newBuyPrice: number | null
  oldSellPrice: number | null
  newSellPrice: number | null
  changePercent: number | null
  type: 'SINGLE' | 'BULK'
  createdAt: string
}
export interface InventoryMovement {
  id: number; type: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT'; quantity: number; unitPrice: number | null; description: string | null; createdAt: string;
  product: Pick<Product, 'id' | 'name' | 'sku' | 'unit'>; invoice?: { number: string } | null
}
export interface InvoiceItem { id: number; productId: number; name: string; unit: string; quantity: number; unitPrice: number; total: number }
export interface Invoice { id: number; number: string; buyerFirstName: string | null; buyerLastName: string | null; buyerNationalId: string | null; buyerAddress: string | null; notes: string | null; total: number; createdAt: string; items: InvoiceItem[] }
export interface StoreSettings { id: number; name: string; address: string; phone: string; logoUrl: string | null }
