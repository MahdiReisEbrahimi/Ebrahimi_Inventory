<template>
  <form class="stock-form" @submit.prevent="receive">
    <div class="stock-product">
      <span class="stock-product__icon"><Package :size="24" /></span>
      <div>
        <strong>{{ product.name }}</strong>
        <small>موجودی: {{ number(product.stock) }} {{ product.unit }}</small>
      </div>
    </div>
    <div v-if="type === 'RETURN'" class="return-invoice">
      <p v-if="loading" class="muted" role="status">در حال دریافت فاکتورهای فروش…</p>
      <p v-else-if="loadError" class="notice notice--error" role="alert">
        {{ loadError }}<Button variant="outline" @click="loadInvoices">تلاش دوباره</Button>
      </p>
      <label v-else-if="invoices.length" class="form-field">
        <span>فاکتور فروش مربوط به مرجوعی</span>
        <select v-model.number="form.invoiceId" required :disabled="saving">
          <option :value="undefined" disabled>فاکتور را انتخاب کنید</option>
          <option v-for="invoice in invoices" :key="invoice.id" :value="invoice.id">
            {{ invoice.number }} · {{ invoice.buyerFirstName }} {{ invoice.buyerLastName }}
          </option>
        </select>
        <small>فقط فاکتورهای شامل این کالا از میان ۵۰۰ فاکتور اخیر نمایش داده می‌شوند.</small>
      </label>
      <p v-else class="notice" role="status">
        در ۵۰۰ فاکتور اخیر، فاکتور فروشی برای این کالا پیدا نشد.
      </p>
    </div>
    <fieldset class="stock-fields" :disabled="saving">
      <div class="form-grid">
        <label class="form-field">
          <span>تعداد {{ type === 'RETURN' ? 'مرجوعی' : 'خرید' }} · {{ product.unit }}</span>
          <input v-model.number="form.quantity" type="number" min="1" step="1" required />
        </label>
        <label class="form-field">
          <span>قیمت خرید واحد <small>اختیاری · تومان</small></span>
          <MoneyInput v-model="priceText" placeholder="قیمت فعلی حفظ شود" />
          <small>با وارد کردن مبلغ، قیمت خرید کالا به‌روز می‌شود.</small>
        </label>
        <label class="form-field">
          <span>تاریخ <small>اختیاری</small></span>
          <input v-model="form.date" type="date" />
        </label>
        <label class="form-field">
          <span>توضیحات <small>اختیاری</small></span>
          <input v-model="form.description" placeholder="شماره رسید یا دلیل مرجوعی" />
        </label>
      </div>
    </fieldset>
    <div v-if="Number.isInteger(form.quantity) && form.quantity > 0" class="stock-preview">
      <span>موجودی پس از ثبت</span>
      <strong
        >{{ number(product.stock + form.quantity) }} <small>{{ product.unit }}</small></strong
      >
    </div>
    <p v-if="formError" class="notice notice--error" role="alert">{{ formError }}</p>
    <div class="form-actions">
      <Button type="button" variant="outline" :disabled="saving" @click="emit('close', false)">
        انصراف
      </Button>
      <Button type="submit" :disabled="saving || !canSubmit">
        <Check :size="17" />{{
          saving ? 'در حال ثبت…' : type === 'RETURN' ? 'ثبت مرجوعی' : 'ثبت خرید'
        }}
      </Button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { Check, Package } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { inventoryApi } from '@/services/inventory'
import { number, parseNumber } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Invoice, Product } from '@/types'

const props = defineProps<{ product: Product; type: 'PURCHASE' | 'RETURN' }>()
const emit = defineEmits<{ close: [saved: boolean] }>()
const form = reactive({
  quantity: 1,
  date: '',
  description: '',
  invoiceId: undefined as number | undefined,
})
const priceText = ref('')
const saving = ref(false)
const loading = ref(props.type === 'RETURN')
const loadError = ref('')
const formError = ref('')
const invoices = ref<Invoice[]>([])
const canSubmit = computed(
  () =>
    props.type === 'PURCHASE' ||
    (!loading.value &&
      !loadError.value &&
      invoices.value.some((invoice) => invoice.id === form.invoiceId)),
)

async function loadInvoices() {
  loading.value = true
  loadError.value = ''
  try {
    invoices.value = (await inventoryApi.invoices()).filter((invoice) =>
      invoice.items.some((item) => item.productId === props.product.id),
    )
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : 'دریافت فاکتورهای فروش ممکن نشد.'
  } finally {
    loading.value = false
  }
}

async function receive() {
  if (saving.value || !canSubmit.value) return
  formError.value = ''
  if (!Number.isSafeInteger(form.quantity) || form.quantity < 1) {
    formError.value = 'تعداد باید عدد صحیح و بزرگ‌تر از صفر باشد.'
    return
  }
  const unitPrice = priceText.value.trim() ? parseNumber(priceText.value) : undefined
  if (unitPrice !== undefined && (!Number.isSafeInteger(unitPrice) || unitPrice < 0)) {
    formError.value = 'قیمت خرید باید عدد صحیح و غیرمنفی باشد.'
    return
  }
  saving.value = true
  try {
    await inventoryApi.receive({
      productId: props.product.id,
      quantity: form.quantity,
      type: props.type,
      unitPrice,
      description: form.description,
      date: form.date || undefined,
      invoiceId: props.type === 'RETURN' ? form.invoiceId : undefined,
    })
    toast.success(
      props.type === 'RETURN' ? 'مرجوعی ثبت و موجودی به‌روز شد.' : 'خرید ثبت و موجودی به‌روز شد.',
    )
    emit('close', true)
  } catch (error) {
    formError.value = error instanceof Error ? error.message : 'ثبت انجام نشد.'
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (props.type === 'RETURN') void loadInvoices()
})
</script>

<style scoped>
.stock-form {
  display: grid;
  gap: 20px;
}
.stock-product {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--secondary);
}
.stock-product__icon {
  color: var(--primary);
}
.stock-product small {
  display: block;
  margin-top: 5px;
  color: var(--muted-foreground);
}
.stock-fields {
  padding: 0;
  margin: 0;
  border: 0;
  min-width: 0;
}
.stock-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  background: var(--accent);
  border-radius: 12px;
  color: var(--accent-foreground);
}
.stock-preview strong {
  font-size: 22px;
}
.stock-preview small {
  font-size: 12px;
  font-weight: 400;
}
.stock-form .notice,
.stock-form .form-actions {
  margin: 0;
}
</style>
