import test from 'node:test'
import assert from 'node:assert/strict'
import { amountInWords, invoiceInRials, invoicePages } from '../src/lib/invoicePresentation.ts'
import { addDays, monthStart, persianParts, persianToIso } from '../src/lib/persianDate.ts'
import type { Invoice } from '../src/types/index.ts'

test('Persian amount wording includes the requested example and zero', () => {
  assert.equal(amountInWords(9_968_000), 'نه میلیون و نهصد و شصت و هشت هزار ریال')
  assert.equal(amountInWords(0), 'صفر ریال')
  assert.equal(amountInWords(1_001_101), 'یک میلیون و یک هزار و صد و یک ریال')
  assert.equal(amountInWords(Number.NaN), '—')
})

test('ten, eleven and twenty-one invoice items preserve consecutive row offsets', () => {
  for (const count of [1, 10, 11, 20, 21]) {
    const items = Array.from({ length: count }, (_, i) => i + 1)
    const pages = invoicePages(items)
    assert.equal(pages.length, Math.ceil(count / 10))
    assert.deepEqual(
      pages.flatMap((page) => page.items),
      items,
    )
    pages.forEach((page, index) => assert.equal(page.offset, index * 10))
  }
})

test('legacy toman invoices convert once and rial invoices never multiply again', () => {
  const legacy = {
    id: 1,
    total: 1000,
    subtotal: 1200,
    discount: 200,
    paidAmount: 500,
    currency: 'TOMAN',
    items: [{ unitPrice: 600, total: 1200 }],
  } as Invoice
  const rial = invoiceInRials(legacy)
  assert.equal(rial.total, 10000)
  assert.equal(rial.discount, 2000)
  assert.equal(rial.paidAmount, 5000)
  assert.equal(rial.items[0]?.unitPrice, 6000)
  assert.deepEqual(invoiceInRials(rial), rial)
  assert.equal(legacy.total, 1000)
})

test('Persian picker handles leap Esfand, Nowruz and month boundaries', () => {
  assert.equal(persianToIso(1403, 12, 30), '2025-03-20')
  assert.equal(persianToIso(1404, 1, 1), '2025-03-21')
  assert.throws(() => persianToIso(1404, 12, 30))
  assert.deepEqual(persianParts('2026-10-26'), { year: 1405, month: 8, day: 4 })
  assert.equal(monthStart('2026-10-26'), '2026-10-23')
  assert.equal(addDays('2025-03-20', 1), '2025-03-21')
})
