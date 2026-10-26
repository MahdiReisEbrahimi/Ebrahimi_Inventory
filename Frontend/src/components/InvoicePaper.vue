<template>
  <div ref="sheets" class="invoice-sheets" dir="rtl">
    <article v-for="(page, pageIndex) in pages" :key="pageIndex" class="invoice-paper">
      <div class="paper-content" :style="{ transform: `scale(${scales[pageIndex] || 1})` }">
        <header class="paper-header">
          <div class="paper-logo">
            <img v-if="seller.logoUrl" :src="seller.logoUrl" alt="لوگوی فروشگاه" />
          </div>
          <div class="paper-brand">
            <h2>{{ seller.name }}</h2>
            <span>فاکتور فروش کالا</span>
          </div>
          <div class="paper-reference">
            <b>{{ draft ? 'پیش‌نویس · ثبت نشده' : 'شماره فاکتور: ' + invoice.number }}</b>
            <span
              >تاریخ صدور:
              {{ persianDateLabel((invoice.issueDate || invoice.createdAt).slice(0, 10)) }}</span
            >
          </div>
        </header>
        <div v-if="pageIndex === 0" class="paper-parties">
          <section>
            <b>فروشنده: {{ seller.name }}</b>
            <p>{{ seller.address || '—' }}</p>
            <p>تلفن: {{ seller.phone || '—' }}</p>
          </section>
          <section>
            <b>خریدار: {{ invoice.buyerFirstName }} {{ invoice.buyerLastName }}</b>
            <p>{{ invoice.buyerAddress || '—' }}</p>
            <p>
              کد ملی: {{ invoice.buyerNationalId || '—' }} · تلفن: {{ invoice.buyerPhone || '—' }}
            </p>
          </section>
        </div>
        <table>
          <colgroup>
            <col class="row-col" />
            <col />
            <col class="quantity-col" />
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
            <tr v-for="(line, index) in page.items" :key="index">
              <td>{{ number(page.offset + index + 1) }}</td>
              <td>{{ line.name }}</td>
              <td>{{ number(line.quantity) }}</td>
              <td>{{ line.unit }}</td>
              <td>{{ number(line.unitPrice) }}</td>
              <td>{{ number(line.quantity * line.unitPrice) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="pageIndex === pages.length - 1" class="paper-bottom">
          <div v-if="(normalized.discount || 0) > 0" class="paper-totals">
            <span
              >جمع اقلام: <b>{{ rial(normalized.subtotal || 0) }}</b></span
            >
            <span
              >تخفیف: <b>{{ rial(normalized.discount || 0) }}</b></span
            >
          </div>
          <div class="paper-grand-total">
            <b>جمع کل فاکتور: {{ rial(normalized.total) }}</b
            ><span>({{ amountInWords(normalized.total) }})</span>
          </div>
          <div class="paper-settlement">
            <span
              >شرایط تسویه‌حساب:
              {{
                invoice.settlement === 'INSTALLMENT' ? '☐ نقدی   ☑ اقساطی' : '☑ نقدی   ☐ اقساطی'
              }}</span
            >
            <span
              >شماره شبای فروشنده: <bdi>{{ seller.iban || '—' }}</bdi></span
            >
          </div>
          <p v-if="invoice.notes" class="paper-notes"><b>توضیحات: </b>{{ invoice.notes }}</p>
        </div>
        <div v-else class="paper-continued">ادامه اقلام در صفحه بعد</div>
        <footer class="paper-signatures">
          <span><template v-if="pageIndex === pages.length - 1">امضای فروشنده</template></span>
          <span class="paper-pagination"
            >صفحه <bdi>{{ number(pageIndex + 1) }}/{{ number(pages.length) }}</bdi></span
          >
          <span><template v-if="pageIndex === pages.length - 1">امضای خریدار</template></span>
        </footer>
      </div>
    </article>
  </div>
</template>
<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { Invoice, StoreSettings } from '@/types'
import { number } from '@/lib/format'
import { persianDateLabel } from '@/lib/persianDate'
import { amountInWords, invoiceInRials, invoicePages, rial } from '@/lib/invoicePresentation'
const props = defineProps<{ invoice: Invoice; settings: StoreSettings | null; draft?: boolean }>()
const normalized = computed(() => invoiceInRials(props.invoice))
const pages = computed(() => invoicePages(normalized.value.items))
const sheets = ref<HTMLElement>()
const scales = ref<number[]>([])
async function prepareForPrint() {
  await nextTick()
  await document.fonts.ready
  await Promise.all(
    Array.from(sheets.value?.querySelectorAll('img') || []).map((img) =>
      img.decode().catch(() => undefined),
    ),
  )
  scales.value = Array.from(
    sheets.value?.querySelectorAll<HTMLElement>('.invoice-paper') || [],
  ).map((sheet) => {
    const content = sheet.querySelector<HTMLElement>('.paper-content')!
    return Math.min(
      1,
      sheet.clientHeight / content.scrollHeight,
      sheet.clientWidth / content.scrollWidth,
    )
  })
  await nextTick()
}
watch(
  () => [props.invoice, props.settings],
  () => {
    void prepareForPrint()
  },
  { deep: true },
)
onMounted(prepareForPrint)
defineExpose({ prepareForPrint })
const seller = computed(() => ({
  name: props.invoice.sellerName ?? props.settings?.name ?? 'فروشگاه',
  address: props.invoice.sellerAddress ?? props.settings?.address,
  phone: props.invoice.sellerPhone ?? props.settings?.phone,
  logoUrl: props.invoice.sellerLogoUrl ?? props.settings?.logoUrl,
  iban: props.invoice.sellerIban ?? props.settings?.iban,
}))
</script>
<style scoped>
.invoice-sheets {
  display: grid;
  gap: 24px;
  overflow-x: auto;
  padding: 4px;
}
.invoice-paper {
  --foreground: #111;
  --muted-foreground: #444;
  --border: #c9c9c9;
  background: #fff;
  color: #111;
  width: 198mm;
  height: 135mm;
  margin-inline: auto;
  outline: 1px solid #ddd;
  overflow: hidden;
  font-size: 9px;
  line-height: 1.5;
  font-family: 'Vazirmatn', Tahoma, sans-serif;
}
.paper-content {
  width: 198mm;
  min-height: 135mm;
  padding: 3mm;
  display: flex;
  flex-direction: column;
  transform-origin: top right;
}
.paper-header {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  align-items: center;
  border-bottom: 1.5px solid #333;
  padding-bottom: 2mm;
  margin-bottom: 2mm;
  gap: 3mm;
}
.paper-brand {
  text-align: center;
}
.paper-logo img {
  width: 14mm;
  height: 11mm;
  object-fit: contain;
}
.paper-brand h2 {
  font-size: 14px;
  margin: 0;
}
.paper-brand span {
  font-size: 8px;
}
.paper-reference {
  display: grid;
  text-align: left;
  gap: 1mm 5mm;
  font-size: 8px;
}
.paper-reference b {
  grid-column: 1 / -1;
  font-size: 10px;
}
.paper-parties {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1mm;
  margin-bottom: 2mm;
  border: 1px solid #ccc;
  padding: 1.5mm 2mm;
}
.paper-parties section {
  display: flex;
  flex-wrap: wrap;
  gap: 0 3mm;
  overflow-wrap: anywhere;
}
.paper-parties section + section {
  border-top: 1px solid #ddd;
  padding-top: 1mm;
}
.paper-parties p {
  margin: 0;
}
table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 9px;
  text-align: center;
}
.row-col {
  width: 8mm;
}
.quantity-col {
  width: 13mm;
}
.unit-col {
  width: 20mm;
}
.price-col {
  width: 32mm;
}
.total-col {
  width: 40mm;
}
th,
td {
  border: 1px solid #bbb;
  padding: 0.7mm 1.5mm;
  height: 4.5mm;
}
th {
  background: #f0f0f0;
  font-size: 8px;
}
th:nth-child(2),
td:nth-child(2) {
  text-align: start;
}
td:nth-child(n + 5) {
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
.paper-bottom {
  margin-top: auto;
  padding-top: 2mm;
}
.paper-totals {
  display: flex;
  justify-content: space-between;
  gap: 2mm;
  font-size: 8px;
}
.paper-grand-total {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 3mm;
  padding: 1.5mm 2mm;
  margin-top: 1.5mm;
  border: 1px solid #aaa;
  background: #f5f5f5;
}
.paper-grand-total span {
  font-size: 8px;
}
.paper-settlement {
  display: flex;
  flex-wrap: wrap;
  gap: 1mm 6mm;
  padding-top: 1mm;
  font-size: 8px;
}
.paper-notes {
  font-size: 8px;
  margin: 1mm 0 0;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.paper-signatures {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: 3mm;
  margin-top: 2mm;
  min-height: 10mm;
  padding: 1mm 12mm 0;
  border-top: 1px solid #ccc;
  font-size: 8px;
}
.paper-signatures > :last-child {
  text-align: end;
}
.paper-pagination {
  text-align: center;
}
.paper-continued {
  text-align: center;
  margin-top: auto;
  padding-top: 5mm;
  color: #555;
}
@media print {
  .invoice-sheets {
    display: block;
    overflow: visible;
    padding: 0;
  }
  .invoice-paper {
    outline: 0;
    margin: 0;
    break-after: page;
    break-inside: avoid;
    box-shadow: none;
    print-color-adjust: exact;
    -webkit-print-color-adjust: exact;
  }
  .invoice-paper:last-child {
    break-after: auto;
  }
  tr,
  .paper-bottom,
  .paper-header,
  .paper-signatures,
  .paper-parties {
    break-inside: avoid;
  }
}
</style>
