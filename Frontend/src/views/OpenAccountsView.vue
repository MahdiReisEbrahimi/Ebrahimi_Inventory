<template>
  <div class="page-stack accounts-page">
    <PageHeader class="no-print" title="حساب‌های باز" />
    <section class="panel no-print">
      <div class="filter-bar">
        <label class="search-field">
          <Search :size="18" />
          <input
            v-model="search"
            type="search"
            placeholder="جست‌وجوی طرف حساب یا شماره فاکتور…"
            aria-label="جست‌وجوی حساب‌های باز"
          />
        </label>
        <span v-if="!loading && !error" class="muted">{{ number(filtered.length) }} حساب باز</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="دریافت دوباره حساب‌های باز"
          :disabled="loading"
          @click="load"
          ><RefreshCw :size="18"
        /></Button>
      </div>
      <p class="accounts-notice muted">
        فاکتورهای نسیه و فروش‌های عادی دارای مانده بدهی در این صفحه نمایش داده می‌شوند.
      </p>
    </section>
    <div v-if="loading" class="panel table-loading no-print" role="status">
      در حال دریافت حساب‌ها…
    </div>
    <EmptyState
      v-else-if="error"
      class="panel no-print"
      title="دریافت حساب‌های باز ممکن نشد"
      :description="error"
      error
    >
      <Button variant="outline" @click="load">تلاش دوباره</Button>
    </EmptyState>
    <div v-else-if="filtered.length" class="accounts-grid no-print">
      <article v-for="invoice in filtered" :key="invoice.id" class="panel account-card">
        <div class="account-card__heading">
          <span class="account-mark"><UserRound :size="24" /></span>
          <div>
            <h2>
              {{
                [invoice.buyerFirstName, invoice.buyerLastName].filter(Boolean).join(' ') ||
                'طرف حساب بدون نام'
              }}
            </h2>
            <p class="account-reference">
              فاکتور {{ invoice.number }} · {{ invoiceSaleLabel(invoice) }}
            </p>
          </div>
        </div>
        <dl class="account-amounts">
          <div>
            <dt>مبلغ نهایی</dt>
            <dd>{{ invoice.saleType === 'CREDIT' ? 'قیمت‌گذاری نشده' : money(invoice.total) }}</dd>
          </div>
          <div>
            <dt>{{ invoice.saleType === 'CREDIT' ? 'پرداختی / بیعانه' : 'پرداختی' }}</dt>
            <dd>{{ money(invoice.paidAmount || 0) }}</dd>
          </div>
        </dl>
        <div class="account-card__actions">
          <Button
            size="sm"
            variant="outline"
            :disabled="saving || !!finalizationLoading"
            @click="activeInvoice = invoice"
            ><Eye :size="16" />مشاهده</Button
          >
          <Button
            size="sm"
            variant="outline"
            :disabled="saving || !!finalizationLoading"
            @click="openPayment(invoice)"
            ><HandCoins :size="16" />ثبت پرداخت</Button
          >
          <Button
            size="sm"
            class="account-card__finalize"
            :disabled="saving || !!finalizationLoading"
            @click="openFinalization(invoice)"
          >
            <FileCheck :size="16" />{{
              finalizationLoading === invoice.id ? 'در حال محاسبه…' : 'نهایی‌کردن فاکتور'
            }}
          </Button>
        </div>
      </article>
    </div>
    <EmptyState
      v-else
      class="panel no-print"
      title="حساب بازی پیدا نشد"
      :description="
        search.trim()
          ? 'عبارت جست‌وجو را تغییر دهید.'
          : 'فاکتور نسیه یا فروش عادی تسویه‌نشده‌ای وجود ندارد.'
      "
    />
    <AppDialog
      :open="!!paymentInvoice"
      title="ثبت پرداخت جدید"
      width="480px"
      @update:open="!$event && !saving && (paymentInvoice = null)"
    >
      <form :id="paymentFormId" @submit.prevent="savePayment">
        <p>
          فاکتور {{ paymentInvoice?.number }} · {{ paymentInvoice?.buyerFirstName }}
          {{ paymentInvoice?.buyerLastName }}
        </p>
        <label class="form-field"
          ><span>{{
            paymentInvoice?.saleType === 'CREDIT'
              ? 'بیعانه جدید (تومان)'
              : 'مبلغ پرداخت جدید (تومان)'
          }}</span>
          <MoneyInput v-model="paidText" :disabled="saving" />
        </label>
        <p class="muted">فقط مبلغ این پرداخت را وارد کنید؛ به مجموع پرداختی مشتری اضافه می‌شود.</p>
        <DialogActions>
          <Button
            v-if="paymentInvoice?.saleType !== 'CREDIT'"
            variant="outline"
            :disabled="saving"
            @click="
              paidText = number(
                Math.max(0, (paymentInvoice?.total || 0) - (paymentInvoice?.paidAmount || 0)),
              )
            "
            >تسویه کامل</Button
          >
          <Button :form="paymentFormId" type="submit" :disabled="saving">{{
            saving ? 'در حال ثبت…' : 'ذخیره پرداخت'
          }}</Button>
        </DialogActions>
      </form>
    </AppDialog>
    <AppDialog
      :open="!!finalization"
      title="نهایی‌کردن فاکتور و بررسی مانده حساب"
      width="720px"
      @update:open="!$event && !saving && (finalization = null)"
    >
      <form v-if="finalization" :id="finalizationFormId" @submit.prevent="finalize">
        <p>
          فاکتور {{ finalization.invoice.number }} · {{ finalization.invoice.buyerFirstName }}
          {{ finalization.invoice.buyerLastName }}
        </p>
        <p v-if="finalizationWasCredit" class="muted">
          اقلام زیر با قیمت فروش فعلی کالاها محاسبه شده‌اند. پس از ثبت، فاکتور به فروش عادی تبدیل
          می‌شود.
        </p>
        <div class="table-scroll">
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
              <tr v-for="item in finalization.invoice.items" :key="item.id">
                <td>{{ item.name }}</td>
                <td>{{ number(item.quantity) }}</td>
                <td>{{ number(item.unitPrice || 0) }}</td>
                <td>{{ number(item.total || 0) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <dl class="finalization-summary">
          <div>
            <dt>جمع اقلام</dt>
            <dd>{{ money(finalization.invoice.subtotal || 0) }}</dd>
          </div>
          <div>
            <dt><label :for="finalDiscountId">اعمال تخفیف (تومان)</label></dt>
            <dd>
              <MoneyInput
                :id="finalDiscountId"
                v-model="finalDiscountText"
                :disabled="saving"
                aria-label="اعمال تخفیف به تومان"
              />
            </dd>
          </div>
          <div>
            <dt>مبلغ نهایی فاکتور</dt>
            <dd>{{ money(finalTotal) }}</dd>
          </div>
          <div>
            <dt>کسر پرداختی‌ها / بیعانه قبلی</dt>
            <dd>{{ money(finalization.invoice.paidAmount || 0) }}</dd>
          </div>
        </dl>
        <label class="form-field"
          ><span>پرداخت جدید هنگام نهایی‌کردن (تومان)</span
          ><MoneyInput v-model="finalPaymentText" :disabled="saving"
        /></label>
        <Button
          variant="ghost"
          :disabled="saving"
          @click="
            finalPaymentText = number(
              Math.max(0, finalTotal - (finalization.invoice.paidAmount || 0)),
            )
          "
          >پرداخت تمام مانده</Button
        >
        <p>
          <strong>مانده پس از ثبت: {{ money(Math.max(0, finalBalance)) }}</strong>
        </p>
        <p v-if="finalBalance < 0">بستانکاری مشتری: {{ money(-finalBalance) }}</p>
        <p class="muted">
          {{
            finalBalance <= 0
              ? 'حساب بسته و از حساب‌های باز خارج می‌شود.'
              : 'فاکتور عادی با مانده بدهی در حساب‌های باز باقی می‌ماند.'
          }}
        </p>
        <DialogActions>
          <Button variant="outline" :disabled="saving" @click="finalization = null">انصراف</Button>
          <Button
            variant="outline"
            :disabled="saving || !!finalizationLoading"
            @click="refreshFinalization"
            >به‌روزرسانی محاسبه</Button
          >
          <Button
            :form="finalizationFormId"
            type="submit"
            :disabled="saving || !!finalizationLoading"
            >{{ saving ? 'در حال ثبت…' : 'ثبت و نمایش فاکتور نهایی' }}</Button
          >
        </DialogActions>
      </form>
    </AppDialog>
    <AppDialog
      :open="!!activeInvoice"
      title="پیش‌نمایش فاکتور"
      width="210mm"
      content-class="invoice-preview-dialog"
      @update:open="!$event && (activeInvoice = null)"
    >
      <InvoicePaper v-if="activeInvoice" ref="paper" :invoice="activeInvoice" :settings="null" />
      <DialogActions
        ><Button variant="outline" @click="printInvoice">چاپ</Button
        ><Button @click="activeInvoice = null">بازگشت</Button></DialogActions
      >
    </AppDialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { Eye, HandCoins, FileCheck, RefreshCw, Search, UserRound } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import InvoicePaper from '@/components/InvoicePaper.vue'
import { inventoryApi } from '@/services/inventory'
import { invoiceInTomans, invoiceSaleLabel } from '@/lib/invoicePresentation'
import { money, number, normalizeNumberText, parseNumber } from '@/lib/format'
import { isInvoiceAmount, MAX_INVOICE_AMOUNT, roundToman } from '@/lib/invoice'
import { toast } from '@/lib/toast'
import type { Invoice } from '@/types'
const finalizationFormId = useId()
const finalization = ref<{ token: string; invoice: Invoice } | null>(null)
const finalizationWasCredit = ref(false)
const finalizationLoading = ref<number>()
const finalDiscountId = useId()
const finalDiscountText = ref('۰')
const finalDiscount = computed(() =>
  finalDiscountText.value.trim() ? parseNumber(finalDiscountText.value) : 0,
)
const finalTotal = computed(() =>
  roundToman((finalization.value?.invoice.subtotal || 0) - finalDiscount.value),
)
const finalPaymentText = ref('۰')
const finalPayment = computed(() =>
  finalPaymentText.value.trim() ? parseNumber(finalPaymentText.value) : 0,
)
const finalBalance = computed(() =>
  finalization.value
    ? roundToman(
        finalTotal.value - (finalization.value.invoice.paidAmount || 0) - finalPayment.value,
      )
    : 0,
)
const paymentFormId = useId()
const invoices = ref<Invoice[]>([])
const loading = ref(true),
  saving = ref(false),
  error = ref(''),
  search = ref(''),
  paidText = ref('۰')
const paymentInvoice = ref<Invoice | null>(null),
  activeInvoice = ref<Invoice | null>(null)
const paper = ref<InstanceType<typeof InvoicePaper>>()
const filtered = computed(() => {
  const query = normalizeNumberText(search.value.trim()).toLocaleLowerCase('fa')
  return invoices.value.filter((invoice) =>
    normalizeNumberText(
      `${invoice.number} ${invoice.buyerFirstName || ''} ${invoice.buyerLastName || ''}`,
    )
      .toLocaleLowerCase('fa')
      .includes(query),
  )
})
async function load() {
  loading.value = true
  error.value = ''
  try {
    invoices.value = (await inventoryApi.invoices({ openOnly: true })).map(invoiceInTomans)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'دریافت حساب‌های باز انجام نشد.'
  } finally {
    loading.value = false
  }
}
function openPayment(invoice: Invoice) {
  paymentInvoice.value = invoice
  paidText.value = '۰'
}
async function savePayment() {
  if (!paymentInvoice.value || saving.value) return
  const amount = paidText.value.trim() ? parseNumber(paidText.value) : 0
  if (
    !isInvoiceAmount(amount) ||
    amount <= 0 ||
    amount > MAX_INVOICE_AMOUNT ||
    (paymentInvoice.value.saleType !== 'CREDIT' &&
      amount > roundToman(paymentInvoice.value.total - (paymentInvoice.value.paidAmount || 0)))
  ) {
    toast.error('پرداخت جدید باید بیشتر از صفر و حداکثر برابر مانده فاکتور باشد.')
    return
  }
  saving.value = true
  try {
    await inventoryApi.updatePayment(paymentInvoice.value.id, amount)
    paymentInvoice.value = null
    toast.success('مبلغ پرداختی ثبت شد.')
    await load()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ثبت پرداخت انجام نشد.')
  } finally {
    saving.value = false
  }
}
async function openFinalization(invoice: Invoice) {
  if (saving.value || finalizationLoading.value) return
  finalizationLoading.value = invoice.id
  try {
    const preview = await inventoryApi.finalizationPreview(invoice.id)
    finalizationWasCredit.value = invoice.saleType === 'CREDIT'
    finalPaymentText.value = '۰'
    finalDiscountText.value = number(invoiceInTomans(preview.invoice).discount || 0)
    finalization.value = { ...preview, invoice: invoiceInTomans(preview.invoice) }
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'محاسبه فاکتور ممکن نشد.')
  } finally {
    finalizationLoading.value = undefined
  }
}
async function refreshFinalization() {
  if (!finalization.value) return
  await openFinalization({
    ...finalization.value.invoice,
    saleType: finalizationWasCredit.value ? 'CREDIT' : 'REGULAR',
  })
}
async function finalize() {
  if (!finalization.value || saving.value || finalizationLoading.value) return
  const invoice = finalization.value.invoice
  if (
    !isInvoiceAmount(finalDiscount.value) ||
    finalDiscount.value < 0 ||
    finalDiscount.value > (invoice.subtotal || 0)
  ) {
    toast.error('تخفیف باید بین صفر و جمع اقلام فاکتور باشد.')
    return
  }
  const remaining = Math.max(0, roundToman(finalTotal.value - (invoice.paidAmount || 0)))
  if (
    !isInvoiceAmount(finalPayment.value) ||
    finalPayment.value < 0 ||
    finalPayment.value > remaining
  ) {
    toast.error('پرداخت جدید باید بین صفر و مانده فاکتور باشد.')
    return
  }
  saving.value = true
  try {
    const result = await inventoryApi.finalizeInvoice(
      invoice.id,
      finalization.value.token,
      finalPayment.value,
      finalDiscount.value,
    )
    finalization.value = null
    activeInvoice.value = result
    toast.success(
      (result.paidAmount || 0) >= result.total
        ? 'فاکتور نهایی شد و حساب بسته شد.'
        : 'فاکتور نهایی شد؛ مانده بدهی در حساب‌های باز باقی ماند.',
    )
    await load()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'نهایی‌کردن فاکتور انجام نشد.')
  } finally {
    saving.value = false
  }
}
async function printInvoice() {
  await paper.value?.prepareForPrint()
  window.print()
}
onMounted(load)
</script>
<style scoped>
.accounts-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: auto auto minmax(0, 1fr);
}
.accounts-page > .panel {
  min-height: 0;
}
.accounts-grid {
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  scrollbar-gutter: stable;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 12px;
  padding-inline-end: 10px;
}
.account-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.account-card__heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.account-card__heading > div {
  min-width: 0;
}
.account-card h2 {
  margin: 0;
  font-size: 15px;
  overflow-wrap: anywhere;
}
.account-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--accent);
  color: var(--primary);
}
.account-reference {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}
.account-amounts {
  display: grid;
  gap: 12px;
  margin: 0;
  font-size: 12px;
}
.account-amounts > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.account-amounts dt {
  color: var(--muted-foreground);
}
.account-amounts dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.account-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-top: auto;
}
.account-card__actions :deep(.button) {
  min-width: 0;
}
.account-card__finalize {
  grid-column: 1 / -1;
}
.accounts-notice {
  margin: 0;
  padding: 12px 20px;
  font-size: 12px;
}
.finalization-summary {
  display: grid;
  gap: 8px;
  margin-block: 16px;
}
.finalization-summary > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.finalization-summary dd {
  margin: 0;
}
.muted {
  color: var(--muted-foreground);
  font-size: 13px;
}
</style>
