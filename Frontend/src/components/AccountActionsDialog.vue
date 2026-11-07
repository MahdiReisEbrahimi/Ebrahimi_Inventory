<template>
  <AppDialog
    :open="!!mode"
    :title="mode === 'RETURN' ? 'ثبت مرجوعی صورت‌حساب' : 'نهایی‌کردن صورت‌حساب'"
    width="820px"
    @update:open="!$event && !saving && emit('close')"
  >
    <p v-if="loading" role="status">در حال دریافت صورت‌حساب…</p>
    <p v-else-if="loadError" class="notice notice--error" role="alert">
      {{ loadError }} <Button variant="outline" @click="load">تلاش دوباره</Button>
    </p>
    <form v-else :id="formId" @submit.prevent="save">
      <template v-if="mode === 'RETURN'">
        <p class="muted">
          تعداد مرجوعی را از مجموع کالاهای این طرف حساب وارد کنید. ابتدا تحویل‌های قدیمی‌تر با قیمت
          همان زمان برگشت می‌خورند.
        </p>
        <div class="table-scroll action-items">
          <table class="data-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>قابل مرجوعی</th>
                <th>قیمت هنگام تحویل</th>
                <th>تعداد مرجوعی</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="product in products" :key="product.productId">
                <td>{{ product.name }}</td>
                <td>{{ number(product.quantity) }} {{ product.unit }}</td>
                <td>{{ historicalPrice(product) }}</td>
                <td>
                  <NumberInput
                    v-model="quantities[product.productId]!"
                    :min="0"
                    :max="product.quantity"
                    :disabled="saving"
                    :aria-label="`تعداد مرجوعی ${product.name}`"
                  />
                </td>
              </tr>
              <tr v-if="!products.length">
                <td colspan="4">کالای قابل مرجوعی برای این طرف حساب وجود ندارد.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <label class="form-field"
          ><span>توضیحات مرجوعی</span
          ><textarea v-model="notes" maxlength="1000" rows="2" :disabled="saving" />
        </label>
      </template>
      <template v-else-if="quote">
        <p class="muted">
          فاکتورهای باز این طرف حساب یک‌جا نهایی می‌شوند. قیمت نسیه‌ها به قیمت روز محاسبه می‌شود و
          پرداخت‌ها از مانده کل صورت‌حساب کم می‌شوند.
        </p>
        <div v-if="quote.invoices.length" class="table-scroll action-items">
          <table class="data-table">
            <thead>
              <tr>
                <th>کالا</th>
                <th>تعداد</th>
                <th>فی (تومان)</th>
                <th>جمع (تومان)</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="document in quote.invoices" :key="document.id"
                ><tr v-for="line in document.items" :key="line.id">
                  <td>{{ line.name }}</td>
                  <td>{{ number(line.quantity) }}</td>
                  <td>{{ number(line.unitPrice || 0) }}</td>
                  <td>{{ number(line.total || 0) }}</td>
                </tr></template
              >
            </tbody>
          </table>
        </div>
        <label v-if="quote.invoices.length" class="form-field"
          ><span>اعمال تخفیف به اقلام باز صورت‌حساب (تومان)</span
          ><MoneyInput v-model="discountText" :disabled="saving"
        /></label>
        <p v-if="refreshing" role="status" class="muted">در حال محاسبه تخفیف و مرجوعی‌ها…</p>
        <dl class="action-summary">
          <div>
            <dt>مبلغ خالص کل صورت‌حساب پس از تخفیف و مرجوعی</dt>
            <dd>{{ money(quote.total) }}</dd>
          </div>
          <div>
            <dt>خالص پرداختی / بیعانه قبلی</dt>
            <dd>{{ money(quote.paid) }}</dd>
          </div>
        </dl>
        <label class="form-field"
          ><span>پرداخت جدید هنگام نهایی‌کردن (تومان)</span
          ><MoneyInput v-model="paymentText" :disabled="saving"
        /></label>
        <Button
          variant="ghost"
          :disabled="saving || refreshing"
          @click="paymentText = number(Math.max(0, remaining))"
          >پرداخت تمام مانده صورت‌حساب</Button
        >
        <p>
          <strong
            >{{
              afterPayment > 0
                ? 'مانده قابل پرداخت'
                : afterPayment < 0
                  ? 'بستانکاری طرف حساب'
                  : 'تسویه کامل'
            }}: {{ money(Math.abs(afterPayment)) }}</strong
          >
        </p>
      </template>
      <p v-if="error" role="alert" class="notice notice--error">{{ error }}</p>
    </form>
    <DialogActions
      ><Button variant="outline" :disabled="saving" @click="emit('close')">انصراف</Button
      ><Button
        v-if="mode === 'FINALIZE' && quote"
        variant="outline"
        :disabled="saving || loading || refreshing"
        @click="refreshQuote"
        >به‌روزرسانی محاسبه</Button
      ><Button
        :form="formId"
        type="submit"
        :disabled="
          saving ||
          loading ||
          !!loadError ||
          refreshing ||
          (mode === 'FINALIZE' && !quoteReady) ||
          (mode === 'RETURN' && !products.length)
        "
        >{{
          saving
            ? 'در حال ثبت…'
            : mode === 'RETURN'
              ? 'ثبت مرجوعی صورت‌حساب'
              : 'ثبت و نمایش صورت‌حساب نهایی'
        }}</Button
      ></DialogActions
    >
  </AppDialog>
</template>
<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, useId, watch } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import Button from '@/components/ui/Button.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { accountsApi } from '@/services/accounts'
import { isInvoiceAmount, MAX_INVOICE_AMOUNT, roundToman } from '@/lib/invoice'
import { money, number, parseNumber } from '@/lib/format'
import type {
  AccountReturnProduct,
  AccountFinalizationPreview,
  PartyAccount,
  Invoice,
} from '@/types'
const props = defineProps<{ buyerId: number; mode: 'RETURN' | 'FINALIZE' | null }>()
const emit = defineEmits<{
  close: []
  saved: [result: { account: PartyAccount; statement?: Invoice }]
}>()
const products = ref<AccountReturnProduct[]>([]),
  quote = ref<AccountFinalizationPreview | null>(null)
const quantities = reactive<Record<number, number>>({}),
  notes = ref(''),
  discountText = ref('۰'),
  paymentText = ref('۰')
const loading = ref(false),
  refreshing = ref(false),
  saving = ref(false),
  error = ref(''),
  loadError = ref(''),
  requestKey = ref(''),
  formId = useId()
const payment = computed(() => parseNumber(paymentText.value) || 0)
const quoteReady = computed(
  () =>
    !!quote.value &&
    !quoteFailed.value &&
    (parseNumber(discountText.value) || 0) === quote.value.discount,
)
const quoteFailed = ref(false)
const remaining = computed(
  () => (quote.value?.balance || 0) * (quote.value?.role === 'SUPPLIER' ? -1 : 1),
)
const afterPayment = computed(() => roundToman(remaining.value - payment.value))
let sequence = 0,
  timer: ReturnType<typeof setTimeout> | undefined,
  settingDiscount = false
function historicalPrice(product: AccountReturnProduct) {
  const values = product.lots.map((lot) => lot.unitPrice)
  if (values.some((price) => price == null)) return 'براساس زمان تحویل؛ دارای کالای نسیه'
  const prices = values as number[]
  return Math.min(...prices) === Math.max(...prices)
    ? money(prices[0] || 0)
    : `${money(Math.min(...prices))} تا ${money(Math.max(...prices))}`
}
async function load() {
  if (!props.mode) return
  const current = ++sequence,
    id = props.buyerId
  loading.value = true
  loadError.value = ''
  error.value = ''
  refreshing.value = false
  quoteFailed.value = false
  try {
    if (props.mode === 'RETURN') {
      const result = await accountsApi.returnable(id)
      if (current !== sequence) return
      products.value = result.products
      for (const product of products.value) quantities[product.productId] = 0
    } else {
      const result = await accountsApi.finalization(id)
      if (current !== sequence) return
      quote.value = result
      settingDiscount = true
      discountText.value = number(result.discount)
      settingDiscount = false
    }
  } catch (e) {
    if (current === sequence)
      loadError.value = e instanceof Error ? e.message : 'دریافت اطلاعات انجام نشد.'
  } finally {
    if (current === sequence) loading.value = false
  }
}
watch(
  () => [props.mode, props.buyerId],
  () => {
    clearTimeout(timer)
    ++sequence
    products.value = []
    quote.value = null
    notes.value = ''
    paymentText.value = '۰'
    error.value = ''
    loadError.value = ''
    requestKey.value = crypto.randomUUID()
    if (props.mode) void load()
  },
  { immediate: true },
)
watch(
  discountText,
  () => {
    if (settingDiscount || props.mode !== 'FINALIZE' || loading.value) return
    clearTimeout(timer)
    ++sequence
    refreshing.value = true
    error.value = ''
    timer = setTimeout(() => void refreshQuote(), 300)
  },
  { flush: 'sync' },
)
async function refreshQuote() {
  clearTimeout(timer)
  if (!quote.value || saving.value) return
  const discount = parseNumber(discountText.value) || 0
  quoteFailed.value = false
  if (!isInvoiceAmount(discount) || discount < 0 || discount > quote.value.subtotal) {
    quoteFailed.value = true
    error.value = 'تخفیف باید بین صفر و جمع اقلام باز صورت‌حساب باشد.'
    refreshing.value = false
    return
  }
  const current = ++sequence
  refreshing.value = true
  error.value = ''
  try {
    const result = await accountsApi.finalization(props.buyerId, discount)
    if (current === sequence) quote.value = result
  } catch (e) {
    if (current === sequence) {
      quoteFailed.value = true
      error.value = e instanceof Error ? e.message : 'محاسبه صورت‌حساب انجام نشد.'
    }
  } finally {
    if (current === sequence) refreshing.value = false
  }
}
async function save() {
  if (
    saving.value ||
    loading.value ||
    refreshing.value ||
    !props.mode ||
    (props.mode === 'FINALIZE' && !quoteReady.value)
  )
    return
  error.value = ''
  let items: { productId: number; quantity: number }[] = []
  if (props.mode === 'RETURN') {
    if (
      products.value.some(
        (product) =>
          !Number.isInteger(quantities[product.productId]) ||
          quantities[product.productId]! < 0 ||
          quantities[product.productId]! > product.quantity,
      )
    ) {
      error.value = 'تعداد مرجوعی باید صحیح و حداکثر برابر کالای تحویل‌شده باشد.'
      return
    }
    items = products.value
      .filter((product) => quantities[product.productId]! > 0)
      .map((product) => ({
        productId: product.productId,
        quantity: quantities[product.productId]!,
      }))
    if (!items.length) {
      error.value = 'تعداد حداقل یک کالا را وارد کنید.'
      return
    }
  } else if (
    !quote.value ||
    !isInvoiceAmount(payment.value) ||
    payment.value < 0 ||
    payment.value > MAX_INVOICE_AMOUNT ||
    payment.value > Math.max(0, remaining.value)
  ) {
    error.value = 'پرداخت جدید باید بین صفر و مانده صورت‌حساب باشد.'
    return
  }
  saving.value = true
  try {
    if (props.mode === 'RETURN')
      emit('saved', {
        account: await accountsApi.returnGoods(props.buyerId, {
          items,
          notes: notes.value,
          requestKey: requestKey.value,
        }),
      })
    else
      emit(
        'saved',
        await accountsApi.finalize(props.buyerId, {
          token: quote.value!.token,
          discount: quote.value!.discount,
          paymentAmount: payment.value,
          requestKey: requestKey.value,
        }),
      )
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'ثبت عملیات انجام نشد.'
  } finally {
    saving.value = false
  }
}
onUnmounted(() => {
  clearTimeout(timer)
  ++sequence
})
</script>
<style scoped>
.action-items {
  max-height: 32vh;
  overflow: auto;
  margin-block: 12px;
}
.action-items input {
  width: 100px;
}
.action-summary {
  display: grid;
  gap: 8px;
}
.action-summary > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.action-summary dd {
  margin: 0;
  white-space: nowrap;
}
</style>
