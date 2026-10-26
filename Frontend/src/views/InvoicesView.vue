<template>
  <div class="page-stack invoice-page">
    <div class="invoice-nav no-print">
      <div class="segmented-control">
        <button :aria-pressed="activeTab === 'new'" @click="switchTab('new')">فاکتور فروش</button>
        <button :aria-pressed="activeTab === 'archive'" @click="switchTab('archive')">
          بایگانی فاکتورها
        </button>
      </div>
      <span class="muted">همه مبالغ فاکتور به ریال</span>
    </div>
    <div v-if="loadError" class="notice notice--error no-print" role="alert">
      {{ loadError }}<Button variant="outline" @click="load">تلاش دوباره</Button>
    </div>
    <div v-if="loading" class="table-loading panel no-print" role="status">
      در حال دریافت اطلاعات…
    </div>
    <section
      v-else-if="activeTab === 'new' && !activeInvoice && !previewDraft"
      class="panel invoice-editor no-print"
      :aria-busy="saving"
    >
      <header class="editor-heading">
        <div>
          <h1>
            {{ editingInvoiceId ? 'ویرایش فاکتور ' + editingInvoiceNumber : 'فاکتور فروش جدید' }}
          </h1>
          <small class="muted">{{
            editingInvoiceId
              ? 'تغییرات پس از ذخیره اعمال می‌شوند.'
              : 'شماره فاکتور پس از ثبت تعیین می‌شود.'
          }}</small>
        </div>
        <PersianDatePicker v-model="issueDate" :disabled="saving" />
      </header>
      <div class="editor-parties">
        <div class="seller-inline">
          <span class="muted">فروشنده</span><b>{{ settings?.name }}</b
          ><button
            class="icon-button"
            aria-label="ویرایش مشخصات فروشگاه"
            @click="settingsOpen = true"
          >
            <Pencil :size="16" /></button
          ><small class="muted">{{ settings?.phone }} {{ settings?.address }}</small>
        </div>
        <div class="buyer-inline">
          <SearchSelect
            v-model="selectedBuyerId"
            :options="buyerOptions"
            label="خریدار"
            placeholder="انتخاب خریدار"
            create-label="طرف حساب جدید"
            @create="openBuyer()"
          />
          <button
            v-if="selectedBuyer"
            class="icon-button"
            aria-label="ویرایش خریدار"
            @click="openBuyer(selectedBuyer)"
          >
            <Pencil :size="16" />
          </button>
          <button
            v-if="selectedBuyer"
            class="icon-button icon-button--delete"
            aria-label="حذف خریدار"
            @click="buyerToDelete = selectedBuyer"
          >
            <Trash2 :size="16" />
          </button>
          <small v-if="selectedBuyer" class="muted"
            >{{ selectedBuyer.phone }} {{ selectedBuyer.address }}</small
          >
        </div>
      </div>
      <div class="product-adder">
        <SearchSelect
          v-model="selectedCategoryId"
          :options="categoryOptions"
          label="دسته‌بندی کالا"
          placeholder="۱. انتخاب دسته‌بندی"
          :disabled="saving"
        />
        <SearchSelect
          :options="productOptions"
          label="کالا"
          :placeholder="
            selectedCategoryId ? '۲. انتخاب یا جست‌وجوی کالا…' : 'ابتدا دسته‌بندی را انتخاب کنید'
          "
          :disabled="saving || !selectedCategoryId"
          @update:model-value="addProduct"
        />
      </div>
      <div class="invoice-lines-scroll" tabindex="0" role="region" aria-label="اقلام فاکتور">
        <table class="invoice-lines">
          <colgroup>
            <col class="index-col" />
            <col />
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
              <th>فی · ریال</th>
              <th>جمع · ریال</th>
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
                <input
                  v-model.number="line.quantity"
                  type="number"
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
            <tr v-if="!draft.length">
              <td colspan="6" class="empty-lines">
                کالایی را از کادر بالا انتخاب کنید تا به فاکتور اضافه شود.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="editor-bottom">
        <div class="financial-fields">
          <div class="subtotal">
            <span>جمع اقلام</span><b>{{ rial(draftSubtotal) }}</b>
          </div>
          <label class="form-field"
            ><span>تخفیف · ریال <small>اختیاری</small></span
            ><MoneyInput
              v-model="discountText"
              :disabled="saving"
              aria-label="تخفیف فاکتور به ریال"
              placeholder="۰"
          /></label>
        </div>
        <div class="grand-total">
          <span
            >جمع کل فاکتور <strong>{{ rial(draftTotal) }}</strong></span
          ><small>{{ amountInWords(draftTotal) }}</small>
        </div>
        <fieldset class="settlement">
          <legend>شرایط تسویه‌حساب</legend>
          <label
            ><input v-model="settlement" type="radio" value="CASH" :disabled="saving" /> نقدی</label
          ><label
            ><input v-model="settlement" type="radio" value="INSTALLMENT" :disabled="saving" />
            اقساطی</label
          >
        </fieldset>
        <label class="form-field invoice-notes"
          ><span>توضیحات</span
          ><textarea
            v-model="notes"
            rows="1"
            maxlength="600"
            :disabled="saving"
            @input="notesTouched = true"
          />
        </label>
        <p v-if="saveError" class="notice notice--error" role="alert">{{ saveError }}</p>
        <div class="editor-actions">
          <Button :disabled="saving || !draft.length || !selectedBuyer || !!loadError" @click="save"
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
          <small class="muted">با ثبت فاکتور، موجودی کالاها به‌روز می‌شود.</small>
        </div>
      </div>
    </section>
    <section v-if="activeTab === 'archive' && !activeInvoice" class="panel no-print">
      <div class="panel-heading">
        <h2>بایگانی فاکتورها</h2>
        <Button variant="ghost" size="sm" @click="clearFilters">پاک‌کردن فیلترها</Button>
      </div>
      <form class="archive-filters panel-body" @submit.prevent="loadInvoices">
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
          ><span>نام یا کد کالا</span><input v-model="archiveFilters.product"
        /></label>
        <label class="form-field"
          ><span>از تاریخ صدور</span><input v-model="archiveFilters.from" type="date"
        /></label>
        <label class="form-field"
          ><span>تا تاریخ صدور</span><input v-model="archiveFilters.to" type="date"
        /></label>
        <Button type="submit" :disabled="archiveLoading"><Search :size="16" />جست‌وجو</Button>
      </form>
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
    </section>
    <section v-if="activeInvoice || previewDraft" ref="paperSection" class="invoice-preview">
      <div class="paper-toolbar no-print">
        <span class="badge" :class="activeInvoice ? 'badge--success' : 'badge--warning'">{{
          activeInvoice ? 'فاکتور ثبت‌شده' : 'پیش‌نویس · ثبت نشده'
        }}</span>
        <div>
          <Button variant="outline" @click="printCurrent"><Printer :size="17" />چاپ A5 افقی</Button>
          <Button v-if="activeInvoice" variant="outline" @click="editInvoice"
            ><Pencil :size="16" />ویرایش</Button
          >
          <Button v-if="activeInvoice" @click="newDraft"><Plus :size="16" />فاکتور جدید</Button>
          <Button v-if="activeInvoice" variant="ghost" @click="activeInvoice = null">بازگشت</Button>
          <Button v-else variant="ghost" @click="previewDraft = false">ادامه ویرایش</Button>
        </div>
      </div>
      <InvoicePaper
        ref="paperRenderer"
        :invoice="activeInvoice || draftInvoice"
        :settings="settings"
        :draft="!activeInvoice"
      />
    </section>
    <AppDialog
      v-model:open="leaveOpen"
      title="فاکتور هنوز ثبت نشده است"
      width="460px"
      @update:open="!$event && finishLeaving(false)"
    >
      <p>با خروج از این صفحه، اقلام فاکتور ثبت‌نشده از دست می‌روند.</p>
      <div class="form-actions">
        <Button variant="outline" @click="finishLeaving(false)">ادامه ویرایش</Button>
        <Button variant="destructive" @click="finishLeaving(true)">خروج بدون ثبت</Button>
      </div>
    </AppDialog>
    <AppDialog
      :open="buyerOpen"
      @update:open="!buyerSaving && (buyerOpen = $event)"
      :title="editingBuyerId ? 'ویرایش خریدار' : 'ثبت خریدار جدید'"
      width="620px"
      ><form @submit.prevent="saveBuyer">
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
        <p v-if="buyerError" class="notice notice--error" role="alert">{{ buyerError }}</p>
        <div class="form-actions">
          <Button variant="outline" @click="buyerOpen = false">انصراف</Button
          ><Button type="submit" :disabled="buyerSaving">{{
            buyerSaving ? 'در حال ذخیره…' : 'ذخیره خریدار'
          }}</Button>
        </div>
      </form></AppDialog
    >
    <AppDialog
      :open="!!buyerToDelete"
      title="حذف خریدار"
      width="440px"
      @update:open="!$event && (buyerToDelete = null)"
      ><p>
        خریدار «{{ buyerToDelete?.firstName }} {{ buyerToDelete?.lastName }}» حذف شود؟ اطلاعات
        فاکتورهای قبلی باقی می‌ماند.
      </p>
      <p v-if="deleteError" class="notice notice--error" role="alert">{{ deleteError }}</p>
      <div class="form-actions">
        <Button variant="outline" @click="buyerToDelete = null">انصراف</Button
        ><Button variant="destructive" :disabled="buyerSaving" @click="deleteBuyer"
          >تأیید حذف</Button
        >
      </div></AppDialog
    >
    <AppDialog
      :open="settingsOpen"
      @update:open="!settingsSaving && (settingsOpen = $event)"
      title="اطلاعات فروشگاه"
      width="600px"
      ><form @submit.prevent="saveSettings">
        <div class="form-grid">
          <label class="form-field"
            ><span>نام فروشگاه</span
            ><input v-model="settingsForm.name" required maxlength="100" /></label
          ><label class="form-field"
            ><span>شماره تماس</span
            ><input v-model="settingsForm.phone" type="tel" maxlength="30" /></label
          ><label class="form-field full-width"
            ><span>نشانی فروشگاه</span
            ><textarea v-model="settingsForm.address" rows="2" maxlength="200" /></label
          ><label class="form-field full-width"
            ><span>نشانی تصویر لوگو <small>اختیاری</small></span
            ><input
              v-model="settingsForm.logoUrl"
              type="text"
              placeholder="/logo.png"
              dir="ltr"
              maxlength="2000"
            />
            <small class="muted"
              >آدرس کامل یا مسیر فایل در پوشه public، مانند /logo.png</small
            ></label
          >
        </div>
        <label class="form-field settings-extra"
          ><span>شماره شبای فروشنده</span
          ><input v-model="settingsForm.iban" dir="ltr" maxlength="26" placeholder="IR…"
        /></label>
        <label class="form-field settings-extra"
          ><span>توضیحات پیش‌فرض فاکتور</span
          ><textarea v-model="settingsForm.defaultInvoiceNotes" maxlength="600" rows="3" /><small
            >در فاکتورهای جدید درج می‌شود و برای هر فاکتور قابل ویرایش است.</small
          ></label
        >
        <p v-if="settingsError" class="notice notice--error" role="alert">{{ settingsError }}</p>
        <div class="form-actions">
          <Button variant="outline" @click="settingsOpen = false">انصراف</Button
          ><Button type="submit" :disabled="settingsSaving">{{
            settingsSaving ? 'در حال ذخیره…' : 'ذخیره اطلاعات'
          }}</Button>
        </div>
      </form></AppDialog
    >
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { Check, Pencil, Plus, Printer, Search, Trash2 } from '@lucide/vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import SearchSelect from '@/components/ui/SearchSelect.vue'
import PersianDatePicker from '@/components/ui/PersianDatePicker.vue'
import InvoicePaper from '@/components/InvoicePaper.vue'
import { toast } from '@/lib/toast'
import { date, number, parseNumber } from '@/lib/format'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { validateInvoiceLines } from '@/lib/invoice'
import { amountInWords, invoiceInRials, rial } from '@/lib/invoicePresentation'
import { todayInTehran } from '@/lib/persianDate'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import type { Buyer, Invoice, InvoiceItem, Product, StoreSettings } from '@/types'
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
const selectedCategoryId = ref<number>()
const editingInvoiceId = ref<number>(),
  editingInvoiceNumber = ref('')
const originalItems = ref<InvoiceItem[]>([])
const issueDate = ref(todayInTehran()),
  notes = ref(''),
  notesTouched = ref(false)
const discountText = ref('۰')
const settlement = ref<'CASH' | 'INSTALLMENT'>('CASH')
const loading = ref(true),
  saving = ref(false),
  loadError = ref(''),
  saveError = ref('')
const archiveLoading = ref(false),
  archiveError = ref(''),
  previewDraft = ref(false),
  paperSection = ref<HTMLElement>()
const buyerOpen = ref(false),
  buyerSaving = ref(false),
  buyerError = ref(''),
  editingBuyerId = ref<number | null>(null),
  buyerToDelete = ref<Buyer | null>(null),
  deleteError = ref('')
const settingsOpen = ref(false),
  settingsSaving = ref(false),
  settingsError = ref('')
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
  defaultInvoiceNotes: '',
})
const archiveFilters = reactive({
  customerId: undefined as number | undefined,
  buyer: '',
  product: '',
  from: '',
  to: '',
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
const categoryOptions = computed(() =>
  Array.from(
    new Map(products.value.map((product) => [product.categoryId, product.category])).values(),
  )
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'))
    .map((category) => ({ value: category.id, label: category.name })),
)
const productOptions = computed(() =>
  products.value
    .filter((product) => product.categoryId === selectedCategoryId.value)
    .map((product) => ({
      value: product.id,
      label: product.name,
      description:
        product.sku +
        ' · موجودی ' +
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
watch(buyerToDelete, () => {
  deleteError.value = ''
})
function switchTab(tab: 'new' | 'archive') {
  if (saving.value) return
  activeTab.value = tab
  activeInvoice.value = null
  previewDraft.value = false
}
function addProduct(id: number) {
  const product = products.value.find((item) => item.id === id)
  if (!product || product.categoryId !== selectedCategoryId.value) return
  const line = draft.value.find((item) => item.productId === id)
  if ((line?.quantity || 0) + 1 > stockOf(id)) return toast.warning('موجودی این کالا کافی نیست.')
  if (line) line.quantity++
  else
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
  archiveLoading.value = true
  archiveError.value = ''
  try {
    if (archiveFilters.from && archiveFilters.to && archiveFilters.from > archiveFilters.to) {
      archiveError.value = 'تاریخ شروع باید قبل از پایان باشد.'
      return
    }
    invoices.value = await inventoryApi.invoices(archiveFilters)
  } catch {
    archiveError.value = 'دریافت فاکتورها انجام نشد.'
  } finally {
    archiveLoading.value = false
  }
}
function clearFilters() {
  Object.assign(archiveFilters, { customerId: undefined, buyer: '', product: '', from: '', to: '' })
  void loadInvoices()
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
  saveError.value = validateDraft()
  if (saveError.value) return
  saving.value = true
  try {
    const payload = {
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
    }
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
    paperSection.value?.scrollIntoView({ block: 'start' })
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'ذخیره فاکتور انجام نشد.'
  } finally {
    saving.value = false
  }
}
async function openInvoice(invoice: Invoice, print = false) {
  try {
    activeInvoice.value = await inventoryApi.invoice(invoice.id)
    previewDraft.value = false
    await nextTick()
    paperSection.value?.scrollIntoView({ block: 'start' })
    if (print) await printCurrent()
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'دریافت فاکتور انجام نشد.')
  }
}
function resetDraft() {
  draft.value = []
  originalItems.value = []
  editingInvoiceId.value = undefined
  editingInvoiceNumber.value = ''
  selectedBuyerId.value = undefined
  selectedCategoryId.value = undefined
  issueDate.value = todayInTehran()
  discountText.value = '۰'
  settlement.value = 'CASH'
  notes.value = settings.value?.defaultInvoiceNotes || ''
  notesTouched.value = false
  saveError.value = ''
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
  selectedCategoryId.value = products.value.find(
    (product) => product.id === invoice.items[0]?.productId,
  )?.categoryId
  issueDate.value = (invoice.issueDate || invoice.createdAt).slice(0, 10)
  discountText.value = number(invoice.discount || 0)
  settlement.value = invoice.settlement || 'CASH'
  notes.value = invoice.notes || ''
  notesTouched.value = true
  saveError.value = ''
  activeInvoice.value = null
  activeTab.value = 'new'
}
async function printDraft() {
  saveError.value = validateDraft()
  if (!saveError.value) {
    previewDraft.value = true
    await nextTick()
    paperSection.value?.scrollIntoView({ block: 'start' })
  }
}
async function printCurrent() {
  await nextTick()
  await paperRenderer.value?.prepareForPrint()
  window.print()
}
function openBuyer(buyer?: Buyer) {
  editingBuyerId.value = buyer?.id || null
  buyerError.value = ''
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
  buyerError.value = ''
  if (!buyerForm.firstName.trim() || !buyerForm.lastName.trim()) {
    buyerError.value = 'نام و نام خانوادگی الزامی است.'
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
    buyerError.value = e instanceof Error ? e.message : 'ذخیره خریدار انجام نشد.'
  } finally {
    buyerSaving.value = false
  }
}
async function deleteBuyer() {
  if (!buyerToDelete.value || buyerSaving.value) return
  buyerSaving.value = true
  deleteError.value = ''
  try {
    const id = buyerToDelete.value.id
    await inventoryApi.deleteBuyer(id)
    buyers.value = buyers.value.filter((b) => b.id !== id)
    if (selectedBuyerId.value === id) selectedBuyerId.value = undefined
    buyerToDelete.value = null
    toast.success('خریدار حذف شد.')
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'حذف خریدار انجام نشد.'
  } finally {
    buyerSaving.value = false
  }
}
async function saveSettings() {
  if (settingsSaving.value) return
  settingsError.value = ''
  if (!settingsForm.name.trim()) {
    settingsError.value = 'نام فروشگاه الزامی است.'
    return
  }
  settingsSaving.value = true
  try {
    const iban = settingsForm.iban.replace(/\s/g, '').toUpperCase()
    if (iban && !/^IR\d{24}$/.test(iban)) {
      settingsError.value = 'شماره شبا باید IR و ۲۴ رقم باشد.'
      return
    }
    settings.value = await inventoryApi.saveSettings({ ...settingsForm, iban })
    if (!notesTouched.value) notes.value = settings.value.defaultInvoiceNotes || ''
    settingsOpen.value = false
    toast.success('اطلاعات فروشگاه ذخیره شد.')
  } catch (e) {
    settingsError.value = e instanceof Error ? e.message : 'ذخیره اطلاعات انجام نشد.'
  } finally {
    settingsSaving.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.invoice-page {
  gap: 12px;
}
.invoice-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.invoice-nav > span {
  font-size: 11px;
}
.invoice-editor {
  overflow: hidden;
  width: 100%;
  max-width: 1120px;
  margin-inline: auto;
}
.editor-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
}
.editor-heading h1 {
  margin: 0;
  font-size: 16px;
}
.editor-heading > div {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.editor-heading small {
  font-size: 10px;
}
.invoice-editor :deep(.search-select-trigger),
.invoice-editor :deep(.date-picker-trigger) {
  min-height: 32px;
  padding: 5px 8px;
  font-size: 12px;
}
.editor-parties {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: 12px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--border);
}
.seller-inline,
.buyer-inline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
}
.editor-parties .icon-button {
  width: 28px;
  height: 28px;
  min-height: 28px;
  padding: 4px;
}
.seller-inline > small,
.buyer-inline > small {
  width: 100%;
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.buyer-inline > :first-child {
  flex: 1;
  min-width: 160px;
}
.product-adder {
  display: grid;
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.6fr);
  gap: 8px;
  padding: 10px 14px;
}
.invoice-lines-scroll {
  max-height: 270px;
  overflow: auto;
  overscroll-behavior: contain;
  border-block: 1px solid var(--border);
}
.invoice-lines {
  width: 100%;
  min-width: 660px;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
  font-size: 12px;
  text-align: center;
}
.index-col {
  width: 5%;
}
.qty-col {
  width: 10%;
}
.unit-col {
  width: 11%;
}
.price-col {
  width: 19%;
}
.total-col {
  width: 23%;
}
.invoice-lines th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px 8px;
  font-size: 11px;
  color: var(--muted-foreground);
  background: var(--muted);
}
.invoice-lines td {
  padding: 3px 8px;
  border-top: 1px solid var(--border);
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
  background: var(--muted);
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
.empty-lines {
  height: 72px;
  text-align: center;
  color: var(--muted-foreground);
}
.editor-bottom {
  padding: 10px 14px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  gap: 8px 16px;
}
.editor-bottom > .financial-fields,
.editor-bottom > .grand-total,
.editor-bottom > .notice,
.editor-bottom > .editor-actions {
  grid-column: 1 / -1;
}
.editor-bottom .form-field {
  gap: 3px;
}
.editor-bottom .form-field > span {
  font-size: 11px;
}
.editor-bottom input:not([type='radio']),
.editor-bottom textarea {
  min-height: 32px;
  padding: 4px 8px;
  font-size: 12px;
}
.invoice-notes {
  display: flex;
  align-items: center;
}
.invoice-notes textarea {
  flex: 1;
  width: 0;
}
.editor-actions :deep(.button) {
  min-height: 34px;
  padding: 6px 12px;
  font-size: 12px;
}
.financial-fields {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: end;
  gap: 12px;
  font-size: 11px;
}
.subtotal {
  display: grid;
  gap: 4px;
  align-self: center;
}
.subtotal > span {
  color: var(--muted-foreground);
}
.grand-total {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
  background: var(--accent);
  color: var(--accent-foreground);
  padding: 7px 10px;
  border-radius: 8px;
}
.grand-total strong {
  margin-inline-start: 8px;
  font-size: 16px;
}
.grand-total small {
  font-size: 11px;
}
.settlement {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0;
  margin: 0;
  border: 0;
  font-size: 11px;
}
.settlement legend {
  float: right;
  margin-inline-end: 8px;
}
.settlement label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.settlement input {
  accent-color: var(--primary);
  width: 16px;
  min-height: 16px;
  padding: 0;
  border: 0;
  box-shadow: none;
  flex: 0 0 16px;
}
.editor-actions,
.paper-toolbar,
.paper-toolbar > div {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.editor-actions > small {
  margin-inline-start: auto;
  font-size: 11px;
}
.paper-toolbar {
  justify-content: space-between;
  margin-bottom: 20px;
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
@media (max-width: 740px) {
  .editor-parties {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .financial-fields {
    grid-template-columns: 1fr 1fr;
  }
  .editor-heading {
    flex-wrap: wrap;
  }
  .editor-heading,
  .editor-parties,
  .editor-bottom {
    padding-inline: 14px;
  }
  .product-adder {
    padding-inline: 14px;
  }
  .editor-bottom {
    grid-template-columns: minmax(0, 1fr);
  }
  .archive-filters {
    grid-template-columns: 1fr;
  }
  .invoice-nav {
    flex-wrap: wrap;
  }
}
@media (max-width: 480px) {
  .product-adder {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
