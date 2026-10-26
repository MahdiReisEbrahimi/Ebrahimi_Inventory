<template>
  <div class="bulk-price">
    <p class="muted">
      قیمت خرید، فروش یا هر دو قیمت کالاهای فعال را تغییر دهید. قبل از ثبت، قیمت‌های جدید را در
      پیش‌نمایش بررسی کنید.
    </p>
    <form :id="formId" @submit.prevent="preview">
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
            <option value="BOTH">قیمت خرید و فروش</option>
          </select></label
        >
        <div class="form-field">
          <label for="bulk-change-value">{{
            form.type === 'PERCENTAGE' ? 'درصد افزایش' : 'قیمت جدید · تومان'
          }}</label>
          <div class="change-input">
            <input
              v-if="form.type === 'PERCENTAGE'"
              id="bulk-change-value"
              v-model.number="form.value"
              type="number"
              min="0"
              step="0.1"
              required
            />
            <MoneyInput v-else id="bulk-change-value" v-model="form.value" required />
            <select v-model="form.type" aria-label="روش تغییر">
              <option value="PERCENTAGE">درصدی</option>
              <option value="FIXED">مبلغ ثابت</option>
            </select>
          </div>
          <small>{{
            form.type === 'PERCENTAGE'
              ? 'مثلاً ۱۰ یعنی ده درصد افزایش نسبت به قیمت فعلی.'
              : 'این مبلغ جایگزین قیمت فعلی تمام کالاهای انتخابی می‌شود.'
          }}</small>
        </div>
      </div>

      <DialogActions>
        <Button :form="formId" type="submit" variant="outline" :disabled="loading || applying"
          ><Eye :size="17" />{{ loading ? 'در حال محاسبه…' : 'محاسبه و پیش‌نمایش' }}</Button
        >
      </DialogActions>
    </form>
    <section v-if="previewed" class="bulk-preview">
      <div class="notice">
        <Info :size="18" /><span
          >{{ number(rows.length) }} کالای فعال تحت تأثیر این تغییر قرار می‌گیرد.</span
        >
      </div>
      <div class="table-scroll" :class="{ 'table-scroll--empty': !rows.length }">
        <table class="data-table">
          <thead>
            <tr>
              <th>کالا</th>
              <th v-if="form.priceType === 'BOTH'">نوع قیمت</th>
              <th>قیمت فعلی</th>
              <th>قیمت جدید</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!rows.length" class="table-state-row">
              <td :colspan="form.priceType === 'BOTH' ? 4 : 3" class="table-state-cell">
                <div class="table-state-content">
                  <EmptyState
                    title="کالای فعالی وجود ندارد"
                    description="دسته‌بندی یا وضعیت کالاها را بررسی کنید."
                  />
                </div>
              </td>
            </tr>
            <tr v-for="row in rows" :key="row.id">
              <td>{{ row.name }}</td>
              <template v-if="form.priceType === 'BOTH'">
                <td>
                  <div>خرید</div>
                  <div>فروش</div>
                </td>
                <td class="muted">
                  <div>{{ money(row.oldBuyPrice) }}</div>
                  <div>{{ money(row.oldSellPrice) }}</div>
                </td>
                <td class="new-price">
                  <div>{{ money(row.newBuyPrice) }}</div>
                  <div>{{ money(row.newSellPrice) }}</div>
                </td>
              </template>
              <template v-else>
                <td class="muted">{{ money(row.oldPrice) }}</td>
                <td class="new-price">{{ money(row.newPrice) }}</td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>
      <DialogActions v-if="rows.length">
        <Button variant="outline" :disabled="applying" @click="previewed = false">انصراف</Button
        ><Button :disabled="applying" @click="apply"
          ><Check :size="17" />{{ applying ? 'در حال اعمال…' : 'تأیید و ثبت قیمت‌ها' }}</Button
        >
      </DialogActions>
    </section>
  </div>
</template>
<script setup lang="ts">
import { onMounted, reactive, ref, watch, useId } from 'vue'
import { Check, Eye, Info } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { toast } from '@/lib/toast'
import { money, number, parseNumber } from '@/lib/format'
import { productsApi } from '@/services/products'
import { categoriesApi } from '@/services/categories'
import type { Category } from '@/types'
const formId = useId()
const emit = defineEmits<{ close: [saved: boolean] }>()
const form = reactive({
  categoryId: undefined as number | undefined,
  type: 'PERCENTAGE',
  value: 10 as string | number,
  priceType: 'SELL',
})
const categories = ref<Category[]>([])
const rows = ref<Awaited<ReturnType<typeof productsApi.previewBulk>>['items']>([])
const loading = ref(false),
  applying = ref(false),
  previewed = ref(false)
let previewVersion = 0
watch(
  () => form.type,
  () => {
    const value = parseNumber(form.value)
    form.value = Number.isFinite(value) ? value : ''
  },
)
watch(form, () => {
  previewed.value = false
  rows.value = []
  previewVersion++
})
async function preview() {
  const value = parseNumber(form.value)
  if (!Number.isFinite(value) || value < 0 || (form.type === 'FIXED' && !Number.isInteger(value))) {
    toast.error('مقدار معتبر و غیرمنفی وارد کنید.')
    return
  }
  const version = ++previewVersion
  loading.value = true

  try {
    const result = await productsApi.previewBulk({ ...form, value })
    if (version === previewVersion) {
      rows.value = result.items
      previewed.value = true
    }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'پیش‌نمایش دریافت نشد.')
  } finally {
    loading.value = false
  }
}
async function apply() {
  if (!previewed.value || !rows.value.length || applying.value) return
  applying.value = true

  try {
    const result = await productsApi.bulk({ ...form, value: parseNumber(form.value) })
    toast.success(`قیمت ${number(result.affectedProducts)} کالا به‌روز شد.`)
    emit('close', true)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ثبت قیمت‌ها انجام نشد.')
  } finally {
    applying.value = false
  }
}
onMounted(async () => {
  try {
    categories.value = await categoriesApi.list()
  } catch {
    toast.error('دسته‌بندی‌ها دریافت نشدند.')
  }
})
</script>
<style scoped>
.bulk-price {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 190px);
  min-height: 320px;
}
.bulk-price > p,
.bulk-price > form,
.bulk-preview > .notice {
  flex-shrink: 0;
}

.bulk-price .form-grid {
  grid-template-columns: minmax(0, 1fr);
}
.change-input {
  display: flex;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--input);
  border-radius: 8px;
  background: var(--background);
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.change-input:hover,
.change-input:focus-within {
  border-color: var(--ring);
}
.change-input:focus-within {
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ring) 12%, transparent);
}
.change-input input,
.change-input select {
  border: 0;
  border-radius: 0;
}
.change-input input:focus,
.change-input select:focus {
  outline: none;
  box-shadow: none;
}
.change-input select {
  width: 110px;
  flex-shrink: 0;
  border-inline-start: 1px solid var(--border);
  background-color: var(--secondary);
}
.change-input input {
  min-width: 0;
  flex: 1;
  width: 100%;
  background: transparent;
}
.bulk-preview td > div {
  padding-block: 4px;
}

.bulk-price > p {
  font-size: 12px;
  line-height: 2;
  margin-bottom: 24px;
}
.bulk-preview {
  flex: 1;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  margin-top: 16px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.bulk-preview .table-scroll {
  margin-top: 16px;
  flex: 1;
  min-height: 0;
  max-height: none;
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
