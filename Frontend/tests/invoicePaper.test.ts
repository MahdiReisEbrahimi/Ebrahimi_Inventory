import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'

test('printed invoice repeats compact headers and keeps parties/footer on first/last pages', async () => {
  const server = await createServer({
    configFile: false,
    plugins: [vue()],
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  try {
    const { default: Paper } = await server.ssrLoadModule('/src/components/InvoicePaper.vue')
    for (const count of [10, 11, 21]) {
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
      const pages = Math.ceil(count / 10)
      assert.equal((html.match(/class="invoice-paper"/g) || []).length, pages)
      assert.equal((html.match(/class="paper-header"/g) || []).length, pages)
      assert.equal((html.match(/class="paper-parties"/g) || []).length, 1)
      assert.equal((html.match(/class="paper-bottom"/g) || []).length, 1)
      assert.equal((html.match(/class="paper-pagination"/g) || []).length, pages)
      assert.equal((html.match(/امضای فروشنده/g) || []).length, 1)
      assert.equal((html.match(/امضای خریدار/g) || []).length, 1)
      assert.equal((html.match(/test-logo.png/g) || []).length, pages)
      assert.match(html, /تخفیف:/)
      assert.match(html, /جمع اقلام:/)
      assert.doesNotMatch(html, /مبلغ پرداختی|مانده:/)
      assert.match(html, /class="paper-settlement"[^]*?IR000000000000000000000000[^]*?<\/div>/)
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
      const withoutDiscount = await renderToString(
        h(Paper, {
          invoice: { ...invoice, discount: 0, subtotal: invoice.total },
          settings: null,
        }),
      )
      assert.doesNotMatch(withoutDiscount, /تخفیف|جمع اقلام/)
      assert.match(withoutDiscount, /جمع کل فاکتور/)
      assert.doesNotMatch(withoutDiscount, /paper-totals|مبلغ پرداختی|مانده:/)
      assert.match(withoutDiscount, /نه میلیون و نهصد و شصت و هشت هزار ریال/)
    }
  } finally {
    await server.close()
  }
})
