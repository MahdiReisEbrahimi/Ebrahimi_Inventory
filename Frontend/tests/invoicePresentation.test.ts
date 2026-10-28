import test from 'node:test'
import assert from 'node:assert/strict'
import {
  amountInWords,
  invoiceInRials,
  invoicePages,
  invoicePageCapacities,
} from '../src/lib/invoicePresentation.ts'
import {
  addDays,
  monthStart,
  persianParts,
  persianToIso,
  persianNumericDateLabel,
} from '../src/lib/persianDate.ts'
import type { Invoice } from '../src/types/index.ts'

test('Persian amount wording includes the requested example and zero', () => {
  assert.equal(amountInWords(9_968_000), 'نه میلیون و نهصد و شصت و هشت هزار ریال')
  assert.equal(amountInWords(0), 'صفر ریال')
  assert.equal(amountInWords(1_001_101), 'یک میلیون و یک هزار و صد و یک ریال')
  assert.equal(amountInWords(Number.NaN), '—')
})

test('A5 page types respect individual capacities and preserve every row and offset', () => {
  for (let count = 0; count <= 300; count++) {
    const items = Array.from({ length: count }, (_, i) => i + 1)
    const pages = invoicePages(items)
    const expectedPages = count <= 13 ? 1 : 2 + Math.max(0, Math.ceil((count - 33) / 20))
    assert.equal(pages.length, expectedPages)
    assert.deepEqual(
      pages.flatMap((page) => page.items),
      items,
    )
    let offset = 0
    pages.forEach((page, index) => {
      const limit =
        pages.length === 1
          ? invoicePageCapacities.single
          : index === 0
            ? invoicePageCapacities.first
            : index === pages.length - 1
              ? invoicePageCapacities.last
              : invoicePageCapacities.middle
      assert.equal(page.offset, offset)
      assert.ok(page.items.length <= limit)
      if (count) assert.ok(page.items.length > 0)
      offset += page.items.length
    })
  }
})

test('smaller measured capacities produce additional sheets without losing rows', () => {
  const items = Array.from({ length: 50 }, (_, index) => index)
  const pages = invoicePages(items, { single: 8, first: 10, middle: 12, last: 9 })
  assert.deepEqual(
    pages.flatMap((page) => page.items),
    items,
  )
  assert.equal(pages.length, 5)
  assert.deepEqual(invoicePages([], { single: 1, first: 1, middle: 1, last: 1 }), [
    { items: [], offset: 0 },
  ])
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
  assert.equal(persianNumericDateLabel(persianToIso(1402, 7, 8)), '۱۴۰۲/۰۷/۰۸')
  assert.equal(persianNumericDateLabel('2026-10-26'), '۱۴۰۵/۰۸/۰۴')
  assert.equal(persianNumericDateLabel(persianToIso(1403, 12, 30)), '۱۴۰۳/۱۲/۳۰')
  assert.equal(persianToIso(1403, 12, 30), '2025-03-20')
  assert.equal(persianToIso(1404, 1, 1), '2025-03-21')
  assert.throws(() => persianToIso(1404, 12, 30))
  assert.deepEqual(persianParts('2026-10-26'), { year: 1405, month: 8, day: 4 })
  assert.equal(monthStart('2026-10-26'), '2026-10-23')
  assert.equal(addDays('2025-03-20', 1), '2025-03-21')
})
