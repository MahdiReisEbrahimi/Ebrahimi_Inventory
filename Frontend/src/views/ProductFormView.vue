<template>
  <el-form :model="form" :rules="rules" label-position="top" @submit.prevent="submit">
    <div class="form-grid">
      <el-form-item label="نام محصول" prop="name">
        <el-input v-model="form.name" />
      </el-form-item>
      <el-form-item label="کد کالا (SKU)" prop="sku">
        <el-input v-model="form.sku" />
      </el-form-item>
      <el-form-item label="دسته‌بندی" prop="categoryId">
        <el-select v-model="form.categoryId" style="width: 100%">
          <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="واحد"> <el-input v-model="form.unit" /> </el-form-item>
      <el-form-item label="قیمت خرید (تومان)">
        <el-input
          type="text"
          v-model="form.buyPrice"
          @input="form.buyPrice = handlePriceInput(form.buyPrice)"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="قیمت فروش (تومان)">
        <el-input
          type="text"
          v-model="form.sellPrice"
          @input="form.sellPrice = handlePriceInput(form.sellPrice)"
          controls-position="right"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="حداقل موجودی">
        <el-input-number v-model="form.minStock" :min="0" style="width: 100%" />
      </el-form-item>
    </div>
    <el-form-item label="توضیحات">
      <el-input v-model="form.description" type="textarea" :rows="4" />
    </el-form-item>
    <div class="form-actions">
      <el-button @click="emits('close', false)">انصراف</el-button>
      <el-button
        v-if="props.editData"
        @click="resetEditForm"
        type="warning"
        style="margin-left: 0px"
        >بازنشانی</el-button
      >
      <el-button type="primary" native-type="submit" :loading="saving" style="margin-left: 0px">
        {{ props.editData ? 'ویرایش محصول' : 'ذخیره محصول' }}
      </el-button>
    </div>
  </el-form>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { categoriesApi } from '@/services/categories'
import { productsApi } from '@/services/products'
import type { Category } from '@/types'
import { handlePriceInput } from '@/utils/general'

const emits = defineEmits(['close'])
const props = defineProps({
  editData: {
    type: Object,
    required: false,
  },
})

let id = 0
const route = useRoute(),
  router = useRouter(),
  editing = Boolean(id),
  categories = ref<Category[]>([]),
  saving = ref(false)
const form = reactive({
  name: '',
  sku: '',
  categoryId: undefined as number | undefined,
  unit: 'عدد',
  buyPrice: '0' as number | string,
  sellPrice: '0' as number | string,
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

  if (props.editData) {
    resetEditForm()
    id = props.editData.id
  }
})
async function submit() {
  if (!form.categoryId) return ElMessage.warning('دسته‌بندی را انتخاب کنید')
  saving.value = true
  try {
    const submitData = {
      ...form,
    }
    submitData.sellPrice = Number((form.sellPrice as string).split(',').join(''))
    submitData.buyPrice = Number((form.buyPrice as string).split(',').join(''))

    const p = props.editData
      ? await productsApi.update(id, submitData)
      : await productsApi.create(submitData)
    ElMessage.success(props.editData ? 'اطلاعات محصول ویرایش شد' : 'اطلاعات محصول ذخیره شد')
    emits('close', true)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا')
  } finally {
    saving.value = false
  }
}

function resetEditForm() {
  if (!props.editData) return

  form.name = props.editData.name
  form.sku = props.editData.sku
  form.categoryId = props.editData.categoryId
  form.unit = props.editData.unit
  form.buyPrice = handlePriceInput(String(props.editData.buyPrice))
  form.sellPrice = handlePriceInput(String(props.editData.sellPrice))
  form.minStock = props.editData.minStock
  form.description = props.editData.description
}
</script>
<style scoped>
.form-grid,
.details-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0 20px;
}
.form-actions {
  display: flex;
  justify-content: end;
  gap: 10px;
  width: 100%;
}
</style>
