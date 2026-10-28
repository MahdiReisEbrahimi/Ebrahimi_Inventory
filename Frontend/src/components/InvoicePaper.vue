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
        <table v-if="pageIndex === 0" class="paper-parties" aria-label="مشخصات فروشنده و خریدار">
          <colgroup>
            <col style="width: 9%" />
            <col style="width: 27%" />
            <col style="width: 31%" />
            <col style="width: 15%" />
            <col style="width: 18%" />
          </colgroup>
          <tbody>
            <tr v-for="party in parties" :key="party.label">
              <th scope="row" class="party-row-heading">{{ party.label }}</th>
              <td>
                <b>نام شخص (حقیقی/حقوقی)</b><span>{{ party.name }}</span>
              </td>
              <td>
                <b>نشانی</b><span>{{ party.address }}</span>
              </td>
              <td>
                <b>تلفن</b><span dir="ltr">{{ party.phone }}</span>
              </td>
              <td>
                <b>شماره ملی/شماره ثبت</b><span dir="ltr">{{ party.nationalId }}</span>
              </td>
            </tr>
          </tbody>
        </table>
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
              <th>فی <small class="paper-currency">(ریال)</small></th>
              <th>جمع <small class="paper-currency">(ریال)</small></th>
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
          <table
            class="paper-footer-table"
            :class="{ 'paper-footer-table--simple': !hasDiscount }"
            aria-label="خلاصه و امضاهای فاکتور"
          >
            <colgroup>
              <col />
              <col />
              <col class="footer-amount-col" />
            </colgroup>
            <tbody>
              <tr>
                <td colspan="2">
                  <div class="footer-sale-terms">
                    <b>شرایط و نحوه فروش:</b>
                    <span>{{ invoice.settlement === 'INSTALLMENT' ? '☐' : '☑' }} نقدی</span>
                    <span>{{ invoice.settlement === 'INSTALLMENT' ? '☑' : '☐' }} غیرنقدی</span>
                  </div>
                </td>
                <td v-if="!hasDiscount" rowspan="3" class="footer-payment-cell">
                  <div class="footer-payment">
                    <div>
                      <b>مبلغ پرداختی</b><span>{{ amountInWords(normalized.total) }}</span>
                    </div>
                    <strong>{{ rial(normalized.total) }}</strong>
                  </div>
                </td>
                <td v-else>
                  <div class="footer-amount-row">
                    <b>جمع کل فاکتور</b
                    ><span>{{ rial(normalized.subtotal ?? normalized.total) }}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td colspan="2" class="footer-notes">
                  <b>توضیحات: </b>{{ invoice.notes || '…………………………………………' }}
                </td>
                <td v-if="hasDiscount">
                  <div class="footer-amount-row">
                    <b>تخفیف</b><span>{{ rial(normalized.discount || 0) }}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="footer-signature"><b>مهر و امضا فروشنده:</b></td>
                <td class="footer-signature"><b>مهر و امضا خریدار:</b></td>
                <td v-if="hasDiscount">
                  <div class="footer-payment">
                    <div>
                      <b>مبلغ پرداختی</b><span>{{ amountInWords(normalized.total) }}</span>
                    </div>
                    <strong>{{ rial(normalized.total) }}</strong>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="paper-continued">ادامه اقلام در صفحه بعد</div>
        <footer class="paper-page-footer">
          <span class="paper-pagination"
            >صفحه <bdi>{{ number(pageIndex + 1) }}/{{ number(pages.length) }}</bdi></span
          >
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
const hasDiscount = computed(() => (normalized.value.discount ?? 0) > 0)
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
  const elements = Array.from(sheets.value?.querySelectorAll<HTMLElement>('.invoice-paper') || [])
  const measure = () =>
    elements.map((sheet) => {
      const content = sheet.querySelector<HTMLElement>('.paper-content')!
      return Math.min(
        1,
        sheet.clientHeight / Math.max(content.scrollHeight, content.offsetHeight),
        sheet.clientWidth / Math.max(content.scrollWidth, content.offsetWidth),
      )
    })
  scales.value = measure()
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
const parties = computed(() => [
  {
    label: 'فروشنده',
    name: props.invoice.sellerName ?? props.settings?.name ?? '',
    address: seller.value.address ?? '',
    phone: seller.value.phone ?? '',
    // Seller identification is not collected by the current store settings model.
    nationalId: '',
  },
  {
    label: 'خریدار',
    name: [props.invoice.buyerFirstName, props.invoice.buyerLastName].filter(Boolean).join(' '),
    address: props.invoice.buyerAddress ?? '',
    phone: props.invoice.buyerPhone ?? '',
    nationalId: props.invoice.buyerNationalId ?? '',
  },
])
</script>
<style scoped>
.invoice-sheets {
  display: grid;
  gap: 24px;
  overflow-x: auto;
  padding: 4px;
}
.invoice-paper {
  --paper-unit-width: 20mm;
  --paper-price-width: 32mm;
  --paper-total-width: 40mm;
  --paper-payment-width: calc(
    var(--paper-unit-width) + var(--paper-price-width) + var(--paper-total-width)
  );
  --paper-border-width: 1px;
  --paper-border: var(--paper-border-width) solid #000;
  --foreground: #111;
  --muted-foreground: #444;
  --border: #000;
  background: #fff;
  color: #111;
  width: 198mm;
  height: 135mm;
  margin-inline: auto;
  overflow: hidden;
  font-size: 9px;
  line-height: 1.5;
  font-family: var(--font-family);
}
.paper-content {
  width: 198mm;
  border: var(--paper-border);
  display: flex;
  flex-direction: column;
  transform-origin: top right;
}
.paper-header {
  display: grid;
  grid-template-columns: 1fr 1.4fr 1fr;
  align-items: center;
  border-bottom: var(--paper-border);
  padding: 2mm 3mm;
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
  text-align: start;
}
.paper-parties td {
  height: auto;
  border-inline: 0;
  vertical-align: top;
  text-align: start;
  overflow-wrap: anywhere;
  padding: 0.7mm 1.5mm;
  line-height: 1.35;
  white-space: normal;
}
.paper-parties .party-row-heading {
  border-inline: 0;
  padding: 0.7mm 1mm;
  background: #eaeaea;
  color: #000;
  vertical-align: middle;
  text-align: center;
  font-size: 9px;
  font-weight: 700;
}
.paper-parties tr:first-child > * {
  border-top: 0;
}
.paper-parties b,
.paper-parties span {
  display: block;
}
.paper-parties b {
  font-size: 7px;
  margin-bottom: 0.3mm;
}
.paper-parties span {
  min-height: 1.2em;
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
  width: var(--paper-unit-width);
}
.price-col {
  width: var(--paper-price-width);
}
.total-col {
  width: var(--paper-total-width);
}
.footer-amount-col {
  width: var(--paper-payment-width);
}
th,
td {
  border: var(--paper-border);
  padding: 0.7mm 1.5mm;
  height: 4.5mm;
}
/* The surrounding frame owns the outside edges; adjacent sections share a line. */
tr > :first-child {
  border-inline-start: 0;
}
tr > :last-child {
  border-inline-end: 0;
}
thead tr:first-child th {
  border-top: 0;
}
th {
  background: #f0f0f0;
  font-size: 8px;
}
.paper-currency {
  font-size: 0.8em;
  font-weight: 400;
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
  margin-top: 0;
}
.paper-page-footer {
  padding: 1mm 2mm;
  font-size: 8px;
  text-align: center;
}
.paper-footer-table {
  margin-top: calc(-1 * var(--paper-border-width));
}
.paper-footer-table td {
  padding: 1mm 1.5mm;
  text-align: start;
  vertical-align: top;
  white-space: normal;
}
.paper-footer-table .footer-payment-cell {
  vertical-align: middle;
}
.paper-footer-table--simple tr:not(:first-child) > :last-child {
  border-inline-end: var(--paper-border);
}
.footer-sale-terms,
.footer-amount-row {
  display: flex;
  align-items: center;
  gap: 3mm;
}
.footer-amount-row {
  justify-content: space-between;
}
.footer-sale-terms span,
.footer-amount-row span {
  white-space: nowrap;
}
.paper-footer-table .footer-notes {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.paper-footer-table .footer-signature {
  height: 10mm;
  font-size: 8px;
}
.footer-payment {
  display: flex;
  flex-direction: column;
  gap: 1mm;
}
.footer-payment > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 2mm;
}
.footer-payment > div b {
  white-space: nowrap;
}
.footer-payment > div span {
  font-size: 8px;
}
.footer-payment > strong {
  font-size: 15px;
  text-align: end;
  font-variant-numeric: tabular-nums;
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
  .paper-page-footer,
  .paper-parties {
    break-inside: avoid;
  }
}
</style>
