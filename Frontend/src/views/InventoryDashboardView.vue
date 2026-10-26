<template>
  <div class="page-stack dashboard-page">
    <section class="welcome-banner">
      <div>
        <span class="welcome-caption">مدیریت ساده، فروش منظم</span>
        <h2>از موجودی تا فاکتور،<br />همه چیز سر جای خودش.</h2>
        <p>برای شروع، کالای تازه ثبت کنید یا موجودی انبار را به‌روز کنید.</p>
        <div class="welcome-actions">
          <RouterLink to="/products" class="button welcome-button"
            ><ArrowDownToLine :size="17" />ثبت ورود کالا</RouterLink
          ><RouterLink to="/products/new" class="welcome-link"
            >افزودن کالای جدید<ArrowLeft :size="16"
          /></RouterLink>
        </div>
      </div>
      <div class="inventory-illustration" aria-hidden="true">
        <div class="illustration-orbit" />
        <div class="illustration-box box-back"><Package :size="55" :stroke-width="1" /></div>
        <div class="illustration-box box-front"><Boxes :size="70" :stroke-width="1" /></div>
        <span class="illustration-check"><Check :size="22" /></span
        ><span class="illustration-label">هر کالا، حساب‌شده</span>
      </div>
    </section>
    <div v-if="error" class="notice notice--error" role="alert">
      <CircleAlert :size="18" /><span>{{ error }}</span
      ><button class="button button--small button--outline" @click="load">تلاش دوباره</button>
    </div>
    <div v-if="loading" class="table-loading panel" role="status">در حال دریافت وضعیت فروشگاه…</div>
    <template v-else-if="!error">
      <div class="stat-grid">
        <StatCard
          label="کالاهای ثبت‌شده"
          :value="number(totalProducts)"
          unit="کالا"
          :icon="Package"
          hint="همه کالاهای فعال و غیرفعال"
        />
        <StatCard
          label="ارزش موجودی"
          :value="number(stockValue)"
          unit="تومان"
          :icon="Wallet"
          :hint="partial ? 'بر اساس کالاهای دریافت‌شده' : 'بر اساس قیمت خرید کالاهای فعال'"
        />
        <StatCard
          label="نیازمند تأمین"
          :value="number(lowStock.length)"
          unit="کالا"
          :icon="TriangleAlert"
          warning
          hint="موجودی برابر یا کمتر از حداقل"
        />
        <StatCard
          label="کالاهای فعال"
          :value="number(activeProducts.length)"
          unit="کالا"
          :icon="CircleCheck"
          hint="آماده استفاده در فاکتور فروش"
        />
      </div>
      <p v-if="partial" class="notice">
        این نمای کلی بر اساس ۱۰٬۰۰۰ کالای دریافت‌شده است؛ تعداد کل از سرور دریافت می‌شود.
      </p>
      <div class="dashboard-columns">
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>کالاهای نیازمند توجه</h2>
              <p>پیش از تمام شدن موجودی، برای تأمین اقدام کنید.</p>
            </div>
            <RouterLink
              :to="{ path: '/products', query: { lowStock: 'true' } }"
              class="button button--ghost button--small"
              >همه کالاها<ArrowLeft :size="15"
            /></RouterLink>
          </div>
          <div v-if="lowStock.length" class="attention-list">
            <RouterLink
              v-for="product in lowStock.slice(0, 5)"
              :key="product.id"
              :to="{ path: '/products', query: { search: product.name } }"
              class="attention-row"
            >
              <span class="product-glyph"><Package :size="21" /></span>
              <div>
                <b>{{ product.name }}</b
                ><small>{{ product.category.name }}</small>
              </div>
              <span class="badge badge--warning"
                >{{ number(product.stock) }} {{ product.unit }}</span
              >
            </RouterLink>
          </div>
          <EmptyState
            v-else
            title="موجودی‌ها کافی هستند"
            description="هیچ کالای فعالی به حداقل موجودی نرسیده است."
          />
        </section>
        <section class="panel">
          <div class="panel-heading">
            <div>
              <h2>ترکیب کالاهای فروشگاه</h2>
              <p>تعداد کالاهای فعال در هر دسته‌بندی</p>
            </div>
            <ChartNoAxesColumn :size="21" class="muted" />
          </div>
          <div v-if="categoryGroups.length" class="category-summary">
            <div
              v-for="category in categoryGroups.slice(0, 5)"
              :key="category.name"
              class="category-summary__row"
            >
              <div>
                <span>{{ category.name }}</span
                ><b>{{ number(category.count) }} کالا</b>
              </div>
              <div class="category-track">
                <span :style="{ width: (category.count / activeProducts.length) * 100 + '%' }" />
              </div>
            </div>
          </div>
          <EmptyState
            v-else
            title="فروشگاه را با اولین کالا شروع کنید"
            description="پس از ثبت کالا، ترکیب دسته‌بندی‌ها در این بخش نمایش داده می‌شود."
            ><RouterLink to="/products/new" class="button button--outline"
              >ثبت کالای جدید</RouterLink
            ></EmptyState
          >
        </section>
      </div>
      <section class="panel table-panel">
        <div class="panel-heading">
          <div>
            <h2>آخرین گردش‌های موجودی</h2>
            <p>آخرین ورودها، فروش‌ها و مرجوعی‌های ثبت‌شده</p>
          </div>
          <RouterLink to="/transactions" class="button button--ghost button--small"
            >مشاهده همه<ArrowLeft :size="15"
          /></RouterLink>
        </div>
        <div class="table-scroll" :class="{ 'table-scroll--empty': !movements.length }">
          <table class="data-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>نوع عملیات</th>
                <th>تعداد</th>
                <th>تاریخ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!movements.length" class="table-state-row">
                <td colspan="4" class="table-state-cell">
                  <div class="table-state-content">
                    <EmptyState
                      title="هنوز گردشی ثبت نشده"
                      description="با ثبت ورود کالا یا صدور اولین فاکتور، فعالیت‌های فروشگاه اینجا دیده می‌شوند."
                    />
                  </div>
                </td>
              </tr>
              <tr v-for="item in movements.slice(0, 5)" :key="item.id">
                <td>
                  <b>{{ item.product.name }}</b>
                </td>
                <td>
                  <span
                    class="badge"
                    :class="item.type === 'SALE' ? 'badge--primary' : 'badge--success'"
                    >{{ movementLabel(item.type) }}</span
                  >
                </td>
                <td>{{ number(item.quantity) }} {{ item.product.unit }}</td>
                <td>{{ date(item.createdAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ArrowDownToLine,
  ArrowLeft,
  Boxes,
  ChartNoAxesColumn,
  Check,
  CircleAlert,
  CircleCheck,
  Package,
  TriangleAlert,
  Wallet,
} from '@lucide/vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import StatCard from '@/components/ui/StatCard.vue'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import { number, date } from '@/lib/format'
import type { Product, InventoryMovement } from '@/types'
const products = ref<Product[]>([])
const movements = ref<InventoryMovement[]>([])
const totalProducts = ref(0)
const loading = ref(true)
const error = ref('')
const partial = computed(() => totalProducts.value > products.value.length)
const activeProducts = computed(() => products.value.filter((p) => p.isActive))
const lowStock = computed(() =>
  activeProducts.value.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock - b.stock),
)
const stockValue = computed(() =>
  activeProducts.value.reduce((sum, p) => sum + p.stock * p.buyPrice, 0),
)
const categoryGroups = computed(() => {
  const groups = new Map<string, number>()
  activeProducts.value.forEach((p) =>
    groups.set(p.category.name, (groups.get(p.category.name) || 0) + 1),
  )
  return [...groups].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
})
const movementLabel = (type: string) =>
  ({ PURCHASE: 'ورود کالا', SALE: 'فروش', RETURN: 'مرجوعی', ADJUSTMENT: 'اصلاح موجودی' })[type] ||
  type
async function load() {
  loading.value = true
  error.value = ''
  try {
    const [result, activity] = await Promise.all([
      productsApi.list({ page: 1, limit: 10000 }),
      inventoryApi.movements(),
    ])
    products.value = result.data
    totalProducts.value = result.meta.total
    movements.value = activity
  } catch {
    error.value = 'دریافت اطلاعات فروشگاه ممکن نشد. اتصال به سرور را بررسی کنید.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
.dashboard-page > .table-panel {
  flex: 1;
  min-height: 320px;
}

.welcome-banner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 30px 36px;
  border-radius: 20px;
  background: var(--secondary);
  border: 1px solid var(--border);
  overflow: hidden;
}
.welcome-caption {
  color: var(--primary);
  font-size: 11px;
  font-weight: 650;
}
.welcome-banner h2 {
  font-size: clamp(22px, 2.3vw, 30px);
  margin: 10px 0;
  line-height: 1.6;
  letter-spacing: -0.5px;
}
.welcome-banner p {
  color: var(--muted-foreground);
  font-size: 12px;
  margin-bottom: 20px;
}
.welcome-actions {
  display: flex;
  gap: 22px;
  align-items: center;
  flex-wrap: wrap;
}
.welcome-button {
  background: var(--primary);
  color: var(--primary-foreground);
}
.welcome-link {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  font-size: 12px;
  color: var(--primary);
  font-weight: 650;
}
.inventory-illustration {
  width: 260px;
  height: 230px;
  position: relative;
  flex-shrink: 0;
  margin-inline-end: 35px;
}
.illustration-orbit {
  position: absolute;
  inset: 5px;
  border: 1px dashed color-mix(in srgb, var(--primary) 25%, transparent);
  border-radius: 50%;
  transform: rotate(-20deg);
}
.illustration-box {
  position: absolute;
  border: 1px solid var(--border);
  border-radius: 24px;
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-lg);
}
.box-back {
  width: 115px;
  height: 115px;
  top: 15px;
  left: 20px;
  color: var(--primary);
  background: var(--card);
  transform: rotate(-12deg);
}
.box-front {
  width: 144px;
  height: 144px;
  bottom: 30px;
  right: 10px;
  color: var(--primary-foreground);
  background: var(--primary);
  transform: rotate(9deg);
}
.illustration-check {
  position: absolute;
  top: 26px;
  right: 6px;
  width: 43px;
  height: 43px;
  border-radius: 50%;
  background: var(--card);
  color: var(--success);
  display: grid;
  place-items: center;
  box-shadow: var(--shadow-sm);
}
.illustration-label {
  position: absolute;
  bottom: 8px;
  left: 28px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 9px 14px;
  font-size: 11px;
  transform: rotate(-5deg);
}
.dashboard-columns {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 22px;
  min-width: 0;
}
.attention-list {
  padding-inline: 24px;
}
.attention-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 17px 0;
  border-bottom: 1px solid var(--border);
  font-size: 12px;
}
.attention-row:last-child {
  border-bottom: 0;
}
.attention-row > div {
  flex: 1;
  min-width: 0;
}
.attention-row small {
  display: block;
  font-size: 10px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.product-glyph {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  color: var(--primary);
  background: var(--muted);
}
.category-summary {
  padding: 24px;
  display: grid;
  gap: 24px;
}
.category-summary__row > div:first-child {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 12px;
}
.category-summary__row b {
  font-size: 11px;
  font-weight: 500;
  color: var(--muted-foreground);
}
.category-track {
  height: 7px;
  background: var(--muted);
  border-radius: 6px;
  overflow: hidden;
}
.category-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--primary);
  opacity: 0.8;
}
@media (max-width: 1100px) {
  .dashboard-columns {
    grid-template-columns: 1fr;
  }
  .inventory-illustration {
    margin: 0;
    width: 210px;
  }
}
@media (max-width: 640px) {
  .welcome-banner {
    padding: 24px;
  }
  .inventory-illustration {
    display: none;
  }
  .welcome-actions {
    gap: 15px;
  }
}
</style>
