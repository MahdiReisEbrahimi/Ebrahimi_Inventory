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
  currency?: 'IRR' | 'TOMAN'
  id: number
  type: 'PURCHASE' | 'SALE' | 'RETURN' | 'ADJUSTMENT'
  quantity: number
  unitPrice: number | null
  description: string | null
  createdAt: string
  product: Pick<Product, 'id' | 'name' | 'sku' | 'unit'>
  invoice?: { number: string } | null
}
export interface InvoiceItem {
  id: number
  productId: number
  name: string
  unit: string
  quantity: number
  unitPrice: number
  total: number
}
export interface Invoice {
  id: number
  number: string
  customerId?: number | null
  buyerFirstName: string | null
  buyerLastName: string | null
  buyerNationalId: string | null
  buyerAddress: string | null
  buyerPhone?: string | null
  notes: string | null
  total: number
  subtotal?: number
  discount?: number
  paidAmount?: number
  settlement?: 'CASH' | 'INSTALLMENT'
  currency?: 'IRR' | 'TOMAN'
  issueDate?: string
  sellerName?: string | null
  sellerAddress?: string | null
  sellerPhone?: string | null
  sellerLogoUrl?: string | null
  sellerIban?: string | null
  createdAt: string
  items: InvoiceItem[]
}
export interface StoreSettings {
  id: number
  name: string
  address: string
  phone: string
  logoUrl: string | null
  iban?: string
  defaultInvoiceNotes?: string
}
export interface Buyer {
  id: number
  firstName: string
  lastName: string
  nationalId: string | null
  phone: string | null
  address: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}
