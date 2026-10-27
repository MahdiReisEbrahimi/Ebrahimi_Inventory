import test from 'node:test'
import assert from 'node:assert/strict'
import { numberInputError } from '../src/lib/numberInput.ts'
import { parseNumber } from '../src/lib/format.ts'

test('localized numbers preserve quantities, decimals and validation constraints', () => {
  for (const text of ['۱۲۳', '١٢٣', '123', '۱٢3']) {
    assert.equal(parseNumber(text), 123)
    assert.equal(numberInputError(text, { min: 0, max: 200 }), '')
  }
  for (const text of ['۱۰٫۵', '١٠.٥', '10.5']) {
    assert.equal(parseNumber(text), 10.5)
    assert.equal(numberInputError(text, { min: 0, step: 0.1 }), '')
    assert.notEqual(numberInputError(text, { step: 1 }), '')
  }
  assert.equal(numberInputError('۰', { min: 0 }), '')
  assert.notEqual(numberInputError('۰', { min: 1 }), '')
  assert.notEqual(numberInputError('۲۱', { max: 20 }), '')
  assert.notEqual(numberInputError('۱۰٫۵۵', { step: 0.1 }), '')
  assert.equal(numberInputError('۱۰٫۵۵', { step: 'any' }), '')
  assert.equal(numberInputError('', { min: 1 }), '')
  for (const text of ['-', '.', 'عدد', '0x10', '1e3']) {
    assert.notEqual(numberInputError(text, {}), '')
  }
})
