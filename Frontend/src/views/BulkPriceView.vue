<template>
  <div class="bulk-price">
    <p class="muted">
      قیمت خرید یا فروش کالاهای فعال را تغییر دهید. قبل از ثبت، قیمت‌های جدید را در پیش‌نمایش بررسی
      کنید.
    </p>
    <form @submit.prevent="preview">
      <div class="form-grid">
        <label class="form-field"
          ><span>دسته‌بندی</span
          ><select v-model.number="form.categoryId">
            <option :value="undefined">همه دسته‌بندی‌ها</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select></label
        >
        <label class="form-field"
          ><span>قیمت مورد نظر</span
          ><select v-model="form.priceType">
            <option value="SELL">قیمت فروش</option>
            <option value="BUY">قیمت خرید</option>
          </select></label
        >
        <label class="form-field"
          ><span>روش تغییر</span
          ><select v-model="form.type">
            <option value="PERCENTAGE">افزایش درصدی</option>
            <option value="FIXED">جایگزینی با مبلغ ثابت</option>
          </select></label
        >
        <label class="form-field"
          ><span>{{ form.type === 'PERCENTAGE' ? 'درصد افزایش' : 'قیمت جدید · تومان' }}</span
          ><input
            v-model.number="form.value"
            type="number"
            min="0"
            :step="form.type === 'PERCENTAGE' ? '0.1' : '1'"
            required
          /><small>{{
            form.type === 'PERCENTAGE'
              ? 'مثلاً ۱۰ یعنی ده درصد افزایش نسبت به قیمت فعلی.'
              : 'این مبلغ جایگزین قیمت فعلی تمام کالاهای انتخابی می‌شود.'
          }}</small></label
        >
      </div>
      <p v-if="error" class="notice notice--error" role="alert">{{ error }}</p>
      <div class="form-actions">
        <Button type="submit" variant="outline" :disabled="loading || applying"
          ><Eye :size="17" />{{ loading ? 'در حال محاسبه…' : 'محاسبه و پیش‌نمایش' }}</Button
        >
      </div>
    </form>
    <section v-if="previewed" class="bulk-preview">
      <div class="notice">
        <Info :size="18" /><span
          >{{ number(rows.length) }} کالای فعال تحت تأثیر این تغییر قرار می‌گیرد.</span
        >
      </div>
      <div v-if="rows.length" class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>کالا</th>
              <th>قیمت فعلی</th>
              <th>قیمت جدید</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.id">
              <td>{{ row.name }}</td>
              <td class="muted">{{ money(row.oldPrice) }}</td>
              <td class="new-price">{{ money(row.newPrice) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <EmptyState
        v-else
        title="کالای فعالی پیدا نشد"
        description="دسته‌بندی یا وضعیت کالاها را بررسی کنید."
      />
      <div v-if="rows.length" class="form-actions">
        <Button variant="outline" :disabled="applying" @click="previewed = false">انصراف</Button
        ><Button :disabled="applying" @click="apply"
          ><Check :size="17" />{{ applying ? 'در حال اعمال…' : 'تأیید و ثبت قیمت‌ها' }}</Button
        >
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { Check, Eye, Info } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { toast } from '@/lib/toast'
import { money, number } from '@/lib/format'
import { productsApi } from '@/services/products'
import { categoriesApi } from '@/services/categories'
import type { Category } from '@/types'
const emit = defineEmits<{ close: [saved: boolean] }>()
const form = reactive({
  categoryId: undefined as number | undefined,
  type: 'PERCENTAGE',
  value: 10,
  priceType: 'SELL',
})
const categories = ref<Category[]>([])
const rows = ref<{ id: number; name: string; oldPrice: number; newPrice: number }[]>([])
const loading = ref(false),
  applying = ref(false),
  previewed = ref(false),
  error = ref('')
let previewVersion = 0
watch(form, () => {
  previewed.value = false
  rows.value = []
  previewVersion++
})
async function preview() {
  if (
    !Number.isFinite(form.value) ||
    form.value < 0 ||
    (form.type === 'FIXED' && !Number.isInteger(form.value))
  ) {
    error.value = 'مقدار معتبر و غیرمنفی وارد کنید.'
    return
  }
  const version = ++previewVersion
  loading.value = true
  error.value = ''
  try {
    const result = await productsApi.previewBulk({ ...form })
    if (version === previewVersion) {
      rows.value = result.items
      previewed.value = true
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'پیش‌نمایش دریافت نشد.'
  } finally {
    loading.value = false
  }
}
async function apply() {
  if (!previewed.value || !rows.value.length || applying.value) return
  applying.value = true
  error.value = ''
  try {
    const result = await productsApi.bulk({ ...form })
    toast.success(`قیمت ${number(result.affectedProducts)} کالا به‌روز شد.`)
    emit('close', true)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'ثبت قیمت‌ها انجام نشد.'
  } finally {
    applying.value = false
  }
}
onMounted(async () => {
  try {
    categories.value = await categoriesApi.list()
  } catch {
    error.value = 'دسته‌بندی‌ها دریافت نشدند.'
  }
})
</script>
<style scoped>
.bulk-price > p {
  font-size: 12px;
  line-height: 2;
  margin-bottom: 24px;
}
.bulk-preview {
  margin-top: 24px;
  border-top: 1px solid var(--border);
  padding-top: 24px;
}
.bulk-preview .table-scroll {
  margin-top: 16px;
  max-height: 320px;
  border: 1px solid var(--border);
  border-radius: 10px;
}
.new-price {
  color: var(--primary);
  font-weight: 650;
}
form > .notice {
  margin-top: 18px;
}
</style>
