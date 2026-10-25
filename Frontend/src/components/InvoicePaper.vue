<template>
  <article class="invoice-paper" dir="rtl">
    <header class="invoice-paper__header">
      <div class="paper-brand">
        <img v-if="settings?.logoUrl" :src="settings.logoUrl" alt="نشان فروشگاه" /><span
          v-else
          class="paper-brand-icon"
          ><Store :size="30"
        /></span>
        <div>
          <span>صورتحساب فروش کالا</span>
          <h2>{{ settings?.name || 'فروشگاه' }}</h2>
        </div>
      </div>
      <div class="paper-reference">
        <b>{{ draft ? 'پیش‌نویس · ثبت نشده' : invoice.number }}</b
        ><span>{{ date(invoice.createdAt) }}</span>
      </div>
    </header>
    <div class="paper-parties">
      <section>
        <h3>فروشنده</h3>
        <b>{{ settings?.name || 'فروشگاه' }}</b>
        <p>{{ settings?.address || 'نشانی ثبت نشده' }}</p>
        <p>تلفن: {{ settings?.phone || '—' }}</p>
      </section>
      <section>
        <h3>خریدار</h3>
        <b>{{ invoice.buyerFirstName }} {{ invoice.buyerLastName }}</b>
        <p>{{ invoice.buyerAddress || 'نشانی ثبت نشده' }}</p>
        <p>کد ملی: {{ invoice.buyerNationalId || '—' }}</p>
      </section>
    </div>
    <div class="paper-table-scroll">
      <table>
        <thead>
          <tr>
            <th>ردیف</th>
            <th>شرح کالا</th>
            <th>واحد</th>
            <th>تعداد</th>
            <th>قیمت واحد · تومان</th>
            <th>جمع · تومان</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(line, index) in invoice.items" :key="line.id || line.productId">
            <td>{{ number(index + 1) }}</td>
            <td>{{ line.name }}</td>
            <td>{{ line.unit }}</td>
            <td>{{ number(line.quantity) }}</td>
            <td>{{ number(line.unitPrice) }}</td>
            <td>{{ number(line.quantity * line.unitPrice) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="paper-total">
      <span>جمع کل مبلغ قابل پرداخت</span><strong>{{ money(invoice.total) }}</strong>
    </div>
    <p v-if="invoice.notes" class="paper-notes"><b>توضیحات: </b>{{ invoice.notes }}</p>
    <footer class="paper-signatures">
      <span>مهر و امضای فروشنده</span><span>امضا و تأیید خریدار</span>
    </footer>
    <div class="paper-thanks">از اعتماد و همراهی شما سپاسگزاریم.</div>
  </article>
</template>
<script setup lang="ts">
import { Store } from '@lucide/vue'
import type { Invoice, StoreSettings } from '@/types'
import { date, money, number } from '@/lib/format'
defineProps<{ invoice: Invoice; settings: StoreSettings | null; draft?: boolean }>()
</script>
<style scoped>
.invoice-paper {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 34px;
  color: var(--foreground);
}
.invoice-paper__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  border-bottom: 2px solid var(--primary);
  padding-bottom: 26px;
  margin-bottom: 26px;
}
.paper-brand {
  display: flex;
  align-items: center;
  gap: 15px;
}
.paper-brand img {
  max-width: 90px;
  max-height: 70px;
  object-fit: contain;
}
.paper-brand-icon {
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  background: var(--accent);
  color: var(--primary);
  border-radius: 15px;
}
.paper-brand span {
  font-size: 11px;
  color: var(--muted-foreground);
}
.paper-brand h2 {
  margin: 5px 0 0;
  font-size: 22px;
}
.paper-reference {
  display: grid;
  gap: 8px;
  text-align: end;
  font-size: 11px;
}
.paper-reference b {
  direction: ltr;
  overflow-wrap: anywhere;
}
.paper-reference span {
  color: var(--muted-foreground);
}
.paper-parties {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 28px;
  font-size: 12px;
}
.paper-parties h3 {
  font-size: 10px;
  font-weight: 400;
  color: var(--muted-foreground);
  margin: 0 0 10px;
}
.paper-parties p {
  margin: 6px 0 0;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}
.paper-table-scroll {
  overflow-x: auto;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
  text-align: start;
}
th {
  padding: 12px 10px;
  background: var(--muted);
  font-size: 10px;
  white-space: nowrap;
}
td {
  padding: 15px 10px;
  border-bottom: 1px solid var(--border);
}
td:nth-child(n + 4) {
  white-space: nowrap;
}
.paper-total {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  background: var(--accent);
  color: var(--accent-foreground);
  padding: 18px;
  border-radius: 10px;
  margin-top: 22px;
  font-size: 12px;
}
.paper-total strong {
  font-size: 18px;
}
.paper-notes {
  margin: 24px 0;
  font-size: 12px;
}
.paper-signatures {
  display: flex;
  justify-content: space-between;
  padding: 35px 24px 55px;
  font-size: 12px;
}
.paper-thanks {
  text-align: center;
  border-top: 1px solid var(--border);
  padding-top: 15px;
  color: var(--muted-foreground);
  font-size: 10px;
}
@media (max-width: 640px) {
  .invoice-paper {
    padding: 18px;
  }
  .paper-brand-icon {
    display: none;
  }
  .paper-parties {
    gap: 18px;
  }
  .paper-total {
    flex-direction: column;
  }
  .paper-signatures {
    padding-inline: 0;
  }
  .paper-brand h2 {
    font-size: 17px;
  }
}
@media print {
  .invoice-paper {
    --card: #fff;
    --foreground: #111;
    --primary: #222;
    --muted: #f4f4f4;
    --muted-foreground: #444;
    --border: #ccc;
    --accent: #f4f4f4;
    --accent-foreground: #111;
    padding: 0;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    font-size: 11px;
  }
  .paper-table-scroll {
    overflow: visible;
  }
  table {
    table-layout: auto;
    width: 100%;
  }
  tr {
    break-inside: avoid;
  }
  thead {
    display: table-header-group;
  }
  .paper-total,
  .paper-signatures {
    break-inside: avoid;
  }
  .paper-total {
    flex-direction: row;
  }
  .paper-brand-icon {
    display: grid;
  }
  .paper-parties {
    grid-template-columns: 1fr 1fr;
  }
  .invoice-paper__header {
    break-inside: avoid;
  }
}
</style>
