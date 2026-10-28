import test from 'node:test'
import assert from 'node:assert/strict'
import { invoiceEditKey, type InvoiceEdit } from '../src/lib/invoice.ts'

test('invoice edits track saved fields and returning to original values clears changes', () => {
  const original: InvoiceEdit = {
    customerId: 1,
    issueDate: '2026-10-28',
    discount: 0,
    settlement: 'CASH',
    notes: '',
    items: [{ productId: 1, quantity: 2, unitPrice: 100 }],
  }
  const baseline = invoiceEditKey(original)
  for (const change of [
    { customerId: 2 },
    { issueDate: '2026-10-27' },
    { discount: 1 },
    { settlement: 'INSTALLMENT' },
    { notes: 'توضیح جدید' },
    { items: [{ productId: 1, quantity: 3, unitPrice: 100 }] },
    { items: [{ productId: 1, quantity: 2, unitPrice: 101 }] },
    { items: [] },
  ]) {
    const draft = structuredClone(original)
    Object.assign(draft, change)
    assert.notEqual(invoiceEditKey(draft), baseline)
    Object.assign(draft, structuredClone(original))
    assert.equal(invoiceEditKey(draft), baseline)
  }
  assert.equal(
    invoiceEditKey({
      ...original,
      items: original.items.map((line) => ({ ...line, priceText: '۱۰۰' })),
    }),
    baseline,
  )
})
