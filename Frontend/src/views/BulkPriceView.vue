<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { productsApi } from '@/services/products'
import { categoriesApi } from '@/services/categories'
import type { Category } from '@/types'
const form = reactive({
    categoryId: undefined as number | undefined,
    type: 'PERCENTAGE',
    value: 0,
    priceType: 'SELL',
  }),
  rows = ref<{ id: number; name: string; oldPrice: number; newPrice: number }[]>([]),
  categories = ref<Category[]>([]),
  loading = ref(false)
categoriesApi
  .list()
  .then((r) => (categories.value = r))
  .catch(() => {})
const money = (v: number) => new Intl.NumberFormat('fa-IR').format(v) + ' تومان'
async function preview() {
  loading.value = true
  try {
    rows.value = (await productsApi.previewBulk(form)).items
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا')
  } finally {
    loading.value = false
  }
}
async function apply() {
  try {
    const r = await productsApi.bulk(form)
    ElMessage.success(`قیمت ${r.affectedProducts} محصول تغییر کرد`)
    rows.value = []
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا')
  }
}
</script>
<template>
  <el-card class="form-card" shadow="never">
    <template #header>
      <b>تغییر گروهی قیمت</b> <span>ابتدا پیش‌نمایش را بررسی و سپس تغییرات را ثبت کنید.</span>
    </template>
    <div class="form-grid">
      <el-select v-model="form.categoryId" placeholder="همه دسته‌ها" clearable>
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>
      <el-select v-model="form.priceType">
        <el-option label="قیمت فروش" value="SELL" /> <el-option label="قیمت خرید" value="BUY" />
      </el-select>
      <el-select v-model="form.type">
        <el-option label="درصدی" value="PERCENTAGE" /> <el-option label="مبلغ ثابت" value="FIXED" />
      </el-select>
      <el-input-number
        v-model="form.value"
        :min="0"
        :placeholder="form.type === 'PERCENTAGE' ? 'درصد' : 'مبلغ'"
        style="width: 100%"
      />
    </div>
    <el-button type="primary" :loading="loading" @click="preview">نمایش پیش‌نمایش</el-button>
  </el-card>
  <el-card v-if="rows.length" shadow="never" class="preview">
    <template #header>
      <b>پیش‌نمایش تغییرات ({{ rows.length }} محصول)</b>
      <el-button type="success" @click="apply">تأیید و اعمال تغییرات</el-button>
    </template>
    <el-table :data="rows">
      <el-table-column prop="name" label="محصول" />
      <el-table-column label="قیمت قبلی">
        <template #default="{ row }">{{ money(row.oldPrice) }}</template>
      </el-table-column>
      <el-table-column label="قیمت جدید">
        <template #default="{ row }">{{ money(row.newPrice) }}</template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
