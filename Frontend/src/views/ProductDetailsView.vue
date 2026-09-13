<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { productsApi } from '@/services/products'
import type { PriceHistory, Product } from '@/types'
const id = Number(useRoute().params.id),
  product = ref<Product>(),
  history = ref<PriceHistory[]>([])
const money = (v: number) => new Intl.NumberFormat('fa-IR').format(v) + ' تومان'
onMounted(async () => {
  try {
    ;[product.value, history.value] = await Promise.all([
      productsApi.get(id),
      productsApi.history(id).then((r) => r.data),
    ])
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا در دریافت محصول')
  }
})
</script>
<template>
  <div v-if="product">
    <div class="details-heading">
      <div>
        <el-tag :type="product.isActive ? 'success' : 'info'">{{
          product.isActive ? 'فعال' : 'غیرفعال'
        }}</el-tag>
        <h2>{{ product.name }}</h2>
        <span>{{ product.sku }}</span>
      </div>
      <router-link :to="`/products/${id}/edit`"
        ><el-button type="primary">ویرایش محصول</el-button></router-link
      >
    </div>
    <div class="details-grid">
      <el-card shadow="never"
        ><h3>اطلاعات و موجودی</h3>
        <dl>
          <dt>دسته‌بندی</dt>
          <dd>{{ product.category.name }}</dd>
          <dt>واحد</dt>
          <dd>{{ product.unit }}</dd>
          <dt>موجودی فعلی</dt>
          <dd :class="{ danger: product.stock <= product.minStock }">
            {{ product.stock }} {{ product.unit }}
          </dd>
          <dt>حداقل موجودی</dt>
          <dd>{{ product.minStock }}</dd>
        </dl></el-card
      ><el-card shadow="never"
        ><h3>قیمت‌ها</h3>
        <dl>
          <dt>قیمت خرید</dt>
          <dd>{{ money(product.buyPrice) }}</dd>
          <dt>قیمت فروش</dt>
          <dd class="price">{{ money(product.sellPrice) }}</dd>
        </dl></el-card
      >
    </div>
    <el-card shadow="never"
      ><template #header><b>تاریخچه تغییر قیمت</b></template
      ><el-table dir="rtl" :data="history"
        ><el-table-column label="تاریخ"
          ><template #default="{ row }">{{
            new Date(row.createdAt).toLocaleDateString('fa-IR')
          }}</template></el-table-column
        ><el-table-column label="قیمت قبل"
          ><template #default="{ row }">{{
            row.oldPrice === null ? '—' : money(row.oldPrice)
          }}</template></el-table-column
        ><el-table-column label="قیمت جدید"
          ><template #default="{ row }">{{
            row.newPrice === null ? '—' : money(row.newPrice)
          }}</template></el-table-column
        ><el-table-column label="نوع"
          ><template #default="{ row }">{{
            row.type === 'BULK' ? 'گروهی' : 'تکی'
          }}</template></el-table-column
        ></el-table
      ></el-card
    >
  </div>
  <el-skeleton v-else :rows="8" animated />
</template>
