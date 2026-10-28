<template>
  <div class="page-stack invoice-page">
    <Teleport to="#page-toolbar" defer>
      <div class="segmented-control invoice-tabs" aria-label="بخش فاکتورهای فروش">
        <button :aria-pressed="activeTab === 'new'" :disabled="saving" @click="switchTab('new')">
          فاکتور جدید
        </button>
        <button
          :aria-pressed="activeTab === 'archive'"
          :disabled="saving"
          @click="switchTab('archive')"
        >
          بایگانی فاکتورها
        </button>
      </div>
    </Teleport>
    <div v-if="loadError" class="notice notice--error no-print" role="alert">
      {{ loadError }}<Button variant="outline" @click="load">تلاش دوباره</Button>
    </div>
    <div v-if="loading" class="table-loading panel no-print" role="status">
      در حال دریافت اطلاعات…
    </div>
    <section
      v-else-if="activeTab === 'new'"
      class="panel invoice-editor no-print"
      :aria-busy="saving"
    >
      <header class="editor-toolbar">
        <div class="editor-buyer">
          <SearchSelect
            v-model="selectedBuyerId"
            :options="buyerOptions"
            label="خریدار"
            placeholder="انتخاب خریدار"
            create-label="طرف حساب جدید"
            :disabled="saving"
            @create="openBuyer()"
          />
        </div>
        <h1 class="editor-title">
          {{ editingInvoiceId ? 'ویرایش فاکتور ' + editingInvoiceNumber : 'فاکتور جدید' }}
        </h1>
        <div class="editor-tools">
          <PersianDatePicker v-model="issueDate" label="انتخاب تاریخ صدور" :disabled="saving" />
          <button
            type="button"
            class="icon-button store-settings-button"
            aria-label="تغییر اطلاعات فروشگاه"
            title="تغییر اطلاعات فروشگاه"
            :disabled="saving"
            @click="settingsOpen = true"
          >
            <Store :size="17" />
          </button>
        </div>
      </header>
      <div
        ref="linesRegion"
        class="invoice-lines-scroll"
        tabindex="0"
        role="region"
        aria-label="اقلام فاکتور"
      >
        <table class="invoice-lines">
          <colgroup>
            <col class="index-col" />
            <col class="name-col" />
            <col class="qty-col" />
            <col class="unit-col" />
            <col class="price-col" />
            <col class="total-col" />
          </colgroup>
          <thead>
            <tr>
              <th>ردیف</th>
              <th>نام کالا</th>
              <th>تعداد</th>
              <th>واحد</th>
              <th>فی <small class="invoice-currency">(ریال)</small></th>
              <th>جمع <small class="invoice-currency">(ریال)</small></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(line, index) in draft" :key="line.productId">
              <td class="line-index">
                <span>{{ number(index + 1) }}</span
                ><button
                  class="line-remove"
                  :aria-label="'حذف ' + line.name"
                  :disabled="saving"
                  @click="draft.splice(index, 1)"
                >
                  <Trash2 :size="15" />
                </button>
              </td>
              <td>
                <b :title="line.name">{{ line.name }}</b>
              </td>
              <td>
                <NumberInput
                  v-model="line.quantity"
                  persian-digits
                  :data-product-id="line.productId"
                  min="1"
                  :max="stockOf(line.productId)"
                  step="1"
                  :disabled="saving"
                  :aria-label="'تعداد ' + line.name"
                />
              </td>
              <td>{{ line.unit }}</td>
              <td>
                <MoneyInput
                  v-model="line.priceText"
                  :disabled="saving"
                  :aria-label="'فی ' + line.name + ' به ریال'"
                  @update:model-value="line.unitPrice = parseNumber($event)"
                />
              </td>
              <td>{{ number(line.quantity * line.unitPrice) }}</td>
            </tr>
            <tr class="line-adder-row">
              <td class="adder-index">{{ number(draft.length + 1) }}</td>
              <td>
                <div class="line-adder" role="group" aria-label="انتخاب کالا و دسته‌بندی">
                  <SearchSelect
                    :options="productOptions"
                    label="افزودن کالا به فاکتور"
                    placeholder="جست‌وجوی کالا…"
                    :disabled="saving"
                    @update:model-value="addProduct"
                    @close-auto-focus="focusAddedLine"
                  />
                  <SearchSelect
                    v-model="selectedCategoryId"
                    :options="categoryOptions"
                    label="دسته‌بندی کالا"
                    placeholder="همه دسته‌بندی‌ها"
                    :disabled="saving"
                  />
                </div>
              </td>
              <td v-for="column in 4" :key="column" aria-hidden="true"></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="editor-bottom">
        <section class="invoice-summary" aria-label="خلاصه مبالغ فاکتور">
          <div class="subtotal">
            <span>جمع {{ number(draft.length) }} قلم کالا</span>
            <b>{{ rial(draftSubtotal) }}</b>
          </div>
          <label class="discount-field">
            <span>تخفیف <small>ریال</small></span>
            <MoneyInput
              v-model="discountText"
              :disabled="saving"
              aria-label="تخفیف فاکتور به ریال"
              placeholder="۰"
            />
          </label>
          <div class="grand-total">
            <div>
              <span>مبلغ نهایی</span
              ><strong :title="amountInWords(draftTotal)">{{ rial(draftTotal) }}</strong>
            </div>
            <small>{{ amountInWords(draftTotal) }}</small>
          </div>
        </section>
        <div class="editor-footer">
          <div class="editor-options">
            <fieldset class="settlement" :disabled="saving">
              <legend class="visually-hidden">روش تسویه</legend>
              <div class="settlement-options">
                <label :class="{ selected: settlement === 'CASH' }">
                  <input v-model="settlement" type="radio" value="CASH" />
                  <span>نقدی</span>
                </label>
                <label :class="{ selected: settlement === 'INSTALLMENT' }">
                  <input v-model="settlement" type="radio" value="INSTALLMENT" />
                  <span>اقساطی</span>
                </label>
              </div>
            </fieldset>
            <button
              type="button"
              class="notes-toggle"
              :aria-expanded="notesExpanded"
              :aria-controls="notesFieldId"
              @click="notesExpanded = !notesExpanded"
            >
              توضیحات
              <span v-if="notes.trim()" class="notes-indicator" aria-label="دارای توضیحات"></span>
              <ChevronDown :size="14" :class="{ rotated: notesExpanded }" />
            </button>
          </div>
          <div class="editor-actions">
            <Button
              :disabled="
                saving ||
                !draft.length ||
                !selectedBuyer ||
                !!loadError ||
                (!!editingInvoiceId && !hasInvoiceChanges)
              "
              :aria-describedby="saveHintId"
              @click="save"
              ><Check :size="17" />{{
                saving ? 'در حال ذخیره…' : editingInvoiceId ? 'ذخیره تغییرات' : 'ثبت فاکتور'
              }}</Button
            >
            <Button variant="outline" :disabled="saving || !draft.length" @click="printDraft"
              ><Printer :size="17" />پیش‌نمایش</Button
            >
            <Button v-if="editingInvoiceId" variant="ghost" :disabled="saving" @click="cancelEdit"
              >انصراف از ویرایش</Button
            >
          </div>
          <p
            :id="saveHintId"
            class="editor-save-hint"
            :class="{ 'visually-hidden': draft.length && selectedBuyer && !loadError }"
          >
            <template v-if="loadError"
              >برای ثبت فاکتور، دریافت اطلاعات را دوباره امتحان کنید.</template
            >
          </p>
        </div>
        <label v-show="notesExpanded" :id="notesFieldId" class="form-field invoice-notes">
          <span>توضیحات فاکتور <small>اختیاری</small></span>
          <textarea
            v-model="notes"
            rows="2"
            maxlength="600"
            placeholder="توضیحات یا شرایط توافق‌شده با خریدار…"
            :disabled="saving"
            @input="notesTouched = true"
          />
        </label>
      </div>
    </section>
    <section v-if="activeTab === 'archive'" class="panel invoice-archive no-print">
      <div class="panel-heading">
        <h2>بایگانی فاکتورها</h2>
        <Button variant="ghost" size="sm" @click="clearFilters">پاک‌کردن فیلترها</Button>
      </div>
      <div class="archive-filters panel-body">
        <label class="form-field"
          ><span>خریدار</span
          ><select v-model.number="archiveFilters.customerId">
            <option :value="undefined">همه خریداران</option>
            <option v-for="buyer in buyers" :key="buyer.id" :value="buyer.id">
              {{ buyer.firstName }} {{ buyer.lastName }}
            </option>
          </select></label
        >
        <label class="form-field"
          ><span>نام یا کد ملی</span><input v-model="archiveFilters.buyer"
        /></label>
        <label class="form-field"
          ><span>نام کالا</span><input v-model="archiveFilters.product"
        /></label>
        <label class="form-field"
          ><span>از تاریخ صدور</span
          ><PersianDatePicker
            v-model="archiveFilters.from"
            label="از تاریخ صدور"
            placeholder="از تاریخ"
            clearable
        /></label>
        <label class="form-field"
          ><span>تا تاریخ صدور</span
          ><PersianDatePicker
            v-model="archiveFilters.to"
            label="تا تاریخ صدور"
            placeholder="تا تاریخ"
            clearable
        /></label>
      </div>
      <p v-if="!archiveLoading && !archiveError" class="archive-summary" role="status">
        {{ archiveSummary }}
      </p>
      <div
        class="archive-results"
        role="region"
        aria-label="فهرست فاکتورها"
        tabindex="0"
        :aria-busy="archiveLoading"
      >
        <p v-if="archiveError" class="notice notice--error" role="alert">{{ archiveError }}</p>
        <div v-if="archiveLoading" class="table-loading">در حال دریافت…</div>
        <div v-else-if="invoices.length" class="archive-grid">
          <article v-for="invoice in invoices" :key="invoice.id" class="archive-card">
            <div>
              <b>فاکتور {{ invoice.number }}</b
              ><time>{{ date(invoice.issueDate || invoice.createdAt) }}</time>
            </div>
            <p>{{ invoice.buyerFirstName }} {{ invoice.buyerLastName }}</p>
            <strong>{{ rial(invoiceInRials(invoice).total) }}</strong>
            <div class="archive-actions">
              <Button variant="outline" size="sm" @click="openInvoice(invoice)">مشاهده</Button
              ><Button variant="ghost" size="sm" @click="openInvoice(invoice, true)"
                ><Printer :size="15" />چاپ</Button
              >
            </div>
          </article>
        </div>
        <EmptyState
          v-else-if="!archiveError"
          title="فاکتوری پیدا نشد"
          description="فیلترها را تغییر دهید یا فاکتور جدیدی ثبت کنید."
        />
      </div>
    </section>
    <AppDialog
      v-if="activeInvoice || previewDraft"
      :open="true"
      title="پیش‌نمایش فاکتور"
      width="210mm"
      content-class="invoice-preview-dialog"
      @update:open="!$event && closePreview()"
    >
      <InvoicePaper
        ref="paperRenderer"
        :invoice="activeInvoice || draftInvoice"
        :settings="settings"
        :draft="!activeInvoice"
      />
      <DialogActions>
        <span class="badge" :class="activeInvoice ? 'badge--success' : 'badge--warning'">{{
          activeInvoice ? 'فاکتور ثبت‌شده' : 'پیش‌نویس · ثبت نشده'
        }}</span>
        <Button variant="outline" @click="printCurrent"><Printer :size="17" />چاپ A5 افقی</Button>
        <Button v-if="activeInvoice" variant="outline" @click="editInvoice"
          ><Pencil :size="16" />ویرایش</Button
        >
        <Button v-if="activeInvoice" @click="newDraft"><Plus :size="16" />فاکتور جدید</Button>
        <Button variant="ghost" @click="closePreview()">{{
          activeInvoice ? 'بازگشت' : 'ادامه ویرایش'
        }}</Button>
      </DialogActions>
    </AppDialog>
    <AppDialog
      v-model:open="leaveOpen"
      title="فاکتور هنوز ثبت نشده است"
      width="460px"
      @update:open="!$event && finishLeaving(false)"
    >
      <p>با خروج از این صفحه، اقلام فاکتور ثبت‌نشده از دست می‌روند.</p>
      <DialogActions>
        <Button variant="outline" @click="finishLeaving(false)">ادامه ویرایش</Button>
        <Button variant="destructive" @click="finishLeaving(true)">خروج بدون ثبت</Button>
      </DialogActions>
    </AppDialog>
    <AppDialog
      :open="buyerOpen"
      @update:open="!buyerSaving && (buyerOpen = $event)"
      :title="editingBuyerId ? 'ویرایش خریدار' : 'ثبت خریدار جدید'"
      width="620px"
      ><form :id="buyerFormId" @submit.prevent="saveBuyer">
        <div class="form-grid">
          <label class="form-field"
            ><span>نام</span><input v-model="buyerForm.firstName" required maxlength="100" /></label
          ><label class="form-field"
            ><span>نام خانوادگی</span
            ><input v-model="buyerForm.lastName" required maxlength="100" /></label
          ><label class="form-field"
            ><span>کد ملی <small>اختیاری</small></span
            ><input v-model="buyerForm.nationalId" inputmode="numeric" maxlength="20" /></label
          ><label class="form-field"
            ><span>شماره تماس <small>اختیاری</small></span
            ><input v-model="buyerForm.phone" type="tel" maxlength="30" /></label
          ><label class="form-field full-width"
            ><span>نشانی</span
            ><textarea v-model="buyerForm.address" rows="2" maxlength="500" /></label
          ><label class="form-field full-width"
            ><span>توضیحات</span><textarea v-model="buyerForm.notes" rows="2" maxlength="1000" />
          </label>
        </div>

        <DialogActions>
          <Button variant="outline" @click="buyerOpen = false">انصراف</Button
          ><Button :form="buyerFormId" type="submit" :disabled="buyerSaving">{{
            buyerSaving ? 'در حال ذخیره…' : 'ذخیره خریدار'
          }}</Button>
        </DialogActions>
      </form></AppDialog
    >
    <AppDialog
      :open="settingsOpen"
      @update:open="!settingsSaving && (settingsOpen = $event)"
      title="اطلاعات فروشگاه"
      width="600px"
      ><form :id="settingsFormId" @submit.prevent="saveSettings">
        <div class="form-grid">
          <label class="form-field"
            ><span>نام فروشگاه</span
            ><input v-model="settingsForm.name" required maxlength="100" /></label
          ><label class="form-field"
            ><span>شماره تماس</span
            ><input v-model="settingsForm.phone" type="tel" maxlength="30" /></label
          ><label class="form-field full-width"
            ><span>نشانی فروشگاه</span
            ><textarea v-model="settingsForm.address" rows="2" maxlength="200" />
          </label>
        </div>
        <label class="form-field settings-extra"
          ><span>شماره شبای فروشنده</span
          ><span class="iban-input" dir="ltr">
            <span class="iban-input__prefix" aria-hidden="true">IR</span>
            <input
              :value="ibanDigits"
              inputmode="numeric"
              dir="ltr"
              aria-label="شماره شبای فروشنده، ۲۴ رقم پس از IR"
              placeholder="۲۴ رقم شماره شبا"
              @input="updateIbanInput"
            /> </span
        ></label>
        <label class="form-field settings-extra"
          ><span>نام صاحب حساب و بانک <small>اختیاری</small></span>
          <input
            v-model="settingsForm.ibanLabel"
            maxlength="120"
            placeholder="مثلاً علی ابراهیمی ـ بانک ملت"
          />
        </label>
        <label class="form-field settings-extra"
          ><span>توضیحات پیش‌فرض فاکتور</span
          ><textarea v-model="settingsForm.defaultInvoiceNotes" maxlength="600" rows="3" /><small
            >در فاکتورهای جدید درج می‌شود و برای هر فاکتور قابل ویرایش است.</small
          ></label
        >

        <DialogActions>
          <Button variant="outline" @click="settingsOpen = false">انصراف</Button
          ><Button :form="settingsFormId" type="submit" :disabled="settingsSaving">{{
            settingsSaving ? 'در حال ذخیره…' : 'ذخیره اطلاعات'
          }}</Button>
        </DialogActions>
      </form></AppDialog
    >
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, useId, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Check, ChevronDown, Pencil, Plus, Printer, Store, Trash2 } from '@lucide/vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import SearchSelect from '@/components/ui/SearchSelect.vue'
import PersianDatePicker from '@/components/ui/PersianDatePicker.vue'
import InvoicePaper from '@/components/InvoicePaper.vue'
import { toast } from '@/lib/toast'
import { date, number, normalizeNumberText, parseNumber, toPersianDigits } from '@/lib/format'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import { invoiceEditKey, validateInvoiceLines } from '@/lib/invoice'
import { amountInWords, invoiceInRials, rial } from '@/lib/invoicePresentation'
import { addPersianMonths, persianDateLabel, todayInTehran } from '@/lib/persianDate'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import type { Buyer, Invoice, InvoiceItem, Product, StoreSettings } from '@/types'
const notesFieldId = useId()
const notesExpanded = ref(false)
const saveHintId = useId()
const buyerFormId = useId()
const settingsFormId = useId()
type DraftLine = InvoiceItem & { priceText: string }
const products = ref<Product[]>([]),
  buyers = ref<Buyer[]>([]),
  invoices = ref<Invoice[]>([]),
  draft = ref<DraftLine[]>([])
const settings = ref<StoreSettings | null>(null),
  activeInvoice = ref<Invoice | null>(null)
const paperRenderer = ref<InstanceType<typeof InvoicePaper>>()
const activeTab = ref<'new' | 'archive'>('new'),
  selectedBuyerId = ref<number>()
const selectedCategoryId = ref<number>(0)
const linesRegion = ref<HTMLDivElement>()
let pendingProductFocus: number | undefined
const editingInvoiceId = ref<number>(),
  editingInvoiceNumber = ref('')
const originalItems = ref<InvoiceItem[]>([])
const originalEditKey = ref('')
const issueDate = ref(todayInTehran()),
  notes = ref(''),
  notesTouched = ref(false)
const discountText = ref('۰')
const settlement = ref<'CASH' | 'INSTALLMENT'>('CASH')
const loading = ref(true),
  saving = ref(false),
  loadError = ref('')
const archiveLoading = ref(false),
  archiveError = ref(''),
  previewDraft = ref(false)
function closePreview() {
  activeInvoice.value = null
  previewDraft.value = false
}
const buyerOpen = ref(false),
  buyerSaving = ref(false),
  editingBuyerId = ref<number | null>(null)
const settingsOpen = ref(false),
  settingsSaving = ref(false)
const buyerForm = reactive({
  firstName: '',
  lastName: '',
  nationalId: '',
  phone: '',
  address: '',
  notes: '',
})
const settingsForm = reactive({
  name: '',
  address: '',
  phone: '',
  logoUrl: '',
  iban: '',
  ibanLabel: '',
  defaultInvoiceNotes: '',
})
const ibanDigits = computed(() => settingsForm.iban.replace(/^IR/i, ''))
function updateIbanInput(event: Event) {
  const input = event.target as HTMLInputElement
  const digits = normalizeNumberText(input.value).replace(/\D/g, '').slice(0, 24)
  input.value = digits
  settingsForm.iban = digits ? `IR${digits}` : ''
}
const archiveToday = todayInTehran()
const archiveFilters = reactive({
  customerId: undefined as number | undefined,
  buyer: '',
  product: '',
  from: addPersianMonths(archiveToday, -1),
  to: '',
})
const appliedArchiveText = reactive({ buyer: '', product: '' })
const displayedArchiveFilters = ref({ ...archiveFilters })
const archiveSummary = computed(() => {
  const filters = displayedArchiveFilters.value
  if (
    !filters.customerId &&
    !filters.buyer.trim() &&
    !filters.product.trim() &&
    filters.from === addPersianMonths(archiveToday, -1) &&
    !filters.to
  )
    return 'فاکتورهای یک ماه اخیر نمایش داده می‌شوند.'
  const buyer = buyers.value.find((item) => item.id === filters.customerId)
  const subject = buyer
    ? `فاکتورهای خریدار «${[buyer.firstName, buyer.lastName].filter(Boolean).join(' ')}»`
    : 'فاکتورهایی'
  const conditions: string[] = []
  if (filters.buyer.trim())
    conditions.push(`نام یا کد ملی خریدار آن‌ها شامل «${filters.buyer.trim()}» است`)
  if (filters.product.trim()) conditions.push(`شامل کالای «${filters.product.trim()}» هستند`)
  if (filters.from && filters.to) {
    conditions.push(
      `تاریخ صدور آن‌ها از ${persianDateLabel(filters.from)} تا ${persianDateLabel(filters.to)} است`,
    )
  } else if (filters.from) {
    conditions.push(`تاریخ صدور آن‌ها از ${persianDateLabel(filters.from)} به بعد است`)
  } else if (filters.to) {
    conditions.push(`تاریخ صدور آن‌ها تا ${persianDateLabel(filters.to)} است`)
  }
  if (!buyer && !conditions.length) return 'همهٔ فاکتورها نمایش داده می‌شوند.'
  return toPersianDigits(
    conditions.length
      ? `${subject} که ${conditions.join(' و ')}، نمایش داده می‌شوند.`
      : `${subject} نمایش داده می‌شوند.`,
  )
})
let archiveTextTimer: ReturnType<typeof setTimeout> | undefined
let archiveRequest = 0
watch(
  () => [archiveFilters.buyer, archiveFilters.product],
  () => {
    clearTimeout(archiveTextTimer)
    if (
      archiveFilters.buyer === appliedArchiveText.buyer &&
      archiveFilters.product === appliedArchiveText.product
    )
      return
    archiveTextTimer = setTimeout(() => {
      appliedArchiveText.buyer = archiveFilters.buyer
      appliedArchiveText.product = archiveFilters.product
    }, 1000)
  },
)
watch(
  () => [
    archiveFilters.customerId,
    archiveFilters.from,
    archiveFilters.to,
    appliedArchiveText.buyer,
    appliedArchiveText.product,
  ],
  () => {
    void loadInvoices()
  },
)
onUnmounted(() => {
  clearTimeout(archiveTextTimer)
  archiveRequest++
})
const selectedBuyer = computed(() =>
  buyers.value.find((buyer) => buyer.id === selectedBuyerId.value),
)
const buyerOptions = computed(() =>
  buyers.value.map((buyer) => ({
    value: buyer.id,
    label: buyer.firstName + ' ' + buyer.lastName,
    description: [buyer.nationalId, buyer.phone].filter(Boolean).join(' · '),
  })),
)
const categoryOptions = computed(() => [
  { value: 0, label: 'همه دسته‌بندی‌ها' },
  ...Array.from(
    new Map(products.value.map((product) => [product.categoryId, product.category])).values(),
  )
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
    .map((category) => ({ value: category.id, label: category.name })),
])
const productOptions = computed(() =>
  products.value
    .filter(
      (product) =>
        (!selectedCategoryId.value || product.categoryId === selectedCategoryId.value) &&
        !draft.value.some((line) => line.productId === product.id),
    )
    .map((product) => ({
      value: product.id,
      label: product.name,
      description:
        'موجودی ' +
        number(stockOf(product.id)) +
        ' ' +
        product.unit +
        ' · ' +
        rial(product.sellPrice * 10),
      disabled: stockOf(product.id) < 1,
    })),
)
const draftSubtotal = computed(() =>
  draft.value.reduce((sum, line) => sum + Number(line.quantity) * line.unitPrice, 0),
)
const discount = computed(() => (discountText.value.trim() ? parseNumber(discountText.value) : 0))
const draftTotal = computed(() => draftSubtotal.value - discount.value)
const invoicePayload = computed(() => ({
  customerId: selectedBuyerId.value,
  issueDate: issueDate.value,
  discount: discount.value,
  settlement: settlement.value,
  notes: notes.value,
  items: draft.value.map(({ productId, quantity, unitPrice }) => ({
    productId,
    quantity,
    unitPrice,
  })),
}))
const hasInvoiceChanges = computed(
  () => invoiceEditKey(invoicePayload.value) !== originalEditKey.value,
)
const draftInvoice = computed<Invoice>(() => ({
  id: editingInvoiceId.value || 0,
  number: editingInvoiceNumber.value || 'پس از ثبت',
  currency: 'IRR',
  issueDate: issueDate.value,
  createdAt: new Date().toISOString(),
  buyerFirstName: selectedBuyer.value?.firstName || '',
  buyerLastName: selectedBuyer.value?.lastName || '',
  buyerNationalId: selectedBuyer.value?.nationalId || null,
  buyerAddress: selectedBuyer.value?.address || null,
  buyerPhone: selectedBuyer.value?.phone,
  notes: notes.value,
  total: draftTotal.value,
  subtotal: draftSubtotal.value,
  discount: discount.value,
  settlement: settlement.value,
  items: draft.value,
}))
const stockOf = (id: number) =>
  (products.value.find((product) => product.id === id)?.stock || 0) +
  originalItems.value
    .filter((line) => line.productId === id)
    .reduce((sum, line) => sum + line.quantity, 0)
const leaveOpen = ref(false)
let resolveLeaving: ((leave: boolean) => void) | undefined
onBeforeRouteLeave(() => {
  if (saving.value) return false
  if (!draft.value.length) return true
  return new Promise<boolean>((resolve) => {
    resolveLeaving?.(false)
    resolveLeaving = resolve
    leaveOpen.value = true
  })
})
function finishLeaving(leave: boolean) {
  leaveOpen.value = false
  resolveLeaving?.(leave)
  resolveLeaving = undefined
}
function switchTab(tab: 'new' | 'archive') {
  if (saving.value) return
  activeTab.value = tab
  activeInvoice.value = null
  previewDraft.value = false
}
function addProduct(id: number) {
  const product = products.value.find((item) => item.id === id)
  if (!product || (selectedCategoryId.value && product.categoryId !== selectedCategoryId.value))
    return
  const line = draft.value.find((item) => item.productId === id)
  if (line) return
  if (stockOf(id) < 1) return toast.warning('موجودی این کالا کافی نیست.')
  draft.value.push({
    id: 0,
    productId: id,
    name: product.name,
    unit: product.unit,
    quantity: 1,
    unitPrice: product.sellPrice * 10,
    priceText: number(product.sellPrice * 10),
    total: product.sellPrice * 10,
  })
  pendingProductFocus = id
}
async function focusAddedLine(event: Event) {
  if (pendingProductFocus === undefined) return
  event.preventDefault()
  const id = pendingProductFocus
  pendingProductFocus = undefined
  await nextTick()
  const input = linesRegion.value?.querySelector<HTMLInputElement>(`input[data-product-id="${id}"]`)
  input?.focus({ preventScroll: true })
  input?.select()
  input?.closest('tr')?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const [p, b, s] = await Promise.all([
      productsApi.list({ page: 1, limit: 10000, isActive: true }),
      inventoryApi.buyers(),
      inventoryApi.settings(),
    ])
    products.value = p.data
    buyers.value = b
    settings.value = s
    Object.assign(settingsForm, {
      name: s.name,
      address: s.address,
      phone: s.phone,
      logoUrl: s.logoUrl || '',
      iban: s.iban || '',
      ibanLabel: s.ibanLabel || '',
      defaultInvoiceNotes: s.defaultInvoiceNotes || '',
    })
    if (!notesTouched.value && !editingInvoiceId.value) notes.value = s.defaultInvoiceNotes || ''
    await loadInvoices()
  } catch {
    loadError.value = 'دریافت اطلاعات فروش ممکن نشد. دوباره تلاش کنید.'
  } finally {
    loading.value = false
  }
}
async function loadInvoices() {
  const request = ++archiveRequest
  archiveLoading.value = true
  archiveError.value = ''
  try {
    if (archiveFilters.from && archiveFilters.to && archiveFilters.from > archiveFilters.to) {
      archiveError.value = 'تاریخ شروع باید قبل از پایان باشد.'
      return
    }
    const filters = { ...archiveFilters, ...appliedArchiveText }
    const result = await inventoryApi.invoices(filters)
    if (request === archiveRequest) {
      invoices.value = result
      displayedArchiveFilters.value = filters
    }
  } catch {
    if (request === archiveRequest) archiveError.value = 'دریافت فاکتورها انجام نشد.'
  } finally {
    if (request === archiveRequest) archiveLoading.value = false
  }
}
function clearFilters() {
  clearTimeout(archiveTextTimer)
  Object.assign(appliedArchiveText, { buyer: '', product: '' })
  Object.assign(archiveFilters, { customerId: undefined, buyer: '', product: '', from: '', to: '' })
}
function validateDraft() {
  const error = validateInvoiceLines(draft.value, stockOf)
  if (error) return error
  if (!selectedBuyer.value) return 'خریدار فاکتور را انتخاب کنید.'
  if (
    !Number.isInteger(discount.value) ||
    discount.value < 0 ||
    discount.value > draftSubtotal.value
  )
    return 'تخفیف باید مبلغی بین صفر و جمع اقلام باشد.'
  return ''
}
async function save() {
  if (saving.value) return
  if (editingInvoiceId.value && !hasInvoiceChanges.value) return
  const error = validateDraft()
  if (error) {
    toast.error(error)
    return
  }
  saving.value = true
  try {
    const payload = invoicePayload.value
    activeInvoice.value = editingInvoiceId.value
      ? await inventoryApi.updateInvoice(editingInvoiceId.value, payload)
      : await inventoryApi.createInvoice(payload)
    draft.value = []
    originalItems.value = []
    editingInvoiceId.value = undefined
    previewDraft.value = false
    toast.success('فاکتور ذخیره شد و موجودی به‌روز شد.')
    await load()
    await nextTick()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ذخیره فاکتور انجام نشد.')
  } finally {
    saving.value = false
  }
}
async function openInvoice(invoice: Invoice, print = false) {
  try {
    activeInvoice.value = await inventoryApi.invoice(invoice.id)
    previewDraft.value = false
    await nextTick()
    if (print) await printCurrent()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'دریافت فاکتور انجام نشد.')
  }
}
function resetDraft() {
  notesExpanded.value = false
  draft.value = []
  originalItems.value = []
  editingInvoiceId.value = undefined
  editingInvoiceNumber.value = ''
  originalEditKey.value = ''
  selectedBuyerId.value = undefined
  selectedCategoryId.value = 0
  issueDate.value = todayInTehran()
  discountText.value = '۰'
  settlement.value = 'CASH'
  notes.value = settings.value?.defaultInvoiceNotes || ''
  notesTouched.value = false
  activeInvoice.value = null
  previewDraft.value = false
  activeTab.value = 'new'
}
async function newDraft() {
  if (draft.value.length && !(await confirmDiscard())) return
  resetDraft()
}
async function cancelEdit() {
  if (await confirmDiscard()) resetDraft()
}
function confirmDiscard() {
  return new Promise<boolean>((resolve) => {
    resolveLeaving = resolve
    leaveOpen.value = true
  })
}
async function editInvoice() {
  if (!activeInvoice.value) return
  if (draft.value.length && !(await confirmDiscard())) return
  const invoice = invoiceInRials(activeInvoice.value)
  editingInvoiceId.value = invoice.id
  editingInvoiceNumber.value = invoice.number
  originalItems.value = invoice.items
  draft.value = invoice.items.map((line) => ({ ...line, priceText: number(line.unitPrice) }))
  selectedBuyerId.value = invoice.customerId ?? undefined
  selectedCategoryId.value =
    products.value.find((product) => product.id === invoice.items[0]?.productId)?.categoryId ?? 0
  issueDate.value = (invoice.issueDate || invoice.createdAt).slice(0, 10)
  discountText.value = number(invoice.discount || 0)
  settlement.value = invoice.settlement || 'CASH'
  notes.value = invoice.notes || ''
  notesTouched.value = true
  originalEditKey.value = invoiceEditKey(invoicePayload.value)
  activeInvoice.value = null
  activeTab.value = 'new'
}
async function printDraft() {
  const error = validateDraft()
  if (error) {
    toast.error(error)
    return
  }
  previewDraft.value = true
  await nextTick()
}
async function printCurrent() {
  await nextTick()
  await paperRenderer.value?.prepareForPrint()
  window.print()
}
function openBuyer(buyer?: Buyer) {
  editingBuyerId.value = buyer?.id || null

  Object.assign(buyerForm, {
    firstName: buyer?.firstName || '',
    lastName: buyer?.lastName || '',
    nationalId: buyer?.nationalId || '',
    phone: buyer?.phone || '',
    address: buyer?.address || '',
    notes: buyer?.notes || '',
  })
  buyerOpen.value = true
}
async function saveBuyer() {
  if (buyerSaving.value) return

  if (!buyerForm.firstName.trim() || !buyerForm.lastName.trim()) {
    toast.error('نام و نام خانوادگی الزامی است.')
    return
  }
  buyerSaving.value = true
  try {
    const buyer = editingBuyerId.value
      ? await inventoryApi.updateBuyer(editingBuyerId.value, { ...buyerForm })
      : await inventoryApi.createBuyer({ ...buyerForm })
    const index = buyers.value.findIndex((b) => b.id === buyer.id)
    if (index < 0) buyers.value.push(buyer)
    else buyers.value[index] = buyer
    selectedBuyerId.value = buyer.id
    buyerOpen.value = false
    toast.success('اطلاعات خریدار ذخیره شد.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ذخیره خریدار انجام نشد.')
  } finally {
    buyerSaving.value = false
  }
}
async function saveSettings() {
  if (settingsSaving.value) return

  if (!settingsForm.name.trim()) {
    toast.error('نام فروشگاه الزامی است.')
    return
  }
  settingsSaving.value = true
  try {
    const iban = settingsForm.iban.replace(/\s/g, '').toUpperCase()
    if (iban && !/^IR\d{24}$/.test(iban)) {
      toast.error('شماره شبا باید IR و ۲۴ رقم باشد.')
      return
    }
    settings.value = await inventoryApi.saveSettings({ ...settingsForm, iban })
    if (!notesTouched.value) notes.value = settings.value.defaultInvoiceNotes || ''
    settingsOpen.value = false
    toast.success('اطلاعات فروشگاه ذخیره شد.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ذخیره اطلاعات انجام نشد.')
  } finally {
    settingsSaving.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.invoice-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  gap: 12px;
}
.invoice-page:has(> .invoice-editor) {
  margin: 0;
  padding: 0;
  gap: 0;
}
.invoice-tabs {
  white-space: nowrap;
}
.invoice-tabs button {
  min-height: 34px;
  padding: 6px 14px;
  font-size: 12px;
}
.invoice-editor {
  --background: #fafafa;
  --foreground: #262626;
  --card: #ffffff;
  --card-foreground: #262626;
  --primary: #262626;
  --primary-foreground: #ffffff;
  --secondary: #f5f5f5;
  --secondary-foreground: #404040;
  --muted: #f5f5f5;
  --muted-foreground: #737373;
  --accent: #e5e5e5;
  --accent-foreground: #262626;
  --border: #e5e5e5;
  --input: #d4d4d4;
  --ring: #737373;
  --radius: 4px;
  margin: 0;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  color: var(--foreground);
  background: var(--card);
  container-type: inline-size;
  overflow: hidden;
  width: 100%;
  flex: 1 0 480px;
  min-height: 480px;
  display: flex;
  flex-direction: column;
}
:global(.dark .invoice-editor) {
  --background: #141414;
  --foreground: #ededed;
  --card: #1e1e1e;
  --card-foreground: #ededed;
  --primary: #e5e5e5;
  --primary-foreground: #171717;
  --secondary: #2b2b2b;
  --secondary-foreground: #dedede;
  --muted: #262626;
  --muted-foreground: #b0b0b0;
  --accent: #303030;
  --accent-foreground: #ededed;
  --border: #383838;
  --input: #505050;
  --ring: #a3a3a3;
}
.invoice-editor :deep(.button),
.invoice-editor :deep(.icon-button),
.invoice-editor :deep(.search-select-trigger),
.invoice-editor :deep(.date-picker-trigger),
.invoice-editor input,
.invoice-editor textarea {
  border-radius: 4px;
}
.editor-toolbar {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
}
.editor-title {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  text-align: center;
  overflow-wrap: anywhere;
}
.editor-buyer {
  min-width: 0;
  width: 100%;
  max-width: 280px;
}
.editor-buyer :deep(.search-select-trigger) {
  width: 100%;
  min-width: 0;
}
.editor-buyer :deep(.search-select-trigger > span) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor-buyer :deep(.search-select-trigger > svg) {
  flex-shrink: 0;
}
.editor-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
}
.store-settings-button {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 6px;
  color: var(--muted-foreground);
}
.invoice-editor :deep(.search-select-trigger),
.invoice-editor :deep(.date-picker-trigger) {
  min-height: 32px;
  padding: 5px 10px 5px 16px;
  font-size: 12px;
}
.editor-tools :deep(.date-picker-trigger) {
  white-space: nowrap;
}
.invoice-lines-scroll {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 160px;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: auto;
  scroll-padding-block: 36px 80px;
  border-block: 1px solid var(--border);
}
.line-adder-row {
  --table-adder-background: color-mix(in srgb, var(--primary) 4%, var(--card));
}
.invoice-lines .line-adder-row td {
  position: sticky;
  bottom: 0;
  z-index: 2;
  padding-block: 10px;
  background: var(--table-adder-background);
  box-shadow: 0 -3px 6px color-mix(in srgb, var(--foreground) 4%, transparent);
}
.adder-index {
  color: var(--primary);
}
.line-adder {
  display: grid;
  grid-template-columns: minmax(0, 11fr) minmax(0, 7fr);
  width: 100%;
  max-width: 360px;
  border: 1px solid var(--input);
  border-radius: 4px;
  background: var(--card);
}
.line-adder:focus-within {
  border-color: var(--ring);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ring) 15%, transparent);
}
.line-adder :deep(.search-select-trigger) {
  min-width: 0;
  gap: 6px;
  padding-inline: 8px;
  border: 0;
  border-radius: 0;
  background: transparent;
}
.line-adder :deep(.search-select-trigger:last-child) {
  border-inline-start: 1px solid var(--input);
  background: var(--muted);
}
.line-adder :deep(.search-select-trigger > svg) {
  flex-shrink: 0;
}
.adder-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  color: var(--muted-foreground);
  white-space: normal;
}
.invoice-lines {
  width: 100%;
  min-width: 820px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 12px;
  text-align: center;
}
.index-col {
  width: 44px;
}
.name-col {
  width: 37.5%;
}
.qty-col {
  width: 6.25%;
}
.unit-col {
  width: 12.5%;
}
.price-col {
  width: 18.75%;
}
.total-col {
  width: auto;
}
.invoice-lines th {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--table-header-foreground);
  background: var(--table-header-background);
}
.invoice-lines th .invoice-currency {
  font-size: 0.8em;
  font-weight: 400;
}
.invoice-lines td {
  padding: 3px 8px;
  border-top: 1px solid var(--border);
}
.invoice-lines th:not(:last-child),
.invoice-lines td:not(:last-child) {
  border-inline-end: 1px solid var(--border);
}
.invoice-lines input {
  min-height: 28px;
  padding: 2px 6px;
  font-size: 12px;
  text-align: center;
}
.invoice-lines th:nth-child(2),
.invoice-lines td:nth-child(2) {
  text-align: start;
}
.invoice-lines td:nth-child(2) b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.invoice-lines td:last-child {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.invoice-lines tr:focus-within,
.invoice-lines tbody tr:hover {
  background: var(--table-row-hover);
}
.line-index {
  position: relative;
}
.line-remove {
  position: absolute;
  inset: 0;
  margin: auto;
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 0;
  background: var(--card);
  color: var(--destructive);
  border-radius: 6px;
  opacity: 0;
}
.invoice-lines tr:hover .line-remove,
.invoice-lines tr:focus-within .line-remove {
  opacity: 1;
}
.invoice-lines tr:hover .line-index > span,
.invoice-lines tr:focus-within .line-index > span {
  opacity: 0;
}
@media (hover: none) {
  .line-remove {
    opacity: 1;
  }
  .line-index > span {
    visibility: hidden;
  }
}
.editor-bottom {
  flex-shrink: 0;
  display: grid;
  gap: 10px;
  padding: 10px 14px;
}
.invoice-summary {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 0.8fr) minmax(0, 1.4fr);
  align-items: center;
  gap: 16px;
  font-size: 12px;
}
.subtotal {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.subtotal > span,
.invoice-summary small {
  font-size: 10px;
  font-weight: 400;
  color: var(--muted-foreground);
}
.subtotal b,
.grand-total strong {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.discount-field {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.discount-field > span {
  flex-shrink: 0;
}
.discount-field > span small {
  margin-inline-start: 2px;
}
.editor-bottom .discount-field input {
  min-width: 0;
  width: 100%;
  min-height: 32px;
  padding: 4px 8px;
  font-size: 12px;
  text-align: end;
  font-variant-numeric: tabular-nums;
}
.grand-total {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding-inline-start: 16px;
  border-inline-start: 1px solid var(--border);
}
.grand-total > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
}
.grand-total > div > span {
  flex-shrink: 0;
  font-weight: 500;
}
.grand-total strong {
  font-size: 18px;
  color: var(--primary);
  text-align: end;
}
.grand-total > small {
  text-align: end;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.editor-footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 6px 12px;
  border-top: 1px solid var(--border);
  padding-top: 8px;
}
.editor-options {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 12px;
}
.settlement {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}
.settlement-options {
  display: flex;
  gap: 0;
}
.settlement label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--card);
  font-size: 12px;
  cursor: pointer;
}
.settlement label:first-child {
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}
.settlement label:last-child {
  margin-inline-start: -1px;
  border-start-start-radius: 0;
  border-end-start-radius: 0;
}
.settlement label.selected {
  z-index: 1;
  border-color: var(--primary);
  background: var(--muted);
}
.settlement label:focus-within {
  z-index: 2;
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.settlement:disabled label {
  cursor: default;
  opacity: 0.6;
}
.settlement input {
  accent-color: var(--primary);
  width: 14px;
  min-height: 14px;
  margin: 0;
  padding: 0;
  border: 0;
  box-shadow: none;
  flex: 0 0 14px;
}
.notes-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 4px 6px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--muted-foreground);
  font-size: 12px;
}
.notes-toggle:hover,
.notes-toggle[aria-expanded='true'] {
  background: var(--muted);
  color: var(--foreground);
}
.notes-toggle .rotated {
  transform: rotate(180deg);
}
.notes-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: currentColor;
}
.invoice-notes {
  gap: 4px;
}
.invoice-notes > span {
  font-size: 11px;
}
.invoice-notes textarea {
  width: 100%;
  min-height: 56px;
  max-height: 120px;
  padding: 6px 8px;
  font-size: 12px;
  resize: vertical;
}
.editor-save-hint {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 10px;
  line-height: 1.6;
  color: var(--muted-foreground);
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}
.editor-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.editor-actions :deep(.button) {
  min-height: 32px;
  padding: 5px 10px;
  font-size: 12px;
}
@media screen {
  .invoice-page:has(> .invoice-archive) {
    overflow: hidden;
  }
}
.invoice-archive {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.invoice-archive > .panel-heading,
.archive-filters {
  flex-shrink: 0;
}
.archive-results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}
.archive-summary {
  flex-shrink: 0;
  margin: 0;
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.archive-filters :deep(.date-picker-trigger) {
  width: 100%;
}
.archive-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: end;
}
.archive-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
  padding: 24px;
}
.archive-card {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px;
}
.archive-card > div:first-child {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.archive-card time {
  color: var(--muted-foreground);
  font-size: 11px;
}
.archive-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.archive-card p {
  margin: 10px 0;
}
.full-width {
  grid-column: 1 / -1;
}
.settings-extra {
  margin-top: 18px;
}
.iban-input {
  position: relative;
  display: block;
}
.iban-input__prefix {
  position: absolute;
  left: 13px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  font-weight: 700;
  color: var(--foreground);
}
.iban-input input {
  padding-left: 38px;
}
@container (max-width: 640px) {
  .editor-toolbar {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 10px;
  }
  .editor-title {
    grid-column: 1 / -1;
    grid-row: 1;
    font-size: 14px;
  }
  .editor-buyer {
    max-width: none;
  }
  .editor-toolbar :deep(.search-select-trigger),
  .editor-toolbar :deep(.date-picker-trigger),
  .store-settings-button {
    min-height: 44px;
  }
  .store-settings-button {
    width: 44px;
    height: 44px;
  }
  .editor-tools :deep(.date-picker-trigger) {
    padding-inline: 8px;
    gap: 6px;
  }
}
@media (max-width: 740px) {
  .editor-toolbar,
  .editor-bottom {
    padding-inline: 14px;
  }
  .archive-filters {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 12px;
  }
}
@container (max-width: 680px) {
  .invoice-summary {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 8px 16px;
  }
  .grand-total {
    grid-column: 1 / -1;
    padding-inline-start: 0;
    border-inline-start: 0;
  }
  .grand-total > small {
    display: none;
  }
  .grand-total strong {
    font-size: 17px;
  }
  .editor-footer {
    grid-template-columns: minmax(0, 1fr);
  }
  .editor-options {
    justify-content: space-between;
  }
  .editor-actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .editor-actions :deep(.button--ghost) {
    grid-column: 1 / -1;
  }
  .editor-actions :deep(.button),
  .settlement label,
  .notes-toggle,
  .editor-bottom .discount-field input {
    min-height: 44px;
  }
}
@container (max-width: 340px) {
  .editor-toolbar {
    grid-template-columns: minmax(0, 1fr);
  }
  .editor-tools {
    justify-content: space-between;
  }
  .editor-tools :deep(.date-picker-trigger) {
    flex: 1;
    justify-content: center;
  }
}
@media (max-width: 600px) {
  .invoice-editor {
    flex-basis: 680px;
    min-height: 680px;
  }
  .invoice-tabs button {
    flex: 1;
  }
}
</style>
<style>
.invoice-preview-dialog {
  height: min(calc(100dvh - 32px), 900px);
}
.invoice-preview-dialog .dialog-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  padding: 8px;
}
.invoice-preview-dialog .invoice-sheets {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  align-content: start;
}
.invoice-preview-dialog .form-actions {
  flex-wrap: wrap;
  gap: 8px;
}
.invoice-preview-dialog .form-actions .badge {
  margin-inline-end: auto;
}
@media print {
  .dialog-content.invoice-preview-dialog {
    display: block !important;
    position: static;
    transform: none;
    width: 198mm;
    max-width: none !important;
    height: auto;
    max-height: none;
    overflow: visible;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: #fff;
  }
  .invoice-preview-dialog .dialog-heading,
  .invoice-preview-dialog .dialog-footer {
    display: none !important;
  }
  .invoice-preview-dialog .dialog-body,
  .invoice-preview-dialog .invoice-sheets {
    display: block;
    height: auto;
    max-height: none;
    overflow: visible;
    padding: 0;
  }
}
</style>
