<template>
  <section dir="rtl" class="invoice-page">
    <div class="toolbar no-print">
      <div>
        <h2>فاکتور فروش</h2>
        <p>صدور فاکتور، مدیریت خریداران و مشاهده فاکتورهای بایگانی‌شده</p>
      </div>
      <div class="toolbar-actions">
        <el-button @click="settingsDialogVisible = true">اطلاعات فروشگاه</el-button>
        <el-button @click="openBuyerDialog()">ثبت خریدار جدید</el-button>
        <el-button
          type="primary"
          :loading="saving"
          :disabled="!draft.length || !!activeInvoice"
          @click="save"
        >
          ثبت و صدور فاکتور
        </el-button>
      </div>
    </div>

    <el-tabs v-model="activeTab" class="invoice-tabs no-print" @tab-change="onTabChange">
      <el-tab-pane label="فاکتور جدید" name="new">
        <el-card shadow="never">
          <template #header><b>اطلاعات فاکتور</b></template>
          <div class="invoice-form-toolbar">
            <el-form inline>
              <el-form-item label="انتخاب خریدار">
                <el-select
                  v-model="selectedBuyerId"
                  filterable
                  clearable
                  placeholder="خریدار را انتخاب کنید"
                  style="width: 320px"
                  @change="applyBuyer"
                >
                  <el-option
                    v-for="customer in buyers"
                    :key="customer.id"
                    :label="`${customer.firstName} ${customer.lastName}`"
                    :value="customer.id"
                  />
                </el-select>
              </el-form-item>
            </el-form>
            <el-button @click="openBuyerDialog()">+ ثبت خریدار جدید</el-button>
          </div>
          <div v-if="selectedBuyer" class="selected-buyer">
            <span><b>خریدار:</b> {{ selectedBuyer.firstName }} {{ selectedBuyer.lastName }}</span>
            <span><b>کد ملی:</b> {{ selectedBuyer.nationalId || '—' }}</span>
            <span><b>آدرس:</b> {{ selectedBuyer.address || '—' }}</span>
            <span><b>تلفن:</b> {{ selectedBuyer.phone || '—' }}</span>
            <el-button link type="primary" @click="editBuyer(selectedBuyer)">ویرایش</el-button>
            <el-button link type="danger" @click="deleteBuyer(selectedBuyer)">حذف</el-button>
          </div>
          <div class="add-row">
            <el-select
              v-model="selectedProduct"
              filterable
              placeholder="افزودن محصول"
              style="width: 280px"
            >
              <el-option
                v-for="p in products"
                :key="p.id"
                :label="`${p.name} | موجودی ${p.stock} ${p.unit}`"
                :value="p.id"
              />
            </el-select>
            <el-button @click="addProduct">افزودن به فاکتور</el-button>
          </div>
        </el-card>
      </el-tab-pane>
      <el-tab-pane label="فاکتورهای بایگانی‌شده" name="archive">
        <el-card shadow="never">
          <template #header><b>فاکتورهای ثبت‌شده و گذشته</b></template>
          <div class="archive-filters">
            <el-select
              v-model="archiveFilters.customerId"
              clearable
              filterable
              placeholder="فیلتر خریدار"
              @change="loadInvoices"
            >
              <el-option
                v-for="customer in buyers"
                :key="customer.id"
                :label="`${customer.firstName} ${customer.lastName}`"
                :value="customer.id"
              />
            </el-select>
            <el-input
              v-model="archiveFilters.buyer"
              clearable
              placeholder="جست‌وجوی نام یا کد ملی"
              @keyup.enter="loadInvoices"
              @clear="loadInvoices"
            />
            <el-date-picker
              v-model="archiveFilters.from"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="از تاریخ"
              @change="loadInvoices"
            />
            <el-date-picker
              v-model="archiveFilters.to"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="تا تاریخ"
              @change="loadInvoices"
            />
            <el-input
              v-model="archiveFilters.product"
              clearable
              placeholder="نام یا کد کالای فاکتور"
              @keyup.enter="loadInvoices"
              @clear="loadInvoices"
            />
            <el-button type="primary" @click="loadInvoices">اعمال فیلتر</el-button>
            <el-button @click="clearArchiveFilters">پاک‌کردن</el-button>
          </div>
          <el-table :data="invoices" v-loading="loading" @row-click="openInvoice">
            <el-table-column prop="number" label="شماره فاکتور" min-width="120" />
            <el-table-column label="خریدار" min-width="160">
              <template #default="s">{{ s.row.buyerFirstName }} {{ s.row.buyerLastName }}</template>
            </el-table-column>
            <el-table-column label="مبلغ" min-width="150">
              <template #default="s">{{ money(s.row.total) }}</template>
            </el-table-column>
            <el-table-column label="تاریخ" min-width="120">
              <template #default="s">{{
                new Date(s.row.createdAt).toLocaleDateString('fa-IR')
              }}</template>
            </el-table-column>
            <el-table-column label="عملیات" width="145">
              <template #default="s">
                <el-button link type="primary" @click.stop="openInvoice(s.row)"
                  >مشاهده / چاپ</el-button
                >
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="settingsDialogVisible"
      title="ویرایش اطلاعات فروشگاه"
      width="560px"
      destroy-on-close
    >
      <el-form label-position="top" class="dialog-form">
        <el-form-item label="نام فروشگاه"><el-input v-model="settingsForm.name" /></el-form-item>
        <el-form-item label="نشانی فروشگاه"
          ><el-input v-model="settingsForm.address" type="textarea" :rows="2"
        /></el-form-item>
        <el-form-item label="شماره تماس"><el-input v-model="settingsForm.phone" /></el-form-item>
        <el-form-item label="نشانی لوگو"
          ><el-input v-model="settingsForm.logoUrl" placeholder="آدرس تصویر لوگو"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="settingsDialogVisible = false">انصراف</el-button>
        <el-button type="primary" :loading="settingsSaving" @click="saveSettings"
          >ذخیره اطلاعات فروشگاه</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="buyerDialogVisible"
      :title="editingBuyerId ? 'ویرایش خریدار' : 'ثبت خریدار جدید'"
      width="600px"
      destroy-on-close
    >
      <el-form label-position="top" class="dialog-form">
        <div class="dialog-grid">
          <el-form-item label="نام"><el-input v-model="buyerForm.firstName" /></el-form-item>
          <el-form-item label="نام خانوادگی"
            ><el-input v-model="buyerForm.lastName"
          /></el-form-item>
          <el-form-item label="کد ملی"><el-input v-model="buyerForm.nationalId" /></el-form-item>
          <el-form-item label="شماره تماس"><el-input v-model="buyerForm.phone" /></el-form-item>
        </div>
        <el-form-item label="آدرس"
          ><el-input v-model="buyerForm.address" type="textarea" :rows="2"
        /></el-form-item>
        <el-form-item label="توضیحات"
          ><el-input v-model="buyerForm.notes" type="textarea" :rows="2"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="buyerDialogVisible = false">انصراف</el-button>
        <el-button type="primary" :loading="buyerSaving" @click="saveBuyer">ثبت خریدار</el-button>
      </template>
    </el-dialog>

    <article class="paper" v-if="activeInvoice || draft.length">
      <header class="invoice-header">
        <div class="invoice-reference">
          <img v-if="settings?.logoUrl" style="width: 150px" :src="settings.logoUrl" alt="لوگو" />
          <div v-else class="invoice-logo">لوگو</div>
        </div>
        <div class="invoice-title">
          <div>
            <h1>صورتحساب فروش کالا و خدمات</h1>
            <strong>{{ settings?.name || 'فروشگاه' }}</strong>
          </div>
        </div>
        <div class="invoice-store-details">
          <span
            >شماره فاکتور: <b>{{ activeInvoice?.number || 'پس از ثبت' }}</b></span
          >
          <span
            >تاریخ:
            {{ new Date(activeInvoice?.createdAt || Date.now()).toLocaleDateString('fa-IR') }}</span
          >
        </div>
      </header>

      <section class="party-details">
        <div class="party-heading">مشخصات فروشنده</div>
        <div><b>نام:</b> {{ settings?.name || 'فروشگاه' }}</div>
        <div>
          <b>کد ملی:</b> {{ activeInvoice?.buyerNationalId || selectedBuyer?.nationalId || '—' }}
        </div>
        <div><b>نشانی:</b> {{ settings?.address || '—' }}</div>
        <div><b>شماره تماس:</b> {{ settings?.phone || '—' }}</div>
      </section>
      <section class="party-details">
        <div class="party-heading">مشخصات خریدار</div>
        <div>
          <b>نام و نام خانوادگی:</b>
          {{
            activeInvoice
              ? `${activeInvoice.buyerFirstName || ''} ${activeInvoice.buyerLastName || ''}`
              : `${selectedBuyer?.firstName || ''} ${selectedBuyer?.lastName || ''}`
          }}
        </div>
        <div>
          <b>کد ملی:</b> {{ activeInvoice?.buyerNationalId || selectedBuyer?.nationalId || '—' }}
        </div>
        <div><b>نشانی:</b> {{ activeInvoice?.buyerAddress || selectedBuyer?.address || '—' }}</div>
        <div><b>شماره تماس:</b> {{ selectedBuyer?.phone || '—' }}</div>
      </section>

      <table class="invoice-lines">
        <colgroup>
          <col class="line-number" />
          <col class="line-product" />
          <col class="line-unit" />
          <col class="line-quantity" />
          <col class="line-price" />
          <col class="line-total" />
          <col v-if="!activeInvoice" class="line-action" />
        </colgroup>
        <thead>
          <tr>
            <th>ردیف</th>
            <th>شرح کالا یا خدمات</th>
            <th>واحد</th>
            <th>تعداد</th>
            <th>مبلغ واحد (تومان)</th>
            <th>مبلغ کل (تومان)</th>
            <!-- <th v-if="!activeInvoice" class="no-print">عملیات</th> -->
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(line, index) in activeInvoice?.items || draft"
            :key="line.id || line.productId"
          >
            <td @mouseenter="showDeleteAction = true" @mouseleave="showDeleteAction = false">
              <el-button
                v-if="showDeleteAction"
                type="danger"
                style="width: 25px; height: 70%"
                size="small"
                circle
                :icon="Delete"
                @click="draft.splice(index, 1)"
              />
              <span v-else>{{ index + 1 }}</span>
            </td>
            <td>{{ line.name }}</td>
            <td>{{ line.unit }}</td>
            <td>
              <el-input-number
                v-if="!activeInvoice"
                v-model="line.quantity"
                :min="1"
                :max="products.find((p) => p.id === line.productId)?.stock || 999999"
                size="small"
                controls-position="right"
              /><span v-else>{{ line.quantity }}</span
              ><span v-if="!activeInvoice" class="print-value">{{ line.quantity }}</span>
            </td>
            <td>
              <el-input
                v-if="!activeInvoice"
                :model-value="priceFormat(line.unitPrice)"
                inputmode="numeric"
                @input="(value: string) => setPrice(line, value)"
              /><span v-else>{{ money(line.unitPrice) }}</span
              ><span v-if="!activeInvoice" class="print-value">{{ money(line.unitPrice) }}</span>
            </td>
            <td>{{ money(line.quantity * line.unitPrice) }}</td>
          </tr>
          <tr v-if="!(activeInvoice?.items || draft).length" class="empty-line">
            <td :colspan="activeInvoice ? 6 : 7">کالایی به فاکتور افزوده نشده است.</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td :colspan="activeInvoice ? 2 : 5"><b>جمع کل مبلغ قابل پرداخت</b></td>
            <td>
              <strong>{{ money(total) }}</strong>
            </td>
          </tr>
        </tfoot>
      </table>

      <div class="invoice-notes">
        <b>توضیحات:</b> {{ activeInvoice?.notes || selectedBuyer?.notes || '—' }}
      </div>
      <footer class="invoice-signatures">
        <div>مهر و امضای فروشنده</div>
        <div>امضا و تأیید خریدار</div>
      </footer>
      <div class="no-print print-actions">
        <el-button @click="windowPrint">چاپ فاکتور A5</el-button>
        <el-button v-if="activeInvoice" @click="newDraft">فاکتور جدید</el-button>
      </div>
    </article>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import type { Buyer, Invoice, InvoiceItem, Product, StoreSettings } from '@/types'
import { Delete } from '@element-plus/icons-vue'

type DraftLine = InvoiceItem
type BuyerRecord = Buyer

const showDeleteAction = ref<boolean>(false)
const products = ref<Product[]>([])
const invoices = ref<Invoice[]>([])
const activeInvoice = ref<Invoice | null>(null)
const settings = ref<StoreSettings | null>(null)
const buyers = ref<BuyerRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const settingsSaving = ref(false)
const buyerSaving = ref(false)
const selectedProduct = ref<number>()
const selectedBuyerId = ref<number>()
const draft = ref<DraftLine[]>([])
const activeTab = ref<'new' | 'archive'>('new')
const settingsDialogVisible = ref(false)
const buyerDialogVisible = ref(false)
const editingBuyerId = ref<number | null>(null)
const archiveFilters = reactive<{
  customerId?: number
  buyer: string
  from?: string
  to?: string
  product: string
}>({ buyer: '', product: '' })

const buyerForm = reactive({
  firstName: '',
  lastName: '',
  nationalId: '',
  phone: '',
  address: '',
  notes: '',
})
const settingsForm = reactive({ name: '', address: '', phone: '', logoUrl: '' })
const selectedBuyer = computed(
  () => buyers.value.find((b) => b.id === selectedBuyerId.value) || null,
)
const total = computed(
  () =>
    activeInvoice.value?.total ??
    draft.value.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
)
const money = (v: number) => `${new Intl.NumberFormat('fa-IR').format(v)} تومان`
const priceFormat = (v: number) => new Intl.NumberFormat('fa-IR').format(v)

function setPrice(row: InvoiceItem, value: string) {
  row.unitPrice =
    Number(
      value
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/\D/g, ''),
    ) || 0
}

function applyBuyer() {
  // Buyer details are read from the selected saved record and displayed on the invoice.
}

function addProduct() {
  const product = products.value.find((item) => item.id === selectedProduct.value)
  if (!product) return
  const line = draft.value.find((item) => item.productId === product.id)
  if (line) {
    if (line.quantity < product.stock) line.quantity++
    else ElMessage.warning('تعداد انتخاب‌شده از موجودی بیشتر است.')
  } else {
    draft.value.push({
      id: 0,
      productId: product.id,
      name: product.name,
      unit: product.unit,
      quantity: 1,
      unitPrice: product.sellPrice,
      total: product.sellPrice,
    })
  }
  selectedProduct.value = undefined
}

async function load() {
  loading.value = true
  try {
    const [productResult, storeResult, buyerResult] = await Promise.all([
      productsApi.list({ page: 1, limit: 10000, isActive: true }),
      inventoryApi.settings(),
      inventoryApi.buyers(),
    ])
    products.value = productResult.data
    settings.value = storeResult
    buyers.value = buyerResult
    await loadInvoices()
    Object.assign(settingsForm, {
      name: storeResult.name,
      address: storeResult.address || '',
      phone: storeResult.phone || '',
      logoUrl: storeResult.logoUrl || '',
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'دریافت اطلاعات ناموفق بود.')
  } finally {
    loading.value = false
  }
}

async function save() {
  if (
    !draft.value.length ||
    draft.value.some(
      (item) => item.quantity < 1 || !Number.isInteger(item.unitPrice) || item.unitPrice < 0,
    )
  ) {
    ElMessage.warning('اقلام و قیمت‌های فاکتور را بررسی کنید.')
    return
  }
  if (!selectedBuyer.value) {
    ElMessage.warning('ابتدا خریدار را انتخاب کنید یا خریدار جدید ثبت کنید.')
    return
  }
  saving.value = true
  try {
    activeInvoice.value = await inventoryApi.createInvoice({
      buyerFirstName: selectedBuyer.value.firstName,
      customerId: selectedBuyer.value.id,
      buyerLastName: selectedBuyer.value.lastName,
      buyerNationalId: selectedBuyer.value.nationalId || '',
      buyerAddress: selectedBuyer.value.address || '',
      notes: selectedBuyer.value.notes || '',
      items: draft.value.map(({ productId, quantity, unitPrice }) => ({
        productId,
        quantity,
        unitPrice,
      })),
    })
    ElMessage.success('فاکتور ثبت شد و موجودی به‌روز شد.')
    draft.value = []
    activeTab.value = 'new'
    await load()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'ثبت فاکتور ناموفق بود.')
  } finally {
    saving.value = false
  }
}

async function openInvoice(row: any) {
  try {
    activeInvoice.value = await inventoryApi.invoice(Number(row.id))
    activeTab.value = 'archive'
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'دریافت فاکتور ناموفق بود.')
  }
}

function newDraft() {
  activeInvoice.value = null
  draft.value = []
  selectedBuyerId.value = undefined
  activeTab.value = 'new'
}

function onTabChange(tab: string | number) {
  if (tab === 'new' && activeInvoice.value) newDraft()
}

function openBuyerDialog() {
  editingBuyerId.value = null
  Object.assign(buyerForm, {
    firstName: '',
    lastName: '',
    nationalId: '',
    phone: '',
    address: '',
    notes: '',
  })
  buyerDialogVisible.value = true
}

function editBuyer(buyer: BuyerRecord) {
  editingBuyerId.value = buyer.id
  Object.assign(buyerForm, {
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    nationalId: buyer.nationalId || '',
    phone: buyer.phone || '',
    address: buyer.address || '',
    notes: buyer.notes || '',
  })
  buyerDialogVisible.value = true
}

async function deleteBuyer(buyer: BuyerRecord) {
  try {
    await ElMessageBox.confirm(
      `خریدار «${buyer.firstName} ${buyer.lastName}» حذف شود؟`,
      'حذف خریدار',
      { type: 'warning', confirmButtonText: 'حذف', cancelButtonText: 'انصراف' },
    )
    await inventoryApi.deleteBuyer(buyer.id)
    buyers.value = buyers.value.filter((item) => item.id !== buyer.id)
    if (selectedBuyerId.value === buyer.id) selectedBuyerId.value = undefined
    ElMessage.success('خریدار حذف شد.')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close')
      ElMessage.error(error instanceof Error ? error.message : 'حذف خریدار ناموفق بود.')
  }
}

async function saveBuyer() {
  if (!buyerForm.firstName.trim() || !buyerForm.lastName.trim()) {
    ElMessage.warning('نام و نام خانوادگی خریدار الزامی است.')
    return
  }
  buyerSaving.value = true
  const editing = editingBuyerId.value !== null
  try {
    const saved = editingBuyerId.value
      ? await inventoryApi.updateBuyer(editingBuyerId.value, { ...buyerForm })
      : await inventoryApi.createBuyer({ ...buyerForm })
    const existingIndex = buyers.value.findIndex((buyer) => buyer.id === saved.id)
    if (existingIndex === -1) buyers.value.push(saved)
    else buyers.value[existingIndex] = saved
    selectedBuyerId.value = saved.id
    buyerDialogVisible.value = false
    editingBuyerId.value = null
    ElMessage.success(editing ? 'اطلاعات خریدار ویرایش شد.' : 'خریدار ثبت و انتخاب شد.')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'ثبت خریدار ناموفق بود.')
  } finally {
    buyerSaving.value = false
  }
}

async function saveSettings() {
  settingsSaving.value = true
  try {
    settings.value = await inventoryApi.saveSettings(settingsForm)
    settingsDialogVisible.value = false
    ElMessage.success('اطلاعات فروشگاه ذخیره شد.')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'ذخیره اطلاعات فروشگاه ناموفق بود.')
  } finally {
    settingsSaving.value = false
  }
}

function windowPrint() {
  window.print()
}

async function loadInvoices() {
  try {
    invoices.value = await inventoryApi.invoices(archiveFilters)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'دریافت بایگانی فاکتورها ناموفق بود.')
  }
}

function clearArchiveFilters() {
  Object.assign(archiveFilters, {
    customerId: undefined,
    buyer: '',
    from: undefined,
    to: undefined,
    product: '',
  })
  void loadInvoices()
}

onMounted(load)
</script>
<style scoped>
.invoice-page {
  --invoice-accent: var(--el-color-primary, #409eff);
  --invoice-radius: 18px;
  display: grid;
  gap: 22px;
  min-width: 0;
  color: var(--el-text-color-primary);
  padding: 4px 2px 28px;
}

/* Page heading */
.toolbar {
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  overflow: hidden;
  padding: 25px 28px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 22px;
  background:
    radial-gradient(
      ellipse at 100% 0%,
      color-mix(in srgb, var(--invoice-accent) 18%, transparent),
      transparent 48%
    ),
    var(--el-bg-color-overlay, var(--el-bg-color));
  box-shadow: 0 8px 28px rgb(0 0 0 / 5%);
}
.toolbar::before {
  position: absolute;
  z-index: -1;
  top: -48px;
  right: -34px;
  width: 170px;
  height: 170px;
  border: 1px solid color-mix(in srgb, var(--invoice-accent) 24%, transparent);
  border-radius: 50%;
  content: '';
}
.toolbar h2 {
  display: flex;
  align-items: center;
  gap: 11px;
  margin: 0 0 8px;
  font-size: clamp(20px, 2vw, 27px);
  font-weight: 800;
  letter-spacing: -0.5px;
}
.toolbar h2::before {
  display: inline-block;
  width: 5px;
  height: 29px;
  border-radius: 8px;
  background: var(--invoice-accent);
  content: '';
}
.toolbar p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
  line-height: 1.9;
}

/* Cards and section headers */
.invoice-page :deep(.el-card) {
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: var(--invoice-radius);
  background: var(--el-bg-color-overlay, var(--el-bg-color));
  box-shadow: 0 5px 20px rgb(0 0 0 / 3%);
}
.invoice-page :deep(.el-card__header) {
  padding: 18px 22px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  background: color-mix(in srgb, var(--el-fill-color-light) 60%, transparent);
}
.invoice-page :deep(.el-card__header b) {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 800;
}
.invoice-page :deep(.el-card__header b::before) {
  width: 8px;
  height: 8px;
  border-radius: 3px;
  background: var(--invoice-accent);
  content: '';
}
.invoice-page :deep(.el-card__body) {
  padding: 22px;
}

/* Forms */
.invoice-page :deep(.el-form--inline) {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px 18px;
}
.invoice-page :deep(.el-form--inline .el-form-item) {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
  margin: 0 0 13px;
}
.invoice-page :deep(.el-form-item__label) {
  display: block;
  width: auto !important;
  padding-bottom: 7px;
  color: var(--el-text-color-regular);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.7;
}
.invoice-page :deep(.el-form--inline .el-form-item__content) {
  display: block;
  flex: 1;
  min-width: 0;
}
.invoice-page :deep(.el-input__wrapper),
.invoice-page :deep(.el-select__wrapper),
.invoice-page :deep(.el-textarea__inner) {
  min-height: 42px;
  border-radius: 11px;
  background: var(--el-fill-color-blank);
  box-shadow: 0 0 0 1px var(--el-border-color) inset;
  transition:
    box-shadow 0.18s ease,
    background 0.18s ease;
}
.invoice-page :deep(.el-input__wrapper:hover),
.invoice-page :deep(.el-select__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-border-color-darker) inset;
}
.invoice-page :deep(.el-input__wrapper.is-focus),
.invoice-page :deep(.el-select__wrapper.is-focused),
.invoice-page :deep(.el-textarea__inner:focus) {
  box-shadow:
    0 0 0 1px var(--invoice-accent) inset,
    0 0 0 3px color-mix(in srgb, var(--invoice-accent) 12%, transparent);
}
.invoice-page :deep(.el-input__inner),
.invoice-page :deep(.el-select__placeholder),
.invoice-page :deep(.el-select__selected-item) {
  font-size: 13px;
}
.invoice-page :deep(.el-button) {
  min-height: 38px;
  border-radius: 10px;
  font-weight: 700;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease;
}
.invoice-page :deep(.el-button:not(.is-disabled):hover) {
  transform: translateY(-1px);
}
.invoice-page :deep(.el-button--primary) {
  box-shadow: 0 5px 13px color-mix(in srgb, var(--invoice-accent) 22%, transparent);
}
.toolbar :deep(.el-button) {
  min-height: 44px;
  padding-inline: 22px;
}

/* Product picker */
.add-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 15px;
  margin-top: 5px;
  border: 1px dashed var(--el-border-color);
  border-radius: 14px;
  background: var(--el-fill-color-lighter);
}
.add-row :deep(.el-select) {
  width: min(100%, 420px) !important;
}
.add-row :deep(.el-button) {
  flex-shrink: 0;
}

/* Invoice preview / print paper */
.paper {
  position: relative;
  display: grid;
  gap: 20px;
  min-width: 0;
  padding: 30px;
  overflow: hidden;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 20px;
  background: var(--el-bg-color-overlay, var(--el-bg-color));
  box-shadow: 0 10px 32px rgb(0 0 0 / 6%);
}
.paper::before {
  position: absolute;
  inset: 0 0 auto;
  height: 5px;
  background: linear-gradient(
    90deg,
    var(--invoice-accent),
    color-mix(in srgb, var(--invoice-accent) 25%, #fff)
  );
  content: '';
}
.paper-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 4px 0 22px;
  border-bottom: 2px solid var(--el-border-color);
}
.brand {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.brand img,
.logo-placeholder {
  display: grid;
  flex: 0 0 78px;
  width: 78px;
  height: 72px;
  object-fit: contain;
  border-radius: 13px;
}
.brand img {
  padding: 5px;
  border: 1px solid var(--el-border-color-lighter);
}
.logo-placeholder {
  place-items: center;
  border: 1px dashed var(--el-border-color);
  background: var(--el-fill-color-lighter);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.brand h1 {
  margin: 0 0 7px;
  font-size: 22px;
  font-weight: 900;
  letter-spacing: -0.4px;
}
.brand div div {
  margin-top: 4px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
  line-height: 1.8;
}
.invoice-meta {
  display: grid;
  gap: 8px;
  min-width: 150px;
  padding: 14px 16px;
  border: 1px solid color-mix(in srgb, var(--invoice-accent) 22%, var(--el-border-color));
  border-radius: 13px;
  background: color-mix(in srgb, var(--invoice-accent) 6%, var(--el-bg-color));
  text-align: right;
  font-size: 12px;
}
.invoice-meta b {
  margin-bottom: 2px;
  color: var(--invoice-accent);
  font-size: 17px;
}
.invoice-meta span {
  color: var(--el-text-color-regular);
}
.buyer {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 11px 20px;
  padding: 16px 18px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 13px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
}
.buyer b {
  grid-column: 1 / -1;
  padding-bottom: 9px;
  border-bottom: 1px solid var(--el-border-color-lighter);
  font-size: 13px;
  font-weight: 800;
}
.buyer span {
  overflow-wrap: anywhere;
  line-height: 1.8;
}
.buyer span::first-letter {
  color: var(--el-text-color-secondary);
}
.invoice-page :deep(.line-items) {
  width: 100%;
  overflow: hidden;
  border-radius: 12px;
  --el-table-border-color: var(--el-border-color-lighter);
  --el-table-header-bg-color: var(--el-fill-color-light);
  --el-table-row-hover-bg-color: var(--el-fill-color-lighter);
}
.invoice-page :deep(.line-items th.el-table__cell) {
  height: 46px;
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 800;
}
.invoice-page :deep(.line-items td.el-table__cell) {
  padding: 11px 0;
  font-size: 12px;
}
.invoice-page :deep(.line-items .cell) {
  line-height: 1.8;
}
.invoice-page :deep(.line-items .el-input__wrapper) {
  min-height: 34px;
  padding-inline: 8px;
}
.invoice-page :deep(.line-items .el-input-number) {
  width: 100%;
}
.invoice-page :deep(.line-items .el-input-number .el-input__wrapper) {
  padding-inline: 7px;
}
.total {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 17px 20px;
  border: 1px solid color-mix(in srgb, var(--invoice-accent) 25%, var(--el-border-color));
  border-radius: 13px;
  background: color-mix(in srgb, var(--invoice-accent) 7%, var(--el-bg-color));
  font-size: 14px;
}
.total b {
  font-weight: 800;
}
.total strong {
  color: var(--invoice-accent);
  font-size: 21px;
  font-weight: 900;
  white-space: nowrap;
}
.notes {
  min-height: 48px;
  padding: 13px 15px;
  border-right: 3px solid var(--el-border-color);
  border-radius: 7px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.notes b {
  margin-left: 7px;
}
.signatures {
  display: flex;
  justify-content: space-around;
  gap: 28px;
  margin-top: 22px;
}
.signatures div {
  width: 36%;
  height: 86px;
  padding-top: 11px;
  border-top: 1px solid var(--el-border-color);
  color: var(--el-text-color-regular);
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}
.print-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 6px;
}

/* Saved invoices table */
.invoice-page :deep(.el-table) {
  --el-table-border-color: var(--el-border-color-lighter);
}
.invoice-page :deep(.el-table th.el-table__cell) {
  color: var(--el-text-color-primary);
  font-size: 12px;
  font-weight: 800;
}
.invoice-page :deep(.el-table td.el-table__cell) {
  font-size: 12px;
}
.invoice-page :deep(.el-table__row) {
  cursor: pointer;
}
.invoice-page :deep(.el-table__row:hover > td.el-table__cell) {
  background: var(--el-fill-color-light);
}

/* Invoice tabs, buyer selection and dialogs */
.invoice-tabs {
  min-width: 0;
}
.invoice-tabs :deep(.el-tabs__header) {
  margin-bottom: 18px;
}
.invoice-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--el-border-color-lighter);
}
.invoice-tabs :deep(.el-tabs__item) {
  height: 48px;
  font-weight: 800;
}
.toolbar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.invoice-form-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.invoice-form-toolbar .el-form-item {
  margin-bottom: 0;
}
.selected-buyer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 22px;
  padding: 13px 15px;
  margin-top: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: var(--el-fill-color-lighter);
  font-size: 12px;
  line-height: 1.9;
}
.archive-filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 10px;
  margin-bottom: 18px;
}
.dialog-form :deep(.el-form-item) {
  margin-bottom: 16px;
}
.dialog-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 16px;
}

@media (max-width: 900px) {
  .invoice-page :deep(.el-form--inline) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .paper {
    padding: 22px;
  }
  .paper-head {
    align-items: flex-start;
  }
  .brand h1 {
    font-size: 19px;
  }
}
@media (max-width: 600px) {
  .invoice-page {
    gap: 15px;
  }
  .toolbar {
    align-items: flex-start;
    flex-direction: column;
    padding: 20px;
    border-radius: 16px;
  }
  .toolbar-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }
  .toolbar-actions :deep(.el-button) {
    width: 100%;
    margin-left: 0;
  }
  .invoice-form-toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .invoice-form-toolbar :deep(.el-select) {
    width: 100% !important;
  }
  .dialog-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .invoice-page :deep(.el-card__body) {
    padding: 15px;
  }
  .invoice-page :deep(.el-card__header) {
    padding: 15px;
  }
  .invoice-page :deep(.el-form--inline) {
    grid-template-columns: minmax(0, 1fr);
  }
  .add-row {
    align-items: stretch;
    flex-direction: column;
    padding: 12px;
  }
  .add-row :deep(.el-select) {
    width: 100% !important;
  }
  .add-row :deep(.el-button) {
    width: 100%;
  }
  .paper {
    gap: 15px;
    padding: 16px;
    border-radius: 15px;
  }
  .paper-head {
    flex-direction: column;
  }
  .brand {
    align-items: flex-start;
  }
  .brand img,
  .logo-placeholder {
    flex-basis: 58px;
    width: 58px;
    height: 58px;
  }
  .brand h1 {
    font-size: 17px;
  }
  .invoice-meta {
    width: 100%;
  }
  .buyer {
    grid-template-columns: minmax(0, 1fr);
    padding: 13px;
  }
  .buyer b {
    grid-column: auto;
  }
  .total {
    align-items: flex-start;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
  }
  .total strong {
    font-size: 19px;
  }
  .signatures {
    gap: 18px;
  }
  .signatures div {
    width: 50%;
  }
}

@media print {
  @page {
    size: A5 portrait;
    margin: 8mm;
  }
  :global(html),
  :global(body) {
    width: 100%;
    margin: 0 !important;
    padding: 0 !important;
    background: #fff !important;
  }
  .invoice-page {
    display: block;
    padding: 0;
    color: #111;
    font-family: Arial, Tahoma, sans-serif;
  }
  .no-print {
    display: none !important;
  }
  .paper {
    display: block;
    overflow: visible;
    padding: 0;
    border: 0;
    border-radius: 0;
    background: #fff !important;
    color: #111 !important;
    box-shadow: none;
  }
  .paper::before {
    display: none;
  }
  .paper > * {
    margin-bottom: 9px;
  }
  .paper-head {
    padding-bottom: 12px;
    border-color: #333;
  }
  .brand h1 {
    font-size: 17px;
  }
  .brand img,
  .logo-placeholder {
    width: 58px;
    height: 54px;
    flex-basis: 58px;
  }
  .brand div div,
  .invoice-meta,
  .buyer,
  .notes,
  .signatures div {
    color: #111 !important;
    font-size: 9px;
  }
  .invoice-meta {
    min-width: 125px;
    padding: 8px 10px;
    border-color: #999;
    background: #fff !important;
  }
  .invoice-meta b {
    color: #111 !important;
    font-size: 13px;
  }
  .buyer {
    padding: 9px 11px;
    border-color: #999;
    background: #fff !important;
    gap: 5px 12px;
  }
  .buyer b {
    padding-bottom: 5px;
  }
  .invoice-page :deep(.el-table),
  .invoice-page :deep(.el-table__inner-wrapper),
  .invoice-page :deep(.el-table tr),
  .invoice-page :deep(.el-table th),
  .invoice-page :deep(.el-table td) {
    color: #111 !important;
    background: #fff !important;
    border-color: #777 !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .invoice-page :deep(.line-items th.el-table__cell) {
    height: 30px;
    font-size: 9px;
  }
  .invoice-page :deep(.line-items td.el-table__cell) {
    padding: 4px 0;
    font-size: 9px;
  }
  .invoice-page :deep(.line-items .cell) {
    line-height: 1.5;
  }
  .invoice-page :deep(.line-items .el-input),
  .invoice-page :deep(.line-items .el-input-number) {
    display: none !important;
  }
  .total {
    margin-top: 8px;
    padding: 10px 12px;
    border-color: #777;
    border-radius: 5px;
    background: #fff !important;
  }
  .total strong {
    color: #111 !important;
    font-size: 15px;
  }
  .notes {
    min-height: 28px;
    padding: 7px 9px;
    border-color: #777;
    background: #fff !important;
  }
  .signatures {
    margin-top: 22px;
  }
  .signatures div {
    height: 58px;
    border-color: #777;
  }
  .line-items,
  .buyer,
  .total,
  .notes,
  .signatures {
    break-inside: avoid;
  }
  .invoice-page :deep(.el-table__header-wrapper),
  .invoice-page :deep(.el-table__body-wrapper) {
    overflow: visible !important;
  }
}

/* Official invoice layout */
.paper {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 24px;
  gap: 0;
  overflow: visible;
  border: 1px solid var(--el-text-color-primary);
  border-radius: 4px;
  background: var(--el-bg-color);
  box-shadow: none;
  color: var(--el-text-color-primary);
  font-size: 12px;
}
.paper::before {
  display: none;
}
.invoice-header {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  align-items: start;
  gap: 12px;
  padding-bottom: 10px;
}
.invoice-reference,
.invoice-store-details {
  display: grid;
  gap: 5px;
  font-size: 11px;
  line-height: 1.7;
}
.invoice-reference {
  text-align: right;

}
.invoice-store-details {
  text-align: left;
}
.invoice-title {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  text-align: center;
}
.invoice-title h1 {
  margin: 0 0 5px;
  font-size: 17px;
  font-weight: 800;
}
.invoice-title strong {
  font-size: 12px;
}
.invoice-title img,
.invoice-logo {
  width: 42px;
  height: 42px;
  object-fit: contain;
}
.invoice-logo {
  display: grid;
  place-items: center;
  border: 1px dashed currentColor;
  font-size: 9px;
}
.party-details {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin-top: 8px;
  border: 1px solid currentColor;
  border-bottom: 0;
}
.party-details > * {
  min-width: 0;
  padding: 5px 8px;
  border-bottom: 1px solid currentColor;
  overflow-wrap: anywhere;
}
.party-details > :nth-child(even) {
  border-left: 1px solid currentColor;
}
.party-heading {
  grid-column: 1 / -1;
  font-weight: 800;
  text-align: center;
}
.invoice-lines {
  width: 100%;
  margin-top: 5px;
  border-collapse: collapse;
  table-layout: fixed;
  text-align: center;
}
.invoice-lines th,
.invoice-lines td {
  padding: 6px 5px;
  border: 1px solid currentColor;
  vertical-align: middle;
  overflow-wrap: anywhere;
}
.invoice-lines th {
  background: var(--el-fill-color-light);
  font-weight: 800;
}
.invoice-lines tbody tr {
  break-inside: avoid;
  page-break-inside: avoid;
}
.invoice-lines .line-number {
  width: 6%;
}
.invoice-lines .line-product {
  width: 31%;
}
.invoice-lines .line-unit {
  width: 10%;
}
.invoice-lines .line-quantity {
  width: 11%;
}
.invoice-lines .line-price,
.invoice-lines .line-total {
  width: 26%;
}
.invoice-lines :deep(.el-input-number),
.invoice-lines :deep(.el-input) {
  width: 100%;
}
.invoice-lines :deep(.el-input__wrapper) {
  min-height: 30px;
  padding-inline: 5px;
  border-radius: 3px;
}
.invoice-lines :deep(.el-input-number .el-input__wrapper) {
  padding-inline: 4px;
}
.print-value {
  display: none;
}
.invoice-lines tfoot td {
  font-size: 13px;
  font-weight: 700;
}
.invoice-lines tfoot strong {
  white-space: nowrap;
}
.empty-line td {
  height: 45px;
  color: var(--el-text-color-secondary);
}
.invoice-notes {
  min-height: 42px;
  padding: 8px;
  border: 1px solid currentColor;
  border-top: 0;
  line-height: 1.8;
  overflow-wrap: anywhere;
}
.invoice-signatures {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 72px;
  border: 1px solid currentColor;
  border-top: 0;
}
.invoice-signatures div {
  padding: 10px;
  text-align: center;
  font-weight: 700;
}
.invoice-signatures div + div {
  border-right: 1px solid currentColor;
}

@media (max-width: 640px) {
  .paper {
    padding: 14px;
    overflow-x: auto;
  }
  .invoice-header {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .invoice-reference,
  .invoice-store-details {
    text-align: center;
  }
  .invoice-lines {
    min-width: 650px;
  }
}

@media print {
  @page {
    size: A5 landscape;
    margin: 6mm;
  }
  :global(html),
  :global(body) {
    width: 210mm !important;
    height: auto !important;
    background: #fff !important;
  }
  .invoice-page {
    display: block !important;
    width: 198mm !important;
    margin: 0 !important;
    padding: 0 !important;
    color: #000 !important;
    font-family: Vazirmatn, Tahoma, sans-serif !important;
  }
  .paper {
    display: block !important;
    width: 198mm !important;
    max-width: 198mm !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    border: 1px solid #111 !important;
    border-radius: 0 !important;
    background: #fff !important;
    color: #000 !important;
    font-size: 8.5pt !important;
    box-shadow: none !important;
  }
  .invoice-header {
    grid-template-columns: 1fr 1.4fr 1fr !important;
    gap: 6px !important;
    padding: 6px 8px !important;
    border-color: #111 !important;
  }
  .invoice-reference,
  .invoice-store-details {
    gap: 2px !important;
    font-size: 7.5pt !important;
  }
  .invoice-title h1 {
    margin-bottom: 2px !important;
    font-size: 12pt !important;
  }
  .invoice-title strong {
    font-size: 8pt !important;
  }
  .invoice-title img,
  .invoice-logo {
    width: 30px !important;
    height: 30px !important;
  }
  .party-details {
    margin-top: 4px !important;
    border-color: #111 !important;
  }
  .party-details > * {
    padding: 3px 6px !important;
    border-color: #111 !important;
    font-size: 7.5pt !important;
    line-height: 1.45 !important;
  }
  .invoice-lines {
    width: 100% !important;
    font-size: 7.5pt !important;
  }
  .invoice-lines thead {
    display: table-header-group;
  }
  .invoice-lines tr {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }
  .invoice-lines th,
  .invoice-lines td {
    padding: 3px 4px !important;
    border-color: #111 !important;
    background: #fff !important;
    color: #000 !important;
    line-height: 1.4 !important;
  }
  .invoice-lines th {
    font-weight: 800 !important;
  }
  .invoice-lines :deep(.el-input),
  .invoice-lines :deep(.el-input-number) {
    display: none !important;
  }
  .print-value {
    display: inline !important;
  }
  .invoice-lines tfoot {
    display: table-row-group;
  }
  .invoice-lines tfoot td {
    padding: 5px 6px !important;
    font-size: 8pt !important;
  }
  .invoice-notes {
    min-height: 24px !important;
    padding: 5px 7px !important;
    border-color: #111 !important;
    font-size: 7.5pt !important;
  }
  .invoice-signatures {
    min-height: 48px !important;
    border-color: #111 !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .invoice-signatures div {
    padding: 6px !important;
    font-size: 8pt !important;
  }
  .invoice-signatures div + div {
    border-color: #111 !important;
  }
}
</style>
