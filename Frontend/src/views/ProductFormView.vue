<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { categoriesApi } from '@/services/categories'
import { productsApi } from '@/services/products'
import type { Category } from '@/types'
const route = useRoute(),
  router = useRouter(),
  id = Number(route.params.id),
  editing = Boolean(id),
  categories = ref<Category[]>([]),
  saving = ref(false)
const form = reactive({
  name: '',
  sku: '',
  categoryId: undefined as number | undefined,
  unit: 'عدد',
  buyPrice: 0,
  sellPrice: 0,
  minStock: 0,
  description: '',
})
const rules = {
  name: [{ required: true, message: 'نام محصول الزامی است' }],
  sku: [{ required: true, message: 'کد کالا الزامی است' }],
  categoryId: [{ required: true, message: 'دسته‌بندی را انتخاب کنید' }],
}
onMounted(async () => {
  try {
    categories.value = await categoriesApi.list()
    if (editing) Object.assign(form, await productsApi.get(id))
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا در دریافت اطلاعات')
  }
})
async function submit() {
  if (!form.categoryId) return ElMessage.warning('دسته‌بندی را انتخاب کنید')
  saving.value = true
  try {
    const p = editing ? await productsApi.update(id, form) : await productsApi.create(form)
    ElMessage.success('اطلاعات محصول ذخیره شد')
    router.push(`/products/${p.id}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا')
  } finally {
    saving.value = false
  }
}
</script>
<template>
  <el-card class="form-card" shadow="never"
    ><template #header
      ><b>{{ editing ? 'ویرایش اطلاعات محصول' : 'ثبت محصول جدید' }}</b
      ><span>موجودی اولیه از بخش انبار ثبت می‌شود.</span></template
    ><el-form :model="form" :rules="rules" label-position="top" @submit.prevent="submit"
      ><div class="form-grid">
        <el-form-item label="نام محصول" prop="name"><el-input v-model="form.name" /></el-form-item
        ><el-form-item label="کد کالا (SKU)" prop="sku"
          ><el-input v-model="form.sku" /></el-form-item
        ><el-form-item label="دسته‌بندی" prop="categoryId"
          ><el-select v-model="form.categoryId" style="width: 100%"
            ><el-option
              v-for="c in categories"
              :key="c.id"
              :label="c.name"
              :value="c.id" /></el-select></el-form-item
        ><el-form-item label="واحد"><el-input v-model="form.unit" /></el-form-item
        ><el-form-item label="قیمت خرید (تومان)"
          ><el-input-number
            v-model="form.buyPrice"
            :min="0"
            controls-position="right"
            style="width: 100%" /></el-form-item
        ><el-form-item label="قیمت فروش (تومان)"
          ><el-input-number
            v-model="form.sellPrice"
            :min="0"
            controls-position="right"
            style="width: 100%" /></el-form-item
        ><el-form-item label="حداقل موجودی"
          ><el-input-number
            v-model="form.minStock"
            :min="0"
            controls-position="right"
            style="width: 100%"
        /></el-form-item>
      </div>
      <el-form-item label="توضیحات"
        ><el-input v-model="form.description" type="textarea" :rows="4"
      /></el-form-item>
      <div class="form-actions">
        <el-button @click="router.back()">انصراف</el-button
        ><el-button type="primary" native-type="submit" :loading="saving">ذخیره محصول</el-button>
      </div></el-form
    ></el-card
  >
</template>
