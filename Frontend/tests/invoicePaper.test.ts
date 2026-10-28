import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { invoicePages } from '../src/lib/invoicePresentation.ts'

test('invoice preview and print share the table footer on the final page', async () => {
  const server = await createServer({
    configFile: false,
    plugins: [vue()],
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  try {
    const { default: Paper } = await server.ssrLoadModule('/src/components/InvoicePaper.vue')
    for (const count of [1, 13, 14, 33, 34, 53, 80]) {
      const invoice = {
        id: 114,
        number: '114',
        currency: 'IRR',
        issueDate: '2026-10-26',
        total: 9_968_000,
        subtotal: 10_000_000,
        discount: 32_000,
        paidAmount: 0,
        settlement: 'INSTALLMENT',
        buyerFirstName: 'خریدار',
        buyerLastName: 'نمونه',
        buyerAddress: 'نشانی خریدار',
        buyerPhone: '02112345678',
        buyerNationalId: '1234567890',
        notes: 'توضیحات مخصوص صفحه آخر',
        items: Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          productId: i + 1,
          name: `کالای ${i + 1}`,
          quantity: 1,
          unit: 'عدد',
          unitPrice: 1000,
        })),
      }
      const html = await renderToString(
        h(Paper, {
          invoice,
          settings: {
            name: 'فروشگاه نمونه',
            address: 'نشانی فروشنده',
            phone: '02187654321',
            logoUrl: '/test-logo.png',
            iban: 'IR000000000000000000000000',
          },
        }),
      )
      const printFooter = html.match(/<table class="paper-footer-table"[^]*?<\/table>/)?.[0]
      assert.ok(printFooter)
      assert.equal((printFooter.match(/<tr\b[^>]*>/g) || []).length, 3)
      assert.match(printFooter, /شرایط و نحوه فروش:/)
      assert.match(printFooter, /☐ نقدی/)
      assert.match(printFooter, /☑ غیرنقدی/)
      assert.match(printFooter, /مهر و امضا فروشنده/)
      assert.match(printFooter, /مهر و امضا خریدار/)
      assert.match(printFooter, /مبلغ پرداختی/)
      assert.match(printFooter, /۹٬۹۶۸٬۰۰۰ ریال/)
      assert.match(printFooter, /توضیح(?:ات) مخصوص صفحه آخر/)
      assert.doesNotMatch(printFooter, /شماره شبا/)
      const pages = invoicePages(invoice.items).length
      assert.equal((html.match(/class="invoice-paper"/g) || []).length, pages)
      assert.equal((html.match(/class="paper-header"/g) || []).length, pages)
      assert.equal((html.match(/class="paper-parties"/g) || []).length, 1)
      assert.equal((html.match(/class="paper-bottom"/g) || []).length, 1)
      assert.equal((html.match(/class="paper-pagination"/g) || []).length, pages)
      assert.equal((html.match(/مهر و امضا فروشنده/g) || []).length, 1)
      assert.equal((html.match(/مهر و امضا خریدار/g) || []).length, 1)
      assert.equal((html.match(/test-logo.png/g) || []).length, pages)
      assert.equal((html.match(/class="paper-footer-table"/g) || []).length, 1)
      assert.match(html, /تخفیف/)
      assert.match(html, /جمع کل فاکتور/)
      const parties = html.match(/<table class="paper-parties"[^]*?<\/table>/)?.[0]
      assert.ok(parties)
      const partyRows = [...parties.matchAll(/<tr\b[^>]*>([^]*?)<\/tr>/g)]
      assert.equal(partyRows.length, 2)
      for (const row of partyRows) assert.equal((row[1]!.match(/<td\b/g) || []).length, 4)
      for (const row of partyRows)
        assert.match(row[1]!, /<th scope="row" class="party-row-heading"/)
      assert.match(partyRows[0]![1]!, /نشانی فروشنده/)
      assert.match(partyRows[1]![1]!, /نشانی خریدار/)
      assert.match(partyRows[1]![1]!, /1234567890/)
      assert.doesNotMatch(parties, /—/)
      assert.match(html, /class="paper-currency"[^>]*>\(ریال\)<\/small>/)
      for (const header of html.matchAll(/<header[^]*?<\/header>/g)) {
        assert.doesNotMatch(header[0], /صفحه/)
        assert.match(header[0], /<bdi dir="ltr"[^>]*>۱۱۴<\/bdi>/)
        assert.match(header[0], /<bdi dir="ltr"[^>]*>۱۴۰۵\/۰۸\/۰۴<\/bdi>/)
      }
      for (const footer of html.matchAll(/<footer[^]*?<\/footer>/g)) {
        assert.match(footer[0], /paper-pagination/)
        assert.doesNotMatch(footer[0], /شماره شبا/)
      }
      assert.match(html, /نه میلیون و نهصد و شصت و هشت هزار ریال/)
      const articles = html.split('<article').slice(1)
      assert.match(articles[0]!, /paper-parties/)
      assert.match(articles.at(-1)!, /paper-bottom/)
      if (pages > 1) assert.doesNotMatch(articles[0]!, /paper-bottom/)
      if (pages > 2) {
        assert.doesNotMatch(articles[1]!, /paper-parties/)
        assert.doesNotMatch(articles[1]!, /paper-bottom/)
      }
      const renderedWithoutDiscount = await renderToString(
        h(Paper, {
          invoice: { ...invoice, discount: 0, subtotal: invoice.total, settlement: 'CASH' },
          settings: null,
        }),
      )
      const cashFooter = renderedWithoutDiscount.match(
        /<table class="[^"]*\bpaper-footer-table\b[^"]*"[^]*?<\/table>/,
      )?.[0]
      assert.ok(cashFooter, renderedWithoutDiscount.match(/<table[^>]*>/g)?.join('\n'))
      assert.match(cashFooter, /☑ نقدی/)
      assert.match(cashFooter, /☐ غیرنقدی/)
      assert.doesNotMatch(cashFooter, /تخفیف|جمع کل فاکتور/)
      assert.match(cashFooter, /rowspan="3"/)
      assert.equal((cashFooter.match(/class="footer-payment"/g) || []).length, 1)
      assert.match(cashFooter, /نه میلیون و نهصد و شصت و هشت هزار ریال/)
    }
  } finally {
    await server.close()
  }
})
