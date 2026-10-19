<template>
  <section dir="rtl" class="inventory-page">
    <div class="page-head">
      <div>
        <h2>{{ isTransactions ? 'تراکنش‌های انبار' : 'مدیریت ورود کالا' }}</h2>
        <p>
          {{
            isTransactions
              ? 'گردش ورود، فروش و مرجوعی کالا را مشاهده کنید.'
              : 'ورود خرید و مرجوعی را ثبت کنید تا موجودی به‌روز شود.'
          }}
        </p>
      </div>
    </div>
    <el-card v-if="!isTransactions" shadow="never" class="receive-card">
      <el-form inline @submit.prevent="receive">
        <el-form-item label="نوع عملیات">
          <el-select v-model="form.type" style="width: 150px">
            <el-option label="ورود کالا" value="PURCHASE" />
            <el-option label="مرجوعی فروش" value="RETURN" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="form.type === 'RETURN'" label="فاکتور فروش">
          <el-select
            v-model="form.invoiceId"
            filterable
            placeholder="انتخاب فاکتور"
            style="width: 240px"
          >
            <el-option v-for="i in invoices" :key="i.id" :label="i.number" :value="i.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="محصول">
          <el-select
            v-model="form.productId"
            filterable
            placeholder="انتخاب محصول"
            style="width: 250px"
          >
            <el-option
              v-for="p in products"
              :key="p.id"
              :label="`${p.name} — موجودی ${p.stock}`"
              :value="p.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="تعداد">
          <el-input-number v-model="form.quantity" :min="1" />
        </el-form-item>
        <el-form-item label="قیمت خرید (تومان)">
          <el-input v-model="priceText" inputmode="numeric" @input="onPrice" />
        </el-form-item>
        <el-form-item label="تاریخ">
          <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="توضیحات"> <el-input v-model="form.description" /> </el-form-item>
        <el-button type="primary" :loading="saving" @click="receive">ثبت ورود</el-button>
      </el-form>
    </el-card>
    <el-card shadow="never">
      <template #header> <b>گردش موجودی</b> </template>
      <el-table :data="movements" v-loading="loading" stripe>
        <el-table-column prop="createdAt" label="تاریخ" min-width="160">
          <template #default="s">{{ new Date(s.row.createdAt).toLocaleString('fa-IR') }}</template>
        </el-table-column>
        <el-table-column prop="product.name" label="محصول" min-width="160" />
        <el-table-column label="نوع">
          <template #default="s">
            <el-tag
              :type="
                s.row.type === 'PURCHASE' ? 'success' : s.row.type === 'SALE' ? 'danger' : 'warning'
              "
              >{{ typeLabel(s.row.type) }}</el-tag
            >
          </template>
        </el-table-column>
        <el-table-column prop="quantity" label="تعداد" />
        <el-table-column label="قیمت واحد">
          <template #default="s">{{ money(s.row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column label="فاکتور/توضیحات" min-width="180">
          <template #default="s">{{ s.row.invoice?.number || s.row.description || '—' }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </section>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import type { InventoryMovement, Invoice, Product } from '@/types'
const products = ref<Product[]>([]),
  invoices = ref<Invoice[]>([]),
  movements = ref<InventoryMovement[]>([]),
  loading = ref(false),
  saving = ref(false),
  priceText = ref('')
const isTransactions = useRoute().path === '/transactions'
const form = reactive<{
  productId?: number
  quantity: number
  unitPrice?: number
  date?: string
  description: string
  type: 'PURCHASE' | 'RETURN'
  invoiceId?: number
}>({ quantity: 1, description: '', type: 'PURCHASE' })
const money = (v: number | null) =>
  v == null ? '—' : `${new Intl.NumberFormat('fa-IR').format(v)} تومان`
const typeLabel = (v: string) =>
  ({ PURCHASE: 'ورود کالا', SALE: 'فروش', RETURN: 'مرجوعی', ADJUSTMENT: 'اصلاح موجودی' })[v] || v
function onPrice(v: string) {
  const n = Number(
    v
      .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/\D/g, ''),
  )
  form.unitPrice = n || undefined
  priceText.value = n ? new Intl.NumberFormat('fa-IR').format(n) : ''
}
async function load() {
  loading.value = true
  try {
    const [p, m, i] = await Promise.all([
      productsApi.list({ page: 1, limit: 10000, isActive: true }),
      inventoryApi.movements(),
      inventoryApi.invoices(),
    ])
    products.value = p.data
    movements.value = m
    invoices.value = i
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'دریافت اطلاعات ناموفق بود.')
  } finally {
    loading.value = false
  }
}
async function receive() {
  if (!form.productId || form.quantity < 1 || (form.type === 'RETURN' && !form.invoiceId)) {
    ElMessage.warning('محصول، تعداد و در صورت مرجوعی فاکتور را انتخاب کنید.')
    return
  }
  saving.value = true
  try {
    await inventoryApi.receive({ ...form })
    ElMessage.success(form.type === 'RETURN' ? 'مرجوعی ثبت شد.' : 'ورود کالا ثبت شد.')
    form.productId = undefined
    form.quantity = 1
    form.unitPrice = undefined
    form.description = ''
    form.invoiceId = undefined
    priceText.value = ''
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'ثبت ورود ناموفق بود.')
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.inventory-page {
  display: grid;
  gap: 18px;
}
.page-head h2 {
  margin: 0 0 5px;
}
.page-head p {
  margin: 0;
  color: var(--el-text-color-secondary);
}
.receive-card :deep(.el-form) {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}
</style>
