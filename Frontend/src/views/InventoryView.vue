<template>
  <div class="page-stack">
    <PageHeader
      :title="isTransactions ? 'گردش موجودی' : 'ورود و مرجوعی کالا'"
      :description="
        isTransactions
          ? 'مسیر ورود و خروج هر کالا را به‌سادگی دنبال کنید.'
          : 'کالای خریداری‌شده یا مرجوعی فروش را به موجودی اضافه کنید.'
      "
      eyebrow="مدیریت انبار"
    >
      <RouterLink v-if="isTransactions" to="/inventory" class="button button--primary"
        ><Plus :size="17" />ثبت ورود کالا</RouterLink
      >
      <RouterLink v-else to="/transactions" class="button button--outline"
        ><History :size="17" />همه گردش‌ها</RouterLink
      >
    </PageHeader>
    <div v-if="error" class="notice notice--error" role="alert">
      {{ error }}<Button variant="outline" @click="load">تلاش دوباره</Button>
    </div>
    <div v-if="!isTransactions" class="receive-layout">
      <section class="panel">
        <div class="panel-heading">
          <div>
            <h2>ثبت در انبار</h2>
            <p>نوع ورود را انتخاب کنید و اطلاعات کالا را تکمیل کنید.</p>
          </div>
          <ArrowDownToLine :size="22" class="muted" />
        </div>
        <form class="panel-body" @submit.prevent="receive">
          <div class="segmented-control movement-tabs">
            <button
              type="button"
              :aria-pressed="form.type === 'PURCHASE'"
              @click="form.type = 'PURCHASE'"
            >
              ورود خرید</button
            ><button
              type="button"
              :aria-pressed="form.type === 'RETURN'"
              @click="form.type = 'RETURN'"
            >
              مرجوعی فروش
            </button>
          </div>
          <div class="form-grid">
            <label v-if="form.type === 'RETURN'" class="form-field full-width"
              ><span>فاکتور فروش مربوط به مرجوعی</span
              ><select v-model.number="form.invoiceId" required :disabled="loading">
                <option :value="undefined" disabled>فاکتور را انتخاب کنید</option>
                <option v-for="invoice in invoices" :key="invoice.id" :value="invoice.id">
                  {{ invoice.number }} · {{ invoice.buyerFirstName }} {{ invoice.buyerLastName }}
                </option></select
              ><small>فهرست شامل آخرین ۵۰۰ فاکتور است.</small></label
            >
            <label class="form-field full-width"
              ><span>کالا</span
              ><select
                v-model.number="form.productId"
                required
                :disabled="loading || (form.type === 'RETURN' && !form.invoiceId)"
              >
                <option :value="undefined" disabled>انتخاب کالا</option>
                <option v-for="product in availableProducts" :key="product.id" :value="product.id">
                  {{ product.name }} · {{ product.sku }}
                </option></select
              ><small v-if="selectedProduct"
                >موجودی فعلی: {{ number(selectedProduct.stock) }} {{ selectedProduct.unit }}</small
              ></label
            >
            <label class="form-field"
              ><span>تعداد {{ form.type === 'RETURN' ? 'مرجوعی' : 'ورودی' }}</span
              ><input v-model.number="form.quantity" type="number" min="1" step="1" required
            /></label>
            <label class="form-field"
              ><span>قیمت خرید واحد <small>اختیاری · تومان</small></span
              ><input
                v-model="priceText"
                inputmode="numeric"
                placeholder="قیمت فعلی حفظ شود"
              /><small>با وارد کردن مبلغ، قیمت خرید کالا به‌روز می‌شود.</small></label
            >
            <label class="form-field"
              ><span>تاریخ <small>اختیاری</small></span
              ><input v-model="form.date" type="date"
            /></label>
            <label class="form-field"
              ><span>توضیحات <small>اختیاری</small></span
              ><input v-model="form.description" placeholder="مثلاً شماره رسید یا دلیل مرجوعی"
            /></label>
          </div>
          <div v-if="selectedProduct && form.quantity > 0" class="stock-preview">
            <span>موجودی پس از ثبت</span
            ><strong
              >{{ number(selectedProduct.stock + Number(form.quantity)) }}
              <small>{{ selectedProduct.unit }}</small></strong
            >
          </div>
          <p v-if="formError" class="notice notice--error" role="alert">{{ formError }}</p>
          <div class="form-actions">
            <Button type="submit" :disabled="saving || loading || !!error"
              ><Check :size="17" />{{
                saving ? 'در حال ثبت…' : form.type === 'RETURN' ? 'ثبت مرجوعی' : 'ثبت ورود کالا'
              }}</Button
            >
          </div>
        </form>
      </section>
      <aside class="receive-guide">
        <span class="guide-icon"><Boxes :size="28" :stroke-width="1.5" /></span>
        <h3>موجودی دقیق، با ثبت هر ورود</h3>
        <p>هر ثبت، موجودی کالا را افزایش می‌دهد و در گردش انبار باقی می‌ماند.</p>
        <ol>
          <li><b>کالا را انتخاب کنید</b><span>نام و کد کالا را بررسی کنید.</span></li>
          <li><b>تعداد را وارد کنید</b><span>تعداد بر اساس واحد ثبت‌شده کالا است.</span></li>
          <li><b>ثبت و بررسی کنید</b><span>نتیجه بلافاصله در فهرست گردش‌ها دیده می‌شود.</span></li>
        </ol>
        <p class="guide-footnote">خروج کالا هنگام صدور فاکتور فروش ثبت می‌شود.</p>
      </aside>
    </div>
    <section class="panel movement-panel">
      <div class="panel-heading">
        <div>
          <h2>{{ isTransactions ? 'فهرست گردش‌ها' : 'آخرین گردش‌های موجودی' }}</h2>
          <p>حداکثر ۵۰۰ گردش اخیر · {{ number(filteredMovements.length) }} نتیجه</p>
        </div>
        <button
          class="icon-button"
          :disabled="loading"
          aria-label="دریافت دوباره گردش‌ها"
          @click="load"
        >
          <RefreshCw :size="18" />
        </button>
      </div>
      <div class="filter-bar">
        <label class="search-field"
          ><Search :size="18" /><input
            v-model="search"
            type="search"
            placeholder="جست‌وجوی کالا، کد یا شماره فاکتور…"
            aria-label="جست‌وجوی گردش‌ها" /></label
        ><select v-model="movementType" aria-label="نوع گردش">
          <option value="">همه عملیات</option>
          <option value="PURCHASE">ورود خرید</option>
          <option value="SALE">فروش</option>
          <option value="RETURN">مرجوعی</option>
        </select>
      </div>
      <div v-if="loading" class="table-loading" role="status">در حال دریافت اطلاعات…</div>
      <EmptyState
        v-else-if="!filteredMovements.length"
        title="گردشی برای نمایش نیست"
        description="پس از ثبت ورود کالا یا صدور فاکتور، گردش موجودی در این بخش نمایش داده می‌شود."
      />
      <div v-else class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>کالا</th>
              <th>نوع عملیات</th>
              <th>تعداد</th>
              <th>قیمت واحد</th>
              <th>تاریخ</th>
              <th>فاکتور / توضیحات</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="movement in filteredMovements" :key="movement.id">
              <td>
                <b>{{ movement.product.name }}</b
                ><small class="movement-sku">{{ movement.product.sku }}</small>
              </td>
              <td>
                <span
                  class="badge"
                  :class="movement.type === 'SALE' ? 'badge--primary' : 'badge--success'"
                  >{{ typeLabel(movement.type) }}</span
                >
              </td>
              <td class="number-cell">
                {{ movement.type === 'SALE' ? '−' : '+' }} {{ number(movement.quantity) }}
                {{ movement.product.unit }}
              </td>
              <td class="number-cell">{{ money(movement.unitPrice) }}</td>
              <td class="number-cell">{{ date(movement.createdAt) }}</td>
              <td class="movement-note">
                {{ movement.invoice?.number || movement.description || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowDownToLine, Boxes, Check, History, Plus, RefreshCw, Search } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import { toast } from '@/lib/toast'
import { date, money, number, parseNumber } from '@/lib/format'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import type { InventoryMovement, Invoice, Product } from '@/types'
const route = useRoute()
const isTransactions = computed(() => route.path === '/transactions')
const products = ref<Product[]>([]),
  invoices = ref<Invoice[]>([]),
  movements = ref<InventoryMovement[]>([])
const loading = ref(true),
  saving = ref(false),
  error = ref(''),
  formError = ref(''),
  priceText = ref(''),
  search = ref(''),
  movementType = ref('')
const form = reactive<{
  productId?: number
  quantity: number
  date: string
  description: string
  type: 'PURCHASE' | 'RETURN'
  invoiceId?: number
}>({ quantity: 1, date: '', description: '', type: 'PURCHASE' })
const selectedProduct = computed(() => products.value.find((p) => p.id === form.productId))
const availableProducts = computed(() => {
  if (form.type === 'PURCHASE') return products.value.filter((p) => p.isActive)
  const ids = new Set(
    invoices.value.find((i) => i.id === form.invoiceId)?.items.map((i) => i.productId) || [],
  )
  return products.value.filter((p) => ids.has(p.id))
})
const filteredMovements = computed(() =>
  movements.value.filter(
    (m) =>
      (!movementType.value || m.type === movementType.value) &&
      [m.product.name, m.product.sku, m.invoice?.number || '', m.description || '']
        .join(' ')
        .toLowerCase()
        .includes(search.value.trim().toLowerCase()),
  ),
)
const typeLabel = (value: string) =>
  ({ PURCHASE: 'ورود خرید', SALE: 'فروش', RETURN: 'مرجوعی', ADJUSTMENT: 'اصلاح موجودی' })[value] ||
  value
watch(
  () => form.type,
  () => {
    form.productId = undefined
    form.invoiceId = undefined
    formError.value = ''
  },
)
watch(
  () => form.invoiceId,
  () => {
    if (form.type === 'RETURN') form.productId = undefined
  },
)
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [p, m, i] = await Promise.all([
      productsApi.list({ page: 1, limit: 10000 }),
      inventoryApi.movements(),
      inventoryApi.invoices(),
    ])
    products.value = p.data
    movements.value = m
    invoices.value = i
  } catch {
    error.value = 'دریافت اطلاعات انبار ممکن نشد. دوباره تلاش کنید.'
  } finally {
    loading.value = false
  }
}
async function receive() {
  if (saving.value) return
  formError.value = ''
  const unitPrice = priceText.value.trim() ? parseNumber(priceText.value) : undefined
  if (
    !form.productId ||
    !Number.isInteger(form.quantity) ||
    form.quantity < 1 ||
    (form.type === 'RETURN' && !form.invoiceId)
  ) {
    formError.value = 'کالا، تعداد صحیح و در صورت مرجوعی، فاکتور را انتخاب کنید.'
    return
  }
  if (unitPrice !== undefined && (!Number.isInteger(unitPrice) || unitPrice < 0)) {
    formError.value = 'قیمت خرید باید عدد صحیح و غیرمنفی باشد.'
    return
  }
  saving.value = true
  try {
    await inventoryApi.receive({
      productId: form.productId,
      quantity: form.quantity,
      type: form.type,
      unitPrice,
      description: form.description,
      date: form.date || undefined,
      invoiceId: form.type === 'RETURN' ? form.invoiceId : undefined,
    })
    toast.success(
      form.type === 'RETURN'
        ? 'مرجوعی ثبت و موجودی به‌روز شد.'
        : 'ورود کالا ثبت و موجودی به‌روز شد.',
    )
    form.productId = undefined
    form.quantity = 1
    form.description = ''
    priceText.value = ''
    await load()
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'ثبت انجام نشد.'
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.receive-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 24px;
  align-items: start;
}
.movement-tabs {
  margin-bottom: 24px;
  width: 100%;
}
.movement-tabs button {
  flex: 1;
}
.full-width {
  grid-column: 1 / -1;
}
.stock-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 22px;
  padding: 14px 18px;
  background: var(--secondary);
  border-radius: 12px;
  font-size: 12px;
}
.stock-preview strong {
  font-size: 23px;
  color: var(--primary);
}
.stock-preview small {
  font-size: 12px;
  font-weight: 400;
}
.receive-guide {
  padding: 26px 22px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.guide-icon {
  width: 56px;
  height: 56px;
  display: grid;
  place-items: center;
  background: var(--accent);
  color: var(--primary);
  border-radius: 16px;
  margin-bottom: 20px;
}
.receive-guide h3 {
  margin-bottom: 8px;
}
.receive-guide p {
  font-size: 12px;
  color: var(--muted-foreground);
  line-height: 2;
}
.receive-guide ol {
  padding-inline-start: 20px;
  margin-block: 26px;
  color: var(--primary);
}
.receive-guide li {
  padding-inline-start: 8px;
  margin-bottom: 20px;
  font-size: 12px;
}
.receive-guide li span {
  display: block;
  font-size: 11px;
  color: var(--muted-foreground);
  margin-top: 5px;
}
.guide-footnote {
  border-top: 1px solid var(--border);
  padding-top: 20px;
  margin-bottom: 0;
}
.movement-panel {
  overflow: hidden;
}
.movement-sku {
  display: block;
  color: var(--muted-foreground);
  font-size: 10px;
}
.movement-note {
  min-width: 150px;
  font-size: 12px;
}
form > .notice {
  margin-top: 18px;
}
@media (max-width: 1100px) {
  .receive-layout {
    grid-template-columns: 1fr;
  }
  .receive-guide {
    display: none;
  }
}
</style>
