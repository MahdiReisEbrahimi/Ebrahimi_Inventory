import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'

test('invoice preview and print share the table footer on the final page', async () => {
  const server = await createServer({
    configFile: false,
    plugins: [vue()],
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  try {
    const { default: Paper } = await server.ssrLoadModule('/src/components/InvoicePaper.vue')
    for (const count of [1, 10, 11, 21]) {
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
      const pages = Math.ceil(count / 10)
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
      for (const header of html.matchAll(/<header[^]*?<\/header>/g)) {
        assert.doesNotMatch(header[0], /صفحه/)
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
        /<table class="paper-footer-table"[^]*?<\/table>/,
      )?.[0]
      assert.ok(cashFooter)
      assert.match(cashFooter, /☑ نقدی/)
      assert.match(cashFooter, /☐ غیرنقدی/)
      assert.match(cashFooter, /تخفیف/)
      assert.match(cashFooter, /۰ ریال/)
      assert.match(cashFooter, /جمع کل فاکتور/)
      assert.match(cashFooter, /نه میلیون و نهصد و شصت و هشت هزار ریال/)
    }
  } finally {
    await server.close()
  }
})
