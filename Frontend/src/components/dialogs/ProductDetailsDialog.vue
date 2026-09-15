<template>
  <div v-if="product" class="product-details">
    <!-- Header -->
    <div class="details-header">
      <div class="product-main">
        <div class="product-icon">
          <el-icon>
            <Box />
          </el-icon>
        </div>

        <div>
          <div class="product-name">
            <h2>{{ product.name }}</h2>

            <el-tag size="small" :type="product.isActive ? 'success' : 'info'">
              {{ product.isActive ? 'فعال' : 'غیرفعال' }}
            </el-tag>
          </div>

          <span class="sku"> SKU: {{ product.sku }} </span>
        </div>
      </div>
    </div>

    <!-- Basic information -->
    <div class="info-row">
      <div class="info-item">
        <span>دسته‌بندی</span>
        <strong>{{ product.category.name }}</strong>
      </div>

      <div class="info-item">
        <span>واحد</span>
        <strong>{{ product.unit }}</strong>
      </div>

      <div class="info-item">
        <span>موجودی</span>
        <strong
          :class="{
            danger: product.stock <= product.minStock,
          }"
        >
          {{ product.stock }} {{ product.unit }}
        </strong>
      </div>

      <div class="info-item">
        <span>حداقل موجودی</span>
        <strong> {{ product.minStock }} {{ product.unit }} </strong>
      </div>
    </div>

    <!-- Prices -->
    <div class="prices-row">
      <div class="price-item">
        <div class="price-label">
          <span class="dot buy"></span>
          قیمت خرید
        </div>

        <strong>
          {{ money(product.buyPrice) }}
        </strong>
      </div>

      <div class="price-item">
        <div class="price-label">
          <span class="dot sell"></span>
          قیمت فروش
        </div>

        <strong>
          {{ money(product.sellPrice) }}
        </strong>
      </div>
    </div>

    <!-- History -->
    <div class="history">
      <div class="history-header">
        <div class="history-title">
          <el-icon>
            <TrendCharts />
          </el-icon>

          <strong>تاریخچه قیمت</strong>
        </div>

        <span> {{ history.length }} تغییر </span>
      </div>

      <div class="chart">
        <PriceHistoryChart :data="history" />
      </div>
    </div>
  </div>

  <el-skeleton v-else :rows="5" animated />
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Box, TrendCharts } from '@element-plus/icons-vue'

import { productsApi } from '@/services/products'
import type { PriceHistory, Product } from '@/types'

import PriceHistoryChart from '@/components/PriceHistoryChart.vue'

const props = defineProps({
  selectedRow: {
    type: Object,
    required: true,
  },
})

const product = ref<Product>()
const history = ref<PriceHistory[]>([])

const money = (value: number) => {
  return new Intl.NumberFormat('fa-IR').format(value) + ' تومان'
}

onMounted(async () => {
  try {
    ;[product.value, history.value] = await Promise.all([
      productsApi.get(props.selectedRow.id),

      productsApi.history(props.selectedRow.id).then((r) => r.data),
    ])
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا در دریافت اطلاعات محصول')
  }
})
</script>

<style scoped>
.product-details {
  direction: rtl;
}

/* =========================
   Header
========================= */

.details-header {
  padding-bottom: 14px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.product-main {
  display: flex;
  align-items: center;
  gap: 10px;
}

.product-icon {
  width: 38px;
  height: 38px;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 9px;

  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.product-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.product-name h2 {
  margin: 0;

  font-size: 17px;
  font-weight: 700;

  color: var(--el-text-color-primary);
}

.sku {
  display: block;
  margin-top: 3px;

  font-size: 11px;
  color: var(--el-text-color-secondary);
}

/* =========================
   Info
========================= */

.info-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);

  padding: 13px 0;

  border-bottom: 1px solid var(--el-border-color-lighter);
}

.info-item {
  padding: 0 15px;

  display: flex;
  flex-direction: column;
  gap: 4px;

  border-left: 1px solid var(--el-border-color-lighter);
}

.info-item:first-child {
  padding-right: 0;
}

.info-item:last-child {
  border-left: none;
}

.info-item span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.info-item strong {
  font-size: 13px;
  color: var(--el-text-color-primary);
}

.info-item strong.danger {
  color: var(--el-color-danger);
}

/* =========================
   Prices
========================= */

.prices-row {
  display: grid;
  grid-template-columns: 1fr 1fr;

  gap: 12px;

  padding: 13px 0;

  border-bottom: 1px solid var(--el-border-color-lighter);
}

.price-item {
  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 11px 14px;

  border-radius: 8px;

  background: var(--el-fill-color-light);
}

.price-label {
  display: flex;
  align-items: center;
  gap: 7px;

  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.price-item strong {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.dot.buy {
  background: var(--el-color-warning);
}

.dot.sell {
  background: var(--el-color-success);
}

/* =========================
   History
========================= */

.history {
  margin-top: 15px;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 6px;
}

.history-title {
  display: flex;
  align-items: center;
  gap: 7px;

  font-size: 13px;
}

.history-title .el-icon {
  color: var(--el-color-primary);
}

.history-header > span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

@media (max-width: 650px) {
  .info-row {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 12px;
  }

  .info-item {
    border-left: none;
  }

  .prices-row {
    grid-template-columns: 1fr;
  }
}
</style>
