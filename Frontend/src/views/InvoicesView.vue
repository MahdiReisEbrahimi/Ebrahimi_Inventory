<template>
  <section dir="rtl" class="invoice-page">
    <div class="toolbar no-print">
      <div>
        <h2>فاکتور فروش</h2>
        <p>فاکتور نهایی، موجودی را کم می‌کند و در گردش انبار ثبت می‌شود.</p>
      </div>
      <el-button type="primary" :loading="saving" :disabled="!draft.length" @click="save"
        >ثبت و صدور فاکتور</el-button
      >
    </div>
    <el-card class="no-print" shadow="never">
      <template #header> <b>اطلاعات خریدار</b> </template>
      <el-form inline>
        <el-form-item label="نام"> <el-input v-model="buyer.firstName" /> </el-form-item>
        <el-form-item label="نام خانوادگی"> <el-input v-model="buyer.lastName" /> </el-form-item>
        <el-form-item label="کد ملی"> <el-input v-model="buyer.nationalId" /> </el-form-item>
        <el-form-item label="آدرس"> <el-input v-model="buyer.address" /> </el-form-item>
        <el-form-item label="توضیحات"> <el-input v-model="buyer.notes" /> </el-form-item>
      </el-form>
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
    <article class="paper" v-if="activeInvoice || draft.length">
      <header class="paper-head">
        <div class="brand">
          <img v-if="settings?.logoUrl" :src="settings.logoUrl" alt="لوگو" />
          <div v-else class="logo-placeholder">لوگو</div>
          <div>
            <h1>{{ settings?.name || 'فروشگاه' }}</h1>
            <div>{{ settings?.address }}</div>
            <div>{{ settings?.phone }}</div>
          </div>
        </div>
        <div class="invoice-meta">
          <b>فاکتور فروش</b> <span>شماره: {{ activeInvoice?.number || 'پس از ثبت' }}</span>
          <span
            >تاریخ:
            {{ new Date(activeInvoice?.createdAt || Date.now()).toLocaleDateString('fa-IR') }}</span
          >
        </div>
      </header>
      <section class="buyer">
        <b>مشخصات خریدار</b>
        <span
          >نام:
          {{
            activeInvoice
              ? `${activeInvoice.buyerFirstName || ''} ${activeInvoice.buyerLastName || ''}`
              : `${buyer.firstName} ${buyer.lastName}`
          }}</span
        >
        <span>کد ملی: {{ activeInvoice?.buyerNationalId || buyer.nationalId || '—' }}</span>
        <span>آدرس: {{ activeInvoice?.buyerAddress || buyer.address || '—' }}</span>
      </section>
      <el-table :data="activeInvoice?.items || draft" border class="line-items">
        <el-table-column type="index" label="ردیف" width="60" />
        <el-table-column prop="name" label="نام محصول" min-width="140" />
        <el-table-column prop="unit" label="واحد" width="75" />
        <el-table-column label="تعداد" width="130">
          <template #default="s">
            <el-input-number
              v-if="!activeInvoice"
              v-model="s.row.quantity"
              :min="1"
              :max="products.find((p) => p.id === s.row.productId)?.stock || 999999"
              size="small"
              controls-position="right"
            />
            <span v-else>{{ s.row.quantity }}</span>
          </template>
        </el-table-column>
        <el-table-column label="قیمت فی (تومان)" min-width="140">
          <template #default="s">
            <el-input
              v-if="!activeInvoice"
              :model-value="priceFormat(s.row.unitPrice)"
              inputmode="numeric"
              @input="(v: string) => setPrice(s.row, v)"
            />
            <span v-else>{{ money(s.row.unitPrice) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="قیمت کل" min-width="140">
          <template #default="s">{{ money(s.row.quantity * s.row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column v-if="!activeInvoice" label="" width="62" class-name="no-print">
          <template #default="s">
            <el-button type="danger" text @click="draft.splice(s.$index, 1)">حذف</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="total">
        <b>مبلغ نهایی</b> <strong>{{ money(total) }}</strong>
      </div>
      <div class="notes"><b>توضیحات:</b> {{ activeInvoice?.notes || buyer.notes || '—' }}</div>
      <footer class="signatures">
        <div>مهر و امضای فروشنده</div>
        <div>امضای خریدار</div>
      </footer>
      <div class="no-print print-actions">
        <el-button @click="windowPrint">چاپ فاکتور A5</el-button>
        <el-button v-if="activeInvoice" @click="newDraft">فاکتور جدید</el-button>
      </div>
    </article>
    <el-card class="no-print" shadow="never">
      <template #header> <b>فاکتورهای ثبت‌شده</b> </template>
      <el-table :data="invoices" v-loading="loading" @row-click="openInvoice">
        <el-table-column prop="number" label="شماره فاکتور" />
        <el-table-column label="خریدار">
          <template #default="s">{{ s.row.buyerFirstName }} {{ s.row.buyerLastName }}</template>
        </el-table-column>
        <el-table-column label="مبلغ">
          <template #default="s">{{ money(s.row.total) }}</template>
        </el-table-column>
        <el-table-column label="تاریخ">
          <template #default="s">{{
            new Date(s.row.createdAt).toLocaleDateString('fa-IR')
          }}</template>
        </el-table-column>
        <el-table-column label="عملیات">
          <template #default="s">
            <el-button link type="primary" @click.stop="openInvoice(s.row)">مشاهده / چاپ</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    <el-card class="no-print" shadow="never">
      <template #header> <b>اطلاعات فروشگاه در سربرگ</b> </template>
      <el-form inline>
        <el-form-item label="نام فروشگاه"> <el-input v-model="settingsForm.name" /> </el-form-item>
        <el-form-item label="نشانی"> <el-input v-model="settingsForm.address" /> </el-form-item>
        <el-form-item label="تلفن"> <el-input v-model="settingsForm.phone" /> </el-form-item>
        <el-form-item label="نشانی لوگو">
          <el-input v-model="settingsForm.logoUrl" />
        </el-form-item>
        <el-button @click="saveSettings">ذخیره اطلاعات</el-button>
      </el-form>
    </el-card>
  </section>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { productsApi } from '@/services/products'
import { inventoryApi } from '@/services/inventory'
import type { Invoice, InvoiceItem, Product, StoreSettings } from '@/types'
type DraftLine = InvoiceItem
const products = ref<Product[]>([]),
  invoices = ref<Invoice[]>([]),
  activeInvoice = ref<Invoice | null>(null),
  settings = ref<StoreSettings | null>(null),
  loading = ref(false),
  saving = ref(false),
  selectedProduct = ref<number>(),
  draft = ref<DraftLine[]>([])
const buyer = reactive({ firstName: '', lastName: '', nationalId: '', address: '', notes: '' })
const settingsForm = reactive({ name: '', address: '', phone: '', logoUrl: '' })
const total = computed(
  () => activeInvoice.value?.total ?? draft.value.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
)
const money = (v: number) => `${new Intl.NumberFormat('fa-IR').format(v)} تومان`,
  priceFormat = (v: number) => new Intl.NumberFormat('fa-IR').format(v)
function setPrice(row: any, v: string) {
  row.unitPrice =
    Number(
      v
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/\D/g, ''),
    ) || 0
}
function addProduct() {
  const p = products.value.find((x) => x.id === selectedProduct.value)
  if (!p) return
  const line = draft.value.find((x) => x.productId === p.id)
  if (line) {
    if (line.quantity < p.stock) line.quantity++
  } else
    draft.value.push({
      id: 0,
      productId: p.id,
      name: p.name,
      unit: p.unit,
      quantity: 1,
      unitPrice: p.sellPrice,
      total: p.sellPrice,
    })
  selectedProduct.value = undefined
}
async function load() {
  loading.value = true
  try {
    const [p, i, s] = await Promise.all([
      productsApi.list({ page: 1, limit: 10000, isActive: true }),
      inventoryApi.invoices(),
      inventoryApi.settings(),
    ])
    products.value = p.data
    invoices.value = i
    settings.value = s
    Object.assign(settingsForm, {
      name: s.name,
      address: s.address || '',
      phone: s.phone || '',
      logoUrl: s.logoUrl || '',
    })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'دریافت اطلاعات ناموفق بود.')
  } finally {
    loading.value = false
  }
}
async function save() {
  if (
    !draft.value.length ||
    draft.value.some((i) => i.quantity < 1 || !Number.isInteger(i.unitPrice) || i.unitPrice < 0)
  ) {
    ElMessage.warning('اقلام و قیمت‌های فاکتور را بررسی کنید.')
    return
  }
  saving.value = true
  try {
    activeInvoice.value = await inventoryApi.createInvoice({
      buyerFirstName: buyer.firstName,
      buyerLastName: buyer.lastName,
      buyerNationalId: buyer.nationalId,
      buyerAddress: buyer.address,
      notes: buyer.notes,
      items: draft.value.map(({ productId, quantity, unitPrice }) => ({
        productId,
        quantity,
        unitPrice,
      })),
    })
    ElMessage.success('فاکتور ثبت شد و موجودی به‌روز شد.')
    draft.value = []
    await load()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'ثبت فاکتور ناموفق بود.')
  } finally {
    saving.value = false
  }
}
async function openInvoice(row: any) {
  try {
    activeInvoice.value = await inventoryApi.invoice(Number(row.id))
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'دریافت فاکتور ناموفق بود.')
  }
}
function newDraft() {
  activeInvoice.value = null
  draft.value = []
  Object.assign(buyer, { firstName: '', lastName: '', nationalId: '', address: '', notes: '' })
}
async function saveSettings() {
  try {
    settings.value = await inventoryApi.saveSettings(settingsForm)
    ElMessage.success('اطلاعات فروشگاه ذخیره شد.')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'ذخیره ناموفق بود.')
  }
}
function windowPrint() {
  window.print()
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
  .toolbar :deep(.el-button) {
    width: 100%;
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
</style>
