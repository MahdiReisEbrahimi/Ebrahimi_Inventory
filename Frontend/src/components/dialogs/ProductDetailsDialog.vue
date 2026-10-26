<template>
  <EmptyState v-if="error" title="اطلاعات کالا دریافت نشد" :description="error" error
    ><Button variant="outline" @click="load">تلاش دوباره</Button></EmptyState
  >
  <div v-else-if="!product" class="table-loading" role="status">در حال دریافت شناسنامه کالا…</div>
  <div v-else class="product-details">
    <div class="details-hero">
      <span class="details-icon"><Package :size="26" /></span>
      <div>
        <h2>{{ product.name }}</h2>
        <small>{{ product.category.name }}</small>
      </div>
      <span class="badge" :class="product.isActive ? 'badge--success' : ''">{{
        product.isActive ? 'فعال' : 'غیرفعال'
      }}</span>
    </div>
    <div class="details-stats">
      <div>
        <span>موجودی فعلی</span
        ><strong :class="{ danger: product.stock <= product.minStock }"
          >{{ number(product.stock) }} <small>{{ product.unit }}</small></strong
        >
      </div>
      <div>
        <span>حداقل موجودی</span
        ><strong
          >{{ number(product.minStock) }} <small>{{ product.unit }}</small></strong
        >
      </div>
      <div>
        <span>قیمت خرید</span><strong>{{ money(product.buyPrice) }}</strong>
      </div>
      <div>
        <span>قیمت فروش</span><strong>{{ money(product.sellPrice) }}</strong>
      </div>
    </div>
    <p v-if="product.description" class="product-description">{{ product.description }}</p>
    <div class="history-heading">
      <h3><TrendingUp :size="18" />روند تغییر قیمت</h3>
      <span>{{ number(history.length) }} تغییر اخیر</span>
    </div>
    <PriceHistoryChart :data="history" />
  </div>
</template>
<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue'
import { Package, TrendingUp } from '@lucide/vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
const PriceHistoryChart = defineAsyncComponent(() => import('@/components/PriceHistoryChart.vue'))
import { productsApi } from '@/services/products'
import { money, number } from '@/lib/format'
import type { PriceHistory, Product } from '@/types'
const props = defineProps<{ selectedRow: Product }>()
const product = ref<Product>(),
  history = ref<PriceHistory[]>([]),
  error = ref('')
async function load() {
  error.value = ''
  try {
    const [p, h] = await Promise.all([
      productsApi.get(props.selectedRow.id),
      productsApi.history(props.selectedRow.id),
    ])
    product.value = p
    history.value = h.data
  } catch {
    error.value = 'اتصال به سرور را بررسی و دوباره تلاش کنید.'
  }
}
onMounted(load)
</script>
<style scoped>
.details-hero {
  display: flex;
  align-items: center;
  gap: 14px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--border);
}
.details-hero > div {
  flex: 1;
}
.details-hero h2 {
  font-size: 19px;
  margin: 0;
}
.details-hero small {
  color: var(--muted-foreground);
  font-size: 11px;
}
.details-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 17px;
  color: var(--primary);
  background: var(--accent);
}
.details-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-block: 24px;
}
.details-stats > div {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--background);
}
.details-stats span {
  font-size: 11px;
  color: var(--muted-foreground);
}
.details-stats strong {
  display: block;
  margin-top: 8px;
  font-size: 17px;
}
.details-stats small {
  font-size: 11px;
  font-weight: 400;
}
.product-description {
  font-size: 12px;
  color: var(--muted-foreground);
  white-space: pre-wrap;
}
.history-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.history-heading h3 {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
}
.history-heading span {
  font-size: 11px;
  color: var(--muted-foreground);
}
@media (max-width: 440px) {
  .details-stats strong {
    font-size: 14px;
  }
  .details-hero {
    flex-wrap: wrap;
  }
}
</style>
