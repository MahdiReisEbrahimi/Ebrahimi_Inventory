<template>
  <div class="page-stack invoice-page">
    <PageHeader
      class="no-print"
      title="فاکتورهای فروش"
      description="از انتخاب کالا تا صدور و چاپ فاکتور، در چند قدم ساده."
      eyebrow="فروش فروشگاه"
      ><Button variant="outline" @click="settingsOpen = true"
        ><Settings2 :size="17" />اطلاعات فروشگاه</Button
      ></PageHeader
    >
    <div class="invoice-toolbar no-print">
      <div class="segmented-control">
        <button :aria-pressed="activeTab === 'new'" @click="switchTab('new')">فاکتور جدید</button
        ><button :aria-pressed="activeTab === 'archive'" @click="switchTab('archive')">
          بایگانی فاکتورها
        </button>
      </div>
      <span class="muted">قیمت‌ها به تومان هستند</span>
    </div>
    <div v-if="loadError" class="notice notice--error no-print" role="alert">
      {{ loadError }}<Button variant="outline" @click="load">تلاش دوباره</Button>
    </div>
    <div v-if="loading" class="table-loading panel no-print" role="status">
      در حال دریافت اطلاعات فروش…
    </div>
    <div
      v-else-if="activeTab === 'new' && !activeInvoice"
      class="invoice-editor no-print"
      :aria-busy="saving"
    >
      <div class="invoice-steps">
        <section class="panel">
          <div class="panel-heading">
            <div class="step-heading">
              <span class="step-number">۱</span>
              <div>
                <h2>خریدار فاکتور</h2>
                <p>یک خریدار انتخاب کنید یا خریدار تازه‌ای ثبت کنید.</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" @click="openBuyer()"
              ><Plus :size="15" />خریدار جدید</Button
            >
          </div>
          <div class="panel-body">
            <label class="form-field"
              ><span>نام خریدار</span
              ><select v-model.number="selectedBuyerId">
                <option :value="undefined">انتخاب خریدار</option>
                <option v-for="buyer in buyers" :key="buyer.id" :value="buyer.id">
                  {{ buyer.firstName }} {{ buyer.lastName
                  }}{{ buyer.nationalId ? ' · ' + buyer.nationalId : '' }}
                </option>
              </select></label
            >
            <div v-if="selectedBuyer" class="buyer-preview">
              <div>
                <b>{{ selectedBuyer.firstName }} {{ selectedBuyer.lastName }}</b>
                <p>
                  {{ selectedBuyer.phone || 'شماره تماس ثبت نشده' }} ·
                  {{ selectedBuyer.address || 'نشانی ثبت نشده' }}
                </p>
              </div>
              <button
                class="icon-button"
                aria-label="ویرایش خریدار"
                @click="openBuyer(selectedBuyer)"
              >
                <Pencil :size="17" /></button
              ><button
                class="icon-button icon-button--delete"
                aria-label="حذف خریدار"
                @click="buyerToDelete = selectedBuyer"
              >
                <Trash2 :size="17" />
              </button>
            </div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-heading">
            <div class="step-heading">
              <span class="step-number">۲</span>
              <div>
                <h2>کالاهای فاکتور</h2>
                <p>کالا را اضافه کنید؛ سپس تعداد و قیمت را بررسی کنید.</p>
              </div>
            </div>
            <Package :size="22" class="muted" />
          </div>
          <div class="panel-body product-adder">
            <label class="form-field"
              ><span>دسته‌بندی</span
              ><select v-model.number="selectedCategoryId" @change="selectedProductId = undefined">
                <option :value="undefined">همه دسته‌بندی‌ها</option>
                <option
                  v-for="category in productCategories"
                  :key="category.id"
                  :value="category.id"
                >
                  {{ category.name }}
                </option>
              </select></label
            ><label class="form-field"
              ><span>کالا</span
              ><select v-model.number="selectedProductId">
                <option :value="undefined">انتخاب کالا</option>
                <option
                  v-for="product in availableProducts"
                  :key="product.id"
                  :value="product.id"
                  :disabled="product.stock < 1"
                >
                  {{ product.name }} · موجودی {{ number(product.stock) }} {{ product.unit }}
                </option>
              </select></label
            ><Button variant="outline" :disabled="!selectedProductId" @click="addProduct"
              ><Plus :size="16" />افزودن</Button
            >
          </div>
          <EmptyState
            v-if="!draft.length"
            title="اولین کالا را اضافه کنید"
            description="اقلام فاکتور و جمع مبلغ در این قسمت نمایش داده می‌شود."
          />
          <div v-else class="draft-lines">
            <article v-for="(line, index) in draft" :key="line.productId" class="draft-line">
              <div class="draft-line__head">
                <span class="line-counter">{{ number(index + 1) }}</span>
                <div>
                  <b>{{ line.name }}</b
                  ><small
                    >موجودی قابل فروش: {{ number(stockOf(line.productId)) }} {{ line.unit }}</small
                  >
                </div>
                <button
                  class="icon-button icon-button--delete"
                  :aria-label="'حذف ' + line.name + ' از فاکتور'"
                  @click="draft.splice(index, 1)"
                >
                  <Trash2 :size="17" />
                </button>
              </div>
              <div class="draft-line__fields">
                <label class="form-field"
                  ><span>تعداد · {{ line.unit }}</span
                  ><input
                    v-model.number="line.quantity"
                    type="number"
                    min="1"
                    :max="stockOf(line.productId)"
                    step="1"
                    required /></label
                ><label class="form-field"
                  ><span>قیمت واحد · تومان</span
                  ><input
                    v-model="line.priceText"
                    inputmode="numeric"
                    @input="line.unitPrice = parseNumber(line.priceText)"
                    @blur="formatLinePrice(line)"
                /></label>
                <div class="line-total">
                  <small>جمع این کالا</small
                  ><strong>{{ money(line.quantity * line.unitPrice) }}</strong>
                </div>
              </div>
            </article>
          </div>
        </section>
      </div>
      <aside class="invoice-summary panel">
        <div class="panel-heading">
          <div class="step-heading">
            <span class="step-number">۳</span>
            <h2>بررسی و صدور</h2>
          </div>
        </div>
        <div class="panel-body">
          <div class="summary-row">
            <span>خریدار</span
            ><b>{{
              selectedBuyer ? selectedBuyer.firstName + ' ' + selectedBuyer.lastName : 'انتخاب نشده'
            }}</b>
          </div>
          <div class="summary-row">
            <span>تعداد ردیف</span><b>{{ number(draft.length) }}</b>
          </div>
          <div class="summary-total">
            <span>مبلغ نهایی</span><strong>{{ money(draftTotal) }}</strong>
          </div>
          <p class="summary-note">
            <Info :size="16" />با صدور فاکتور، تعداد کالاها از موجودی کم می‌شود.
          </p>
          <p v-if="saveError" class="notice notice--error" role="alert">{{ saveError }}</p>
          <Button :disabled="saving || !draft.length || !selectedBuyer || !!loadError" @click="save"
            ><Receipt :size="18" />{{ saving ? 'در حال صدور…' : 'ثبت و صدور فاکتور' }}</Button
          ><Button variant="outline" :disabled="!draft.length" @click="printDraft"
            ><Printer :size="17" />پیش‌نمایش چاپ</Button
          ><small class="summary-help">پیش‌نمایش، موجودی را تغییر نمی‌دهد.</small>
        </div>
      </aside>
    </div>

    <section v-if="activeTab === 'archive'" class="panel no-print">
      <div class="panel-heading">
        <div>
          <h2>بایگانی فروش</h2>
          <p>حداکثر ۵۰۰ فاکتور اخیر، مطابق فیلترهای انتخابی</p>
        </div>
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
        ><label class="form-field"
          ><span>نام یا کد ملی</span
          ><input v-model="archiveFilters.buyer" placeholder="جست‌وجوی خریدار" /></label
        ><label class="form-field"
          ><span>کالا</span
          ><input v-model="archiveFilters.product" placeholder="نام یا کد کالا" /></label
        ><label class="form-field"
          ><span>از تاریخ</span><input v-model="archiveFilters.from" type="date" /></label
        ><label class="form-field"
          ><span>تا تاریخ</span><input v-model="archiveFilters.to" type="date" /></label
        ><Button type="submit" :disabled="archiveLoading"><Search :size="16" />جست‌وجو</Button>
      </form>
      <p v-if="archiveError" class="notice notice--error" role="alert">{{ archiveError }}</p>
      <div v-if="archiveLoading" class="table-loading" role="status">در حال دریافت فاکتورها…</div>
      <div v-else-if="invoices.length" class="archive-grid">
        <article v-for="invoice in invoices" :key="invoice.id" class="archive-card">
          <div class="archive-card__top">
            <span class="invoice-icon"><Receipt :size="21" /></span
            ><time>{{ date(invoice.createdAt) }}</time>
          </div>
          <b class="archive-buyer"
            >{{ invoice.buyerFirstName || 'خریدار' }} {{ invoice.buyerLastName }}</b
          ><span class="invoice-number">{{ invoice.number }}</span>
          <div class="archive-amount">
            <span>جمع فاکتور</span><strong>{{ money(invoice.total) }}</strong>
          </div>
          <div class="archive-card__actions">
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
        description="فیلترها را تغییر دهید یا اولین فاکتور فروش را ثبت کنید."
      />
    </section>
    <section v-if="activeInvoice || previewDraft" ref="paperSection" class="invoice-preview">
      <div class="paper-toolbar no-print">
        <div>
          <span v-if="activeInvoice" class="badge badge--success"
            ><Check :size="14" />فاکتور ثبت‌شده</span
          ><span v-else class="badge badge--warning">پیش‌نویس · ثبت نشده</span>
        </div>
        <div>
          <Button variant="outline" @click="printCurrent"><Printer :size="17" />چاپ فاکتور</Button
          ><Button v-if="activeInvoice" @click="newDraft"><Plus :size="17" />فاکتور جدید</Button
          ><Button v-else variant="ghost" @click="previewDraft = false">بستن پیش‌نمایش</Button>
        </div>
      </div>
      <InvoicePaper
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
      v-model:open="buyerOpen"
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
    <AppDialog v-model:open="settingsOpen" title="اطلاعات فروشگاه" width="600px"
      ><form @submit.prevent="saveSettings">
        <div class="form-grid">
          <label class="form-field"
            ><span>نام فروشگاه</span><input v-model="settingsForm.name" required /></label
          ><label class="form-field"
            ><span>شماره تماس</span><input v-model="settingsForm.phone" type="tel" /></label
          ><label class="form-field full-width"
            ><span>نشانی فروشگاه</span><textarea v-model="settingsForm.address" rows="2" /></label
          ><label class="form-field full-width"
            ><span>نشانی تصویر لوگو <small>اختیاری</small></span
            ><input v-model="settingsForm.logoUrl" type="url" placeholder="https://…" dir="ltr"
          /></label>
        </div>
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
import {
  Check,
  Info,
  Package,
  Pencil,
  Plus,
  Printer,
  Receipt,
  Search,
  Settings2,
  Trash2,
} from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import InvoicePaper from '@/components/InvoicePaper.vue'
import { toast } from '@/lib/toast'
import { date, money, number, parseNumber } from '@/lib/format'
import { validateInvoiceLines } from '@/lib/invoice'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import type { Buyer, Invoice, InvoiceItem, Product, StoreSettings } from '@/types'
const products = ref<Product[]>([]),
  buyers = ref<Buyer[]>([]),
  invoices = ref<Invoice[]>([]),
  draft = ref<Array<InvoiceItem & { priceText: string }>>([])
const settings = ref<StoreSettings | null>(null),
  activeInvoice = ref<Invoice | null>(null)
const activeTab = ref<'new' | 'archive'>('new'),
  selectedBuyerId = ref<number>(),
  selectedCategoryId = ref<number>(),
  selectedProductId = ref<number>()
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
const settingsForm = reactive({ name: '', address: '', phone: '', logoUrl: '' })
const archiveFilters = reactive({
  customerId: undefined as number | undefined,
  buyer: '',
  product: '',
  from: '',
  to: '',
})
const selectedBuyer = computed(() => buyers.value.find((b) => b.id === selectedBuyerId.value))
const productCategories = computed(() => [
  ...new Map(products.value.map((p) => [p.categoryId, p.category])).values(),
])
const availableProducts = computed(() =>
  products.value.filter(
    (p) => selectedCategoryId.value === undefined || p.categoryId === selectedCategoryId.value,
  ),
)
const draftTotal = computed(() =>
  draft.value.reduce((sum, line) => sum + Number(line.quantity) * line.unitPrice, 0),
)
const draftInvoice = computed<Invoice>(() => ({
  id: 0,
  number: 'پیش‌نویس',
  createdAt: new Date().toISOString(),
  buyerFirstName: selectedBuyer.value?.firstName || '',
  buyerLastName: selectedBuyer.value?.lastName || '',
  buyerNationalId: selectedBuyer.value?.nationalId || null,
  buyerAddress: selectedBuyer.value?.address || null,
  notes: selectedBuyer.value?.notes || null,
  total: draftTotal.value,
  items: draft.value,
}))
const stockOf = (id: number) => products.value.find((p) => p.id === id)?.stock || 0
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
watch(activeTab, () => {
  previewDraft.value = false
})
watch(buyerToDelete, () => {
  deleteError.value = ''
})
function switchTab(tab: 'new' | 'archive') {
  activeTab.value = tab
  activeInvoice.value = null
}
function addProduct() {
  const product = products.value.find((p) => p.id === selectedProductId.value)
  if (!product) return
  const line = draft.value.find((l) => l.productId === product.id)
  if ((line?.quantity || 0) + 1 > product.stock) return toast.warning('موجودی این کالا کافی نیست.')
  if (line) line.quantity++
  else
    draft.value.push({
      id: 0,
      productId: product.id,
      name: product.name,
      unit: product.unit,
      quantity: 1,
      unitPrice: product.sellPrice,
      priceText: number(product.sellPrice),
      total: product.sellPrice,
    })
  selectedProductId.value = undefined
}
function formatLinePrice(line: InvoiceItem & { priceText: string }) {
  if (Number.isInteger(line.unitPrice) && line.unitPrice >= 0) {
    line.priceText = number(line.unitPrice)
  }
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
    })
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
      archiveError.value = 'تاریخ شروع باید قبل از تاریخ پایان باشد.'
      return
    }
    invoices.value = await inventoryApi.invoices(archiveFilters)
  } catch {
    archiveError.value = 'دریافت فاکتورها انجام نشد. دوباره جست‌وجو کنید.'
  } finally {
    archiveLoading.value = false
  }
}
function clearFilters() {
  Object.assign(archiveFilters, { customerId: undefined, buyer: '', product: '', from: '', to: '' })
  void loadInvoices()
}
function validateDraft() {
  return validateInvoiceLines(draft.value, stockOf)
}
async function save() {
  if (saving.value) return
  saveError.value = validateDraft()
  if (!selectedBuyer.value) saveError.value = 'خریدار فاکتور را انتخاب کنید.'
  if (saveError.value) return
  saving.value = true
  try {
    activeInvoice.value = await inventoryApi.createInvoice({
      customerId: selectedBuyerId.value,
      items: draft.value.map(({ productId, quantity, unitPrice }) => ({
        productId,
        quantity,
        unitPrice,
      })),
    })
    draft.value = []
    previewDraft.value = false
    toast.success('فاکتور صادر شد و موجودی کالاها به‌روز شد.')
    await load()
    await nextTick()
    paperSection.value?.scrollIntoView({ block: 'start' })
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'صدور فاکتور انجام نشد.'
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
function newDraft() {
  activeInvoice.value = null
  previewDraft.value = false
  activeTab.value = 'new'
  saveError.value = ''
  selectedBuyerId.value = undefined
}
async function printDraft() {
  saveError.value = validateDraft()
  if (saveError.value) return
  previewDraft.value = true
  await printCurrent()
}
async function printCurrent() {
  await nextTick()
  await document.fonts.ready
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
    settings.value = await inventoryApi.saveSettings({ ...settingsForm })
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
.invoice-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.invoice-toolbar > span {
  font-size: 11px;
}
.invoice-editor {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 285px;
  gap: 24px;
  align-items: start;
}
.invoice-steps {
  display: grid;
  gap: 24px;
  min-width: 0;
}
.step-heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.step-heading h2 {
  font-size: 16px;
}
.step-number {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: var(--accent);
  color: var(--primary);
  font-weight: 700;
  flex-shrink: 0;
}
.buyer-preview {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px;
  margin-top: 16px;
  border-radius: 10px;
  background: var(--muted);
}
.buyer-preview > div {
  flex: 1;
  min-width: 0;
}
.buyer-preview b {
  font-size: 12px;
}
.buyer-preview p {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}
.product-adder {
  display: grid;
  grid-template-columns: 1fr 1.6fr auto;
  align-items: end;
  gap: 12px;
}
.draft-lines {
  padding: 0 24px 24px;
}
.draft-line {
  padding: 18px;
  background: var(--background);
  border: 1px solid var(--border);
  border-radius: 12px;
  margin-bottom: 12px;
}
.draft-line:last-child {
  margin: 0;
}
.draft-line__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}
.draft-line__head > div {
  flex: 1;
}
.draft-line__head b {
  font-size: 13px;
}
.draft-line__head small {
  display: block;
  font-size: 10px;
  color: var(--muted-foreground);
  margin-top: 4px;
}
.line-counter {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 11px;
}
.draft-line__fields {
  display: grid;
  grid-template-columns: 90px minmax(100px, 1fr) minmax(110px, 1fr);
  align-items: end;
  gap: 14px;
}
.draft-line__fields .form-field {
  font-size: 11px;
}
.line-total {
  padding-bottom: 10px;
  text-align: end;
}
.line-total small {
  display: block;
  color: var(--muted-foreground);
  font-size: 10px;
  margin-bottom: 6px;
}
.line-total strong {
  font-size: 13px;
}
.invoice-summary {
  position: sticky;
  top: 24px;
}
.summary-row {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 18px;
  font-size: 12px;
}
.summary-row span {
  color: var(--muted-foreground);
}
.summary-row b {
  text-align: end;
}
.summary-total {
  padding: 22px 0;
  border-block: 1px dashed var(--border);
}
.summary-total span {
  color: var(--muted-foreground);
  font-size: 11px;
}
.summary-total strong {
  display: block;
  font-size: 23px;
  color: var(--primary);
  margin-top: 8px;
  overflow-wrap: anywhere;
}
.summary-note {
  display: flex;
  align-items: start;
  gap: 8px;
  font-size: 11px;
  color: var(--muted-foreground);
  margin: 20px 0;
}
.invoice-summary .button {
  width: 100%;
  margin-top: 10px;
}
.summary-help {
  display: block;
  text-align: center;
  font-size: 10px;
  color: var(--muted-foreground);
  margin-top: 12px;
}
.archive-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: end;
  border-bottom: 1px solid var(--border);
}
.archive-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  padding: 24px;
}
.archive-card {
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px;
}
.archive-card__top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.archive-card time {
  color: var(--muted-foreground);
  font-size: 11px;
}
.invoice-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  background: var(--accent);
  color: var(--primary);
  border-radius: 10px;
}
.archive-buyer {
  display: block;
  font-size: 14px;
  margin-top: 18px;
}
.invoice-number {
  display: block;
  direction: ltr;
  text-align: right;
  color: var(--muted-foreground);
  font-size: 10px;
  overflow-wrap: anywhere;
  margin-top: 6px;
}
.archive-amount {
  display: grid;
  gap: 5px;
  margin: 20px 0;
}
.archive-amount span {
  color: var(--muted-foreground);
  font-size: 11px;
}
.archive-amount strong {
  font-size: 17px;
}
.archive-card__actions {
  display: flex;
  gap: 8px;
  border-top: 1px solid var(--border);
  padding-top: 14px;
}
.archive-card__actions .button {
  flex: 1;
}
.invoice-preview {
  scroll-margin-top: 24px;
}
.paper-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}
.paper-toolbar > div {
  display: flex;
  gap: 10px;
}
.full-width {
  grid-column: 1 / -1;
}
form > .notice {
  margin-top: 16px;
}
@media (max-width: 1180px) {
  .invoice-editor {
    grid-template-columns: 1fr;
  }
  .invoice-summary {
    position: static;
  }
  .archive-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 640px) {
  .invoice-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .invoice-toolbar > span {
    display: none;
  }
  .invoice-toolbar .segmented-control button {
    flex: 1;
  }
  .product-adder,
  .archive-filters,
  .archive-grid {
    grid-template-columns: 1fr;
  }
  .product-adder .button {
    width: 100%;
  }
  .draft-lines {
    padding-inline: 16px;
  }
  .draft-line {
    padding: 14px;
  }
  .draft-line__fields {
    grid-template-columns: 80px minmax(0, 1fr);
  }
  .line-total {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 0 0;
  }
  .paper-toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .paper-toolbar > div {
    flex-wrap: wrap;
  }
  .paper-toolbar .button {
    flex: 1;
  }
  .archive-grid {
    padding: 16px;
  }
}
@media print {
  .invoice-page {
    display: block;
  }
  .invoice-preview {
    margin: 0;
  }
}
</style>
