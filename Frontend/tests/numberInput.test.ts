import test from 'node:test'
import assert from 'node:assert/strict'
import { numberInputError, stripNumberInputLeadingZeros } from '../src/lib/numberInput.ts'
import { parseNumber, toPersianDigits } from '../src/lib/format.ts'

test('numeric fields remove leading zeros without changing decimals, zero or invalid text', () => {
  for (const [input, expected] of [
    ['0155', '155'],
    ['012', '12'],
    ['000', '0'],
    ['۰۱۵۵', '۱۵۵'],
    ['٠١٢', '١٢'],
    ['0۰٠12', '12'],
    ['-0012', '-12'],
    ['00.12', '0.12'],
    ['۰۰٫۱۲', '۰٫۱۲'],
    ['0.12', '0.12'],
    ['0', '0'],
    ['', ''],
    ['-', '-'],
    ['0.', '0.'],
    ['012x', '012x'],
    ['0x10', '0x10'],
  ])
    assert.equal(stripNumberInputLeadingZeros(input!), expected)
})

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

test('digit localization preserves text, separators and partial numeric edits', () => {
  assert.equal(toPersianDigits('12٣۴٫5'), '۱۲۳۴٫۵')
  assert.equal(toPersianDigits('-1.'), '-۱.')
  assert.equal(toPersianDigits('کالا A12، 3٬456 ریال'), 'کالا A۱۲، ۳٬۴۵۶ ریال')
  assert.equal(toPersianDigits(''), '')
})
