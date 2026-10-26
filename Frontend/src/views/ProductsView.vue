<template>
  <div class="page-stack table-page products-page">
    <PageHeader title="کالاها و قیمت‌ها">
      <Button variant="outline" @click="bulkOpen = true"
        ><Tags :size="17" />تغییر گروهی قیمت</Button
      >
      <Button @click="openForm()"><Plus :size="18" />کالای جدید</Button>
    </PageHeader>
    <div class="product-summary">
      <span
        ><Package :size="16" /><b>{{ number(items.length) }}</b> کالای دریافت‌شده</span
      ><span
        ><i class="status-dot" /><b>{{ number(items.filter((p) => p.isActive).length) }}</b> کالای
        فعال</span
      ><button
        @click="query.lowStock = !query.lowStock"
        :aria-pressed="query.lowStock"
        :class="{ selected: query.lowStock }"
      >
        <TriangleAlert :size="16" />{{
          number(items.filter((p) => p.isActive && p.stock <= p.minStock).length)
        }}
        کالا نیازمند تأمین
      </button>
    </div>
    <section class="panel table-panel products-panel">
      <div class="filter-bar">
        <label class="search-field"
          ><Search :size="18" /><input
            v-model="query.search"
            type="search"
            placeholder="نام کالا را جست‌وجو کنید…"
            aria-label="جست‌وجوی نام کالا"
        /></label>
        <select v-model="query.categoryId" aria-label="فیلتر دسته‌بندی">
          <option :value="undefined">همه دسته‌بندی‌ها</option>
          <option v-for="category in categories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <select v-model="query.isActive" aria-label="فیلتر وضعیت">
          <option :value="undefined">همه وضعیت‌ها</option>
          <option :value="true">فعال</option>
          <option :value="false">غیرفعال</option>
        </select>
        <button
          class="icon-button"
          aria-label="دریافت دوباره کالاها"
          :disabled="loading"
          @click="load"
        >
          <RefreshCw :size="18" />
        </button>
        <div v-if="hasFilters" class="active-filters">
          <span role="status">{{ number(filtered.length) }} نتیجه پیدا شد</span>
          <button
            class="icon-button"
            aria-label="پاک‌کردن فیلترها"
            title="پاک‌کردن فیلترها"
            @click="clearFilters"
          >
            <X :size="15" />
          </button>
        </div>
      </div>
      <CustomTable
        :table-data="pageItems"
        :table-columns="columns"
        :row-actions="rowActions"
        :loading="loading"
        :error="error"
        @refresh="load"
        @action-click="handleAction"
      >
        <template #name="{ row }"
          ><div class="product-cell">
            <b>{{ row.name }}</b>
          </div></template
        >
        <template #stock="{ row }"
          ><span class="stock-value" :class="{ danger: row.stock <= row.minStock }"
            >{{ number(row.stock) }} <small>{{ row.unit }}</small></span
          ></template
        >
        <template #isActive="{ row }"
          ><button
            class="badge status-button"
            :class="row.isActive ? 'badge--success' : ''"
            :disabled="statusSaving === row.id"
            :aria-label="row.isActive ? 'غیرفعال کردن ' + row.name : 'فعال کردن ' + row.name"
            @click="toggleStatus(row as Product)"
          >
            {{ row.isActive ? 'فعال' : 'غیرفعال' }}
          </button></template
        >
        <template #empty
          ><Button variant="outline" @click="openForm()">ثبت کالای جدید</Button></template
        >
      </CustomTable>
      <div v-if="!loading && !error && filtered.length" class="pagination-controls">
        <span
          >{{ number(filtered.length) }} کالا<span v-if="totalRecords > items.length">
            از {{ number(totalRecords) }} کالای سرور</span
          ></span
        >
        <div class="pagination-buttons">
          <select v-model.number="query.limit" aria-label="تعداد کالا در صفحه">
            <option :value="10">۱۰</option>
            <option :value="20">۲۰</option>
            <option :value="50">۵۰</option></select
          ><button
            class="icon-button"
            :disabled="query.page === 1"
            aria-label="صفحه قبل"
            @click="query.page--"
          >
            <ChevronRight :size="17" /></button
          ><span>{{ number(query.page) }} از {{ number(pages) }}</span
          ><button
            class="icon-button"
            :disabled="query.page >= pages"
            aria-label="صفحه بعد"
            @click="query.page++"
          >
            <ChevronLeft :size="17" />
          </button>
        </div>
      </div>
    </section>
    <AppDialog
      v-model:open="formOpen"
      :title="selected ? 'ویرایش کالا' : 'ثبت کالای جدید'"
      width="600px"
      ><ProductFormView
        v-if="formOpen"
        embedded
        :edit-data="selected || undefined"
        @close="onFormClose"
    /></AppDialog>
    <AppDialog v-model:open="detailsOpen" title="شناسنامه کالا" width="760px"
      ><ProductDetailsDialog v-if="detailsOpen && selected" :selected-row="selected"
    /></AppDialog>
    <AppDialog v-model:open="deleteOpen" title="حذف کالا" width="440px"
      ><DeleteProductDialog
        v-if="deleteOpen && selected"
        :selected-row="selected"
        @close="onDeleteClose"
    /></AppDialog>
    <AppDialog v-model:open="bulkOpen" title="تغییر گروهی قیمت" width="850px"
      ><BulkPriceView v-if="bulkOpen" @close="onBulkClose"
    /></AppDialog>
    <AppDialog
      v-model:open="stockOpen"
      :title="stockType === 'PURCHASE' ? 'ثبت خرید کالا' : 'ثبت مرجوعی فروش'"
      width="620px"
    >
      <ProductStockDialog
        v-if="stockOpen && selected"
        :product="selected"
        :type="stockType"
        @close="onStockClose"
      />
    </AppDialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShoppingCart,
  Tags,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import CustomTable, { type TableColumn } from '@/components/CustomTable.vue'
import ProductDetailsDialog from '@/components/dialogs/ProductDetailsDialog.vue'
import DeleteProductDialog from '@/components/dialogs/DeleteProductDialog.vue'
import ProductStockDialog from '@/components/dialogs/ProductStockDialog.vue'
import ProductFormView from './ProductFormView.vue'
import BulkPriceView from './BulkPriceView.vue'
import { productsApi } from '@/services/products'
import { categoriesApi } from '@/services/categories'
import { number } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Product, Category } from '@/types'
const route = useRoute()
const items = ref<Product[]>([]),
  categories = ref<Category[]>([])
const loading = ref(true),
  error = ref(''),
  totalRecords = ref(0),
  statusSaving = ref<number>()
const selected = ref<Product | null>(null)
const formOpen = ref(false),
  detailsOpen = ref(false),
  deleteOpen = ref(false),
  bulkOpen = ref(false)
const stockOpen = ref(false)
const stockType = ref<'PURCHASE' | 'RETURN'>('PURCHASE')
const query = reactive({
  search: '',
  categoryId: undefined as number | undefined,
  isActive: undefined as boolean | undefined,
  lowStock: false,
  page: 1,
  limit: 10,
})
const columns: TableColumn[] = [
  { prop: 'name', label: 'نام کالا' },
  { prop: 'category.name', label: 'دسته‌بندی' },
  { prop: 'sellPrice', label: 'قیمت فروش · تومان', type: 'price' },
  { prop: 'stock', label: 'موجودی' },
  { prop: 'isActive', label: 'وضعیت' },
]
const rowActions = [
  { name: 'purchase', icon: ShoppingCart, label: 'ثبت خرید کالا' },
  { name: 'return', icon: Undo2, label: 'ثبت مرجوعی فروش' },
  { name: 'view', icon: Eye, label: 'مشاهده جزئیات کالا' },
  { name: 'edit', icon: Pencil, label: 'ویرایش کالا' },
  { name: 'delete', icon: Trash2, label: 'حذف کالا' },
]
const filtered = computed(() =>
  items.value.filter(
    (p) =>
      (!query.search.trim() || p.name.toLowerCase().includes(query.search.trim().toLowerCase())) &&
      (query.categoryId === undefined || p.categoryId === query.categoryId) &&
      (query.isActive === undefined || p.isActive === query.isActive) &&
      (!query.lowStock || (p.isActive && p.stock <= p.minStock)),
  ),
)
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / query.limit)))
const pageItems = computed(() =>
  filtered.value.slice((query.page - 1) * query.limit, query.page * query.limit),
)
const hasFilters = computed(
  () =>
    query.search ||
    query.categoryId !== undefined ||
    query.isActive !== undefined ||
    query.lowStock,
)
watch(
  () => [query.search, query.categoryId, query.isActive, query.lowStock, query.limit],
  () => {
    query.page = 1
  },
)
watch(pages, (value) => {
  query.page = Math.min(query.page, value)
})
watch(
  () => route.query,
  (value) => {
    query.search = typeof value.search === 'string' ? value.search : ''
    query.lowStock = value.lowStock === 'true'
    query.categoryId = value.categoryId ? Number(value.categoryId) : undefined
  },
  { immediate: true },
)
function clearFilters() {
  Object.assign(query, {
    search: '',
    categoryId: undefined,
    isActive: undefined,
    lowStock: false,
    page: 1,
  })
}
function openForm(product?: Product) {
  selected.value = product || null
  formOpen.value = true
}
function handleAction({ actionName, row }: { actionName: string; row: Product }) {
  selected.value = row
  if (actionName === 'view') detailsOpen.value = true
  if (actionName === 'edit') formOpen.value = true
  if (actionName === 'delete') deleteOpen.value = true
  if (actionName === 'purchase' || actionName === 'return') {
    stockType.value = actionName === 'purchase' ? 'PURCHASE' : 'RETURN'
    stockOpen.value = true
  }
}
async function onStockClose(saved: boolean) {
  stockOpen.value = false
  if (saved) await load()
}
async function onFormClose(saved: boolean) {
  formOpen.value = false
  if (saved) await load()
}
async function onBulkClose(saved: boolean) {
  bulkOpen.value = false
  if (saved) await load()
}
async function onDeleteClose(deleted: boolean) {
  deleteOpen.value = false
  if (deleted) await load()
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [result, groups] = await Promise.all([
      productsApi.list({ page: 1, limit: 10000 }),
      categoriesApi.list(),
    ])
    items.value = result.data
    totalRecords.value = result.meta.total
    categories.value = groups
  } catch {
    error.value = 'دریافت فهرست کالاها ممکن نشد. اتصال به سرور را بررسی کنید.'
  } finally {
    loading.value = false
  }
}
async function toggleStatus(product: Product) {
  statusSaving.value = product.id
  try {
    await productsApi.status(product.id, !product.isActive)
    product.isActive = !product.isActive
    toast.success('وضعیت کالا به‌روز شد.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'تغییر وضعیت انجام نشد.')
  } finally {
    statusSaving.value = undefined
  }
}
onMounted(load)
</script>
<style scoped>
.products-panel :deep(.index-column) {
  width: 80px;
  min-width: 80px;
}

.product-summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 24px;
  font-size: 12px;
  color: var(--muted-foreground);
}
.product-summary > span,
.product-summary > button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.product-summary b {
  color: var(--foreground);
  font-weight: 650;
}
.product-summary button {
  background: transparent;
  color: var(--warning);
  border: 1px solid transparent;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
}
.product-summary button.selected {
  border-color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, transparent);
}
.status-dot {
  width: 7px;
  height: 7px;
  background: var(--success);
  border-radius: 50%;
}
.products-panel {
  overflow: hidden;
}
.products-panel .filter-bar {
  display: grid;
  grid-template-columns: minmax(140px, 1.5fr) minmax(120px, 1fr) minmax(90px, 0.8fr) 32px 160px;
  gap: 8px;
  padding: 9px 12px;
  overflow-x: auto;
}
.products-panel .filter-bar .search-field,
.products-panel .filter-bar > select {
  min-width: 0;
  width: 100%;
}
.products-panel .filter-bar input,
.products-panel .filter-bar select {
  min-height: 34px;
  padding-block: 5px;
  font-size: 12px;
}
.products-panel .filter-bar .icon-button {
  width: 32px;
  height: 32px;
  min-height: 32px;
}
.products-panel :deep(.action-column) {
  min-width: 232px;
}
.products-panel :deep(.row-actions .icon-button) {
  width: 34px;
  height: 34px;
  margin-inline: 3px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--card);
  color: var(--muted-foreground);
  transition:
    background 0.15s,
    border-color 0.15s,
    color 0.15s,
    transform 0.15s;
}
.products-panel :deep(.row-actions .icon-button--purchase),
.products-panel :deep(.row-actions .icon-button--edit) {
  color: var(--primary);
  background: var(--secondary);
}
.products-panel :deep(.row-actions .icon-button--return) {
  color: var(--warning);
  background: color-mix(in srgb, var(--warning) 8%, var(--card));
}
.products-panel :deep(.row-actions .icon-button--delete) {
  color: var(--destructive);
  background: color-mix(in srgb, var(--destructive) 6%, var(--card));
}
.products-panel :deep(.row-actions .icon-button:hover) {
  border-color: currentColor;
  transform: translateY(-2px);
}
.products-panel :deep(.row-actions .icon-button:active) {
  transform: translateY(0);
}
.product-cell {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-width: 150px;
}
.product-cell b {
  font-weight: 600;
}
.product-mark {
  width: 36px;
  height: 36px;
  background: var(--muted);
  color: var(--primary);
  border-radius: 10px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.stock-value {
  white-space: nowrap;
  font-weight: 650;
}
.stock-value small {
  font-size: 10px;
  color: var(--muted-foreground);
  font-weight: 400;
}
.status-button {
  border: 1px solid transparent;
  min-height: 32px;
}
.status-button:hover {
  border-color: currentColor;
}
.active-filters {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  white-space: nowrap;
  font-size: 11px;
  color: var(--muted-foreground);
}
@media (max-width: 640px) {
  .product-summary {
    gap: 10px;
  }
  .product-cell {
    min-width: 0;
  }
  .product-mark {
    display: none;
  }
}
</style>
