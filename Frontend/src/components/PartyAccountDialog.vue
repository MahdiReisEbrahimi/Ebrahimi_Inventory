<template>
  <AppDialog
    :open="!!buyerId"
    :title="
      account
        ? `صورت‌حساب ${account.buyer.firstName} ${account.buyer.lastName}`
        : 'صورت‌حساب طرف حساب'
    "
    width="1080px"
    content-class="party-account-dialog"
    @update:open="!$event && !saving && emit('close')"
  >
    <div class="statement-content">
      <p v-if="loading" role="status">در حال دریافت صورت‌حساب…</p>
      <p v-else-if="error" class="notice notice--error" role="alert">
        {{ error }} <Button variant="outline" @click="load">تلاش دوباره</Button>
      </p>
      <template v-else-if="account">
        <div class="statement-summary">
          <div>
            <span>جمع خالص پس از مرجوعی</span><strong>{{ money(account.total) }}</strong>
          </div>
          <div>
            <span>{{
              account.role === 'SUPPLIER' ? 'خالص پرداختی به تأمین‌کننده' : 'خالص دریافتی از مشتری'
            }}</span
            ><strong>{{ money(account.paid) }}</strong>
          </div>
          <div>
            <span>{{ balanceLabel(account.balance) }}</span
            ><strong>{{ money(Math.abs(account.balance)) }}</strong>
          </div>
        </div>
        <p v-if="account.pendingCount" class="statement-notice notice">
          {{ number(account.pendingCount) }} فاکتور نسیه قیمت‌گذاری نشده؛ مبلغ آن هنوز در مانده
          نیست.
        </p>
        <div class="statement-toolbar statement-account-actions">
          <Button variant="outline" @click="openCash('PAYMENT')">{{
            account.role === 'SUPPLIER' ? 'ثبت پرداخت به تأمین‌کننده' : 'ثبت پرداخت مشتری / بیعانه'
          }}</Button>
          <Button
            v-if="surplus > 0"
            variant="outline"
            :disabled="!!account.pendingCount"
            @click="openCash('REFUND')"
            >{{ account.role === 'SUPPLIER' ? 'دریافت برگشت وجه' : 'برگشت پول به مشتری' }}</Button
          >
          <Button
            v-if="account.role === 'CUSTOMER' && account.invoiceCount"
            variant="outline"
            @click="actionMode = 'RETURN'"
            >مرجوعی صورت‌حساب</Button
          >
          <Button v-if="account.invoiceCount" @click="actionMode = 'FINALIZE'"
            >نهایی‌کردن صورت‌حساب</Button
          >
        </div>
        <div class="statement-toolbar statement-tabs">
          <Button :variant="tab === 'invoices' ? 'default' : 'ghost'" @click="tab = 'invoices'"
            >فاکتورها</Button
          >
          <Button :variant="tab === 'history' ? 'default' : 'ghost'" @click="tab = 'history'"
            >تاریخچه و معین صورت‌حساب</Button
          >
        </div>
        <div
          v-if="tab === 'invoices'"
          class="statement-invoices"
          tabindex="0"
          role="region"
          aria-label="فهرست فاکتورهای صورت‌حساب"
        >
          <article
            v-for="invoice in recentInvoices"
            :key="invoice.id"
            class="panel statement-invoice"
          >
            <div>
              <strong>فاکتور {{ invoice.number }}</strong> · {{ invoiceSaleLabel(invoice) }}
              <p class="muted">{{ dateTime(invoice.createdAt) }}</p>
            </div>
            <p>
              مبلغ:
              {{
                invoice.saleType === 'CREDIT'
                  ? 'قیمت‌گذاری نشده'
                  : money(invoiceInTomans(invoice).total)
              }}
              · پرداخت تخصیص‌یافته: {{ money(invoiceInTomans(invoice).paidAmount || 0) }}
            </p>
            <p v-if="invoice.kind === 'RETURN'">
              مبلغ کسرشده از حساب: {{ money(invoiceInTomans(invoice).accountValueAmount || 0) }}
            </p>
            <p v-if="invoice.returnedAmount">
              مرجوعی پس از تخفیف: {{ money(invoiceInTomans(invoice).returnedAmount || 0) }}
            </p>
            <Button size="sm" variant="outline" @click="preview = invoice">مشاهده / چاپ</Button>
          </article>
          <p v-if="!account.invoices?.length" class="muted">هنوز فاکتوری ثبت نشده است.</p>
        </div>
        <template v-else>
          <p class="statement-history-note muted">
            گردش کل صورت‌حساب از جدید به قدیم؛ مانده هر ردیف مربوط به زمان همان عمل است.
          </p>
          <div
            class="table-scroll statement-table"
            tabindex="0"
            role="region"
            aria-label="تاریخچه صورت‌حساب"
          >
            <table class="data-table">
              <thead>
                <tr>
                  <th>تاریخ و ساعت ثبت</th>
                  <th>شرح عمل</th>
                  <th>سند مرتبط</th>
                  <th>بدهکار (تومان)</th>
                  <th>بستانکار (تومان)</th>
                  <th>مانده کل (تومان)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in recentEntries" :key="entry.id">
                  <td>
                    <time>{{ dateTime(entry.createdAt) }}</time
                    ><small v-if="entry.historical" class="muted"
                      >انتقال سابقه؛ زمان دقیق پرداخت قدیمی موجود نیست</small
                    >
                  </td>
                  <td>
                    {{ entry.description }}
                    <Button
                      v-if="entry.details?.statement"
                      size="sm"
                      variant="outline"
                      @click="preview = entry.details.statement"
                      >مشاهده صورت‌حساب نهایی</Button
                    >
                    <details v-if="entry.details?.after">
                      <summary>جزئیات تغییر</summary>
                      <div
                        v-for="(snapshot, label) in {
                          قبل: entry.details.before,
                          بعد: entry.details.after,
                        }"
                        :key="label"
                      >
                        <template v-if="snapshot?.items"
                          ><b>{{ label }}</b>
                          <p>
                            مبلغ: {{ money(invoiceInTomans(snapshot).total) }} · تخفیف:
                            {{ money(invoiceInTomans(snapshot).discount || 0) }} · پرداخت
                            تخصیص‌یافته: {{ money(invoiceInTomans(snapshot).paidAmount || 0) }}
                          </p>
                          <p v-for="line in snapshot.items" :key="line.id">
                            {{ line.name }} × {{ number(line.quantity) }} ·
                            {{
                              line.unitPrice == null
                                ? 'بدون قیمت'
                                : money(
                                    invoiceInTomans(snapshot).items.find((i) => i.id === line.id)
                                      ?.unitPrice || 0,
                                  )
                            }}
                          </p></template
                        >
                        <template v-else-if="snapshot"
                          ><b>{{ label }}</b>
                          <p>
                            {{ snapshot.firstName }} {{ snapshot.lastName }} · {{ snapshot.phone }}
                          </p>
                          <p>{{ snapshot.address }} {{ snapshot.notes }}</p></template
                        >
                      </div>
                    </details>
                  </td>
                  <td>{{ entry.invoiceNumber || 'صورت‌حساب' }}</td>
                  <td>{{ entry.debit ? number(entry.debit) : '—' }}</td>
                  <td>{{ entry.credit ? number(entry.credit) : '—' }}</td>
                  <td>
                    {{ number(Math.abs(entry.balance))
                    }}<small>{{ balanceLabel(entry.balance) }}</small>
                  </td>
                </tr>
                <tr v-if="!recentEntries.length">
                  <td colspan="6">گردشی ثبت نشده است.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </template>
    </div>
    <DialogActions
      ><Button variant="outline" :disabled="saving" @click="emit('close')"
        >بستن</Button
      ></DialogActions
    >
  </AppDialog>
  <AppDialog
    :open="!!cashKind"
    :title="cashKind === 'REFUND' ? 'ثبت برگشت وجه' : 'ثبت پرداخت جدید'"
    width="480px"
    @update:open="!$event && !saving && (cashKind = null)"
  >
    <form :id="formId" @submit.prevent="saveCash">
      <label class="form-field"
        ><span>مبلغ جدید (تومان)</span><MoneyInput v-model="amountText" :disabled="saving"
      /></label>
      <label class="form-field"
        ><span>توضیحات</span><input v-model="description" :disabled="saving" maxlength="1000"
      /></label>
      <p class="muted">این مبلغ مستقل ثبت می‌شود و روی مانده کل طرف حساب اثر می‌گذارد.</p>
      <p v-if="cashError" role="alert" class="notice notice--error">{{ cashError }}</p>
    </form>
    <DialogActions
      ><Button variant="outline" :disabled="saving" @click="cashKind = null">انصراف</Button
      ><Button :form="formId" type="submit" :disabled="saving">{{
        saving ? 'در حال ثبت…' : 'ثبت'
      }}</Button></DialogActions
    >
  </AppDialog>
  <AppDialog
    :open="!!preview"
    title="پیش‌نمایش فاکتور"
    width="210mm"
    content-class="invoice-preview-dialog"
    @update:open="!$event && (preview = null)"
  >
    <InvoicePaper v-if="preview" ref="paper" :invoice="preview" :settings="null" />
    <DialogActions
      ><Button variant="outline" @click="printInvoice">چاپ</Button
      ><Button @click="preview = null">بازگشت</Button></DialogActions
    >
  </AppDialog>
  <AccountActionsDialog
    v-if="account && buyerId"
    :buyer-id="buyerId"
    :mode="actionMode"
    @close="actionMode = null"
    @saved="operationSaved"
  />
</template>
<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import Button from '@/components/ui/Button.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import AccountActionsDialog from '@/components/AccountActionsDialog.vue'
import { toast } from '@/lib/toast'
import InvoicePaper from '@/components/InvoicePaper.vue'
import { newestFirst } from '@/lib/partyAccount'
import { accountsApi } from '@/services/accounts'
import { invoiceInTomans, invoiceSaleLabel } from '@/lib/invoicePresentation'
import { money, number, parseNumber } from '@/lib/format'
import { isInvoiceAmount, MAX_INVOICE_AMOUNT } from '@/lib/invoice'
import type { Invoice, PartyAccount } from '@/types'
const props = defineProps<{
  buyerId: number | null
  payment?: boolean
  action?: 'RETURN' | 'FINALIZE' | null
}>()
const emit = defineEmits<{ close: []; changed: [] }>()
const account = ref<PartyAccount | null>(null),
  loading = ref(false),
  error = ref('')
const tab = ref('invoices')
const actionMode = ref<'RETURN' | 'FINALIZE' | null>(null)
const cashKind = ref<'PAYMENT' | 'REFUND' | null>(null),
  amountText = ref('۰'),
  description = ref(''),
  saving = ref(false),
  cashError = ref('')
const requestKey = ref(''),
  formId = useId()
const preview = ref<Invoice | null>(null),
  paper = ref<InstanceType<typeof InvoicePaper>>()
const surplus = computed(() =>
  account.value?.role === 'SUPPLIER'
    ? Math.max(0, account.value.balance)
    : Math.max(0, -(account.value?.balance || 0)),
)
const recentEntries = computed(() => newestFirst(account.value?.entries || []))
const recentInvoices = computed(() => newestFirst(account.value?.invoices || []))
const dateTime = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
const balanceLabel = (value: number) =>
  value > 0 ? 'بدهکار به فروشگاه' : value < 0 ? 'بستانکار از فروشگاه' : 'تسویه'
let request = 0
async function load() {
  const id = props.buyerId,
    current = ++request
  if (!id) return
  loading.value = true
  error.value = ''
  try {
    const result = await accountsApi.detail(id)
    if (current === request) account.value = result
  } catch (e) {
    if (current === request) error.value = e instanceof Error ? e.message : 'دریافت حساب انجام نشد.'
  } finally {
    if (current === request) loading.value = false
  }
}
watch(
  () => props.buyerId,
  async (id) => {
    account.value = null
    preview.value = null
    cashKind.value = null
    tab.value = 'invoices'
    actionMode.value = null
    if (id) {
      await load()
      if (props.payment && account.value) openCash('PAYMENT')
      else if (props.action && account.value) actionMode.value = props.action
    } else request++
  },
  { immediate: true },
)
function openCash(kind: 'PAYMENT' | 'REFUND') {
  cashKind.value = kind
  amountText.value = '۰'
  description.value = ''
  cashError.value = ''
  requestKey.value = crypto.randomUUID()
}
async function saveCash() {
  if (!props.buyerId || !cashKind.value || saving.value) return
  const amount = parseNumber(amountText.value)
  if (!isInvoiceAmount(amount) || amount <= 0 || amount > MAX_INVOICE_AMOUNT) {
    cashError.value = 'مبلغ جدید باید بیشتر از صفر و حداکثر ۱۰ میلیارد تومان باشد.'
    return
  }
  saving.value = true
  cashError.value = ''
  try {
    account.value = await accountsApi.cash(props.buyerId, {
      amount,
      kind: cashKind.value,
      requestKey: requestKey.value,
      description: description.value,
    })
    cashKind.value = null
    emit('changed')
  } catch (e) {
    cashError.value = e instanceof Error ? e.message : 'ثبت پرداخت انجام نشد.'
  } finally {
    saving.value = false
  }
}
function operationSaved(result: { account: PartyAccount; statement?: Invoice }) {
  const finalized = actionMode.value === 'FINALIZE'
  account.value = result.account
  actionMode.value = null
  if (result.statement) preview.value = result.statement
  toast.success(finalized ? 'صورت‌حساب نهایی شد.' : 'مرجوعی صورت‌حساب ثبت شد.')
  emit('changed')
}
async function printInvoice() {
  await paper.value?.prepareForPrint()
  window.print()
}
</script>
<style scoped>
.statement-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
.statement-summary,
.statement-toolbar,
.statement-history-note,
.statement-notice {
  flex-shrink: 0;
}
.statement-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-block-end: 8px;
}
.statement-summary > div {
  padding: 12px;
  background: var(--muted);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  display: grid;
  gap: 8px;
}
.statement-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-block: 8px;
}
.statement-invoices {
  display: grid;
  flex: 1;
  min-height: 0;
  align-content: start;
  gap: 12px;
  overflow: auto;
  overscroll-behavior: contain;
}
.statement-invoice {
  padding: 14px;
}
.statement-invoice p {
  margin-block: 8px;
}
.statement-table {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.statement-table th {
  position: sticky;
  top: 0;
  background: var(--card);
  z-index: 1;
}
.statement-table small {
  display: block;
  margin-block-start: 6px;
}
.statement-table time {
  white-space: nowrap;
}
.statement-table details {
  margin-block-start: 8px;
  text-align: start;
}
.statement-table summary {
  cursor: pointer;
  color: var(--primary);
}
@media (max-width: 650px) {
  .statement-summary {
    gap: 6px;
  }
  .statement-summary > div {
    padding: 8px;
    font-size: 12px;
  }
  .statement-toolbar {
    gap: 6px;
  }
}
</style>
<style>
.party-account-dialog {
  height: min(880px, calc(100dvh - 32px));
}
.party-account-dialog > .dialog-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
