export interface Category { id: number; name: string; _count?: { products: number } }
export interface Product { id: number; name: string; sku: string; categoryId: number; category: Category; unit: string; buyPrice: number; sellPrice: number; stock: number; minStock: number; description?: string | null; isActive: boolean; createdAt: string; updatedAt: string }
export interface PageResult<T> { data: T[]; meta: { page: number; limit: number; total: number; totalPages: number } }
export interface PriceHistory { id: number; oldPrice: number | null; newPrice: number | null; oldBuyPrice: number | null; newBuyPrice: number | null; oldSellPrice: number | null; newSellPrice: number | null; changePercent: number | null; type: 'SINGLE' | 'BULK'; createdAt: string }
