import test from 'node:test'
import assert from 'node:assert/strict'
import { editMoneyInput, formatMoneyInput } from '../src/lib/moneyInput.ts'
import { money, number, parseNumber } from '../src/lib/format.ts'
import { rial } from '../src/lib/invoicePresentation.ts'

test('money display and inputs group Persian, Arabic and Latin amounts every three digits', () => {
  for (const value of ['1234567', '۱۲۳۴۵۶۷', '١٢٣٤٥٦٧', '1,234,567', '۱٬۲۳۴٬۵۶۷']) {
    assert.equal(formatMoneyInput(value), '۱٬۲۳۴٬۵۶۷')
    assert.equal(parseNumber(formatMoneyInput(value)), 1234567)
  }
  assert.equal(number(1234567), '۱٬۲۳۴٬۵۶۷')
  assert.equal(money(1234567), '۱٬۲۳۴٬۵۶۷ تومان')
  assert.equal(rial(1234567), '۱٬۲۳۴٬۵۶۷ ریال')
})

test('typing, pasting, replacing and deleting amounts preserve the caret', () => {
  assert.deepEqual(editMoneyInput('۹۹۹9', 4, '۹۹۹', 'insertText'), {
    value: '۹٬۹۹۹',
    cursor: 5,
  })
  assert.deepEqual(editMoneyInput('1234567', 7, '', 'insertFromPaste'), {
    value: '۱٬۲۳۴٬۵۶۷',
    cursor: 9,
  })
  assert.deepEqual(editMoneyInput('۱۲٬۳9۴', 5, '۱۲٬۳۴', 'insertText'), {
    value: '۱۲٬۳۹۴',
    cursor: 5,
  })
  assert.deepEqual(editMoneyInput('۹۵۶۷', 1, '۱٬۲۳۴٬۵۶۷', 'insertText'), {
    value: '۹٬۵۶۷',
    cursor: 1,
  })
  assert.deepEqual(editMoneyInput('۱٬۲۳', 4, '۱٬۲۳۴', 'deleteContentBackward'), {
    value: '۱۲۳',
    cursor: 3,
  })
  assert.deepEqual(editMoneyInput('۱۲۳۴', 1, '۱٬۲۳۴', 'deleteContentBackward'), {
    value: '۲۳۴',
    cursor: 0,
  })
  assert.deepEqual(editMoneyInput('۱۲۳۴', 1, '۱٬۲۳۴', 'deleteContentForward'), {
    value: '۱۳۴',
    cursor: 1,
  })
})

test('clearing stays empty and formatting does not round or silently repair invalid amounts', () => {
  assert.deepEqual(editMoneyInput('', 0, '۱٬۰۰۰', 'deleteContentBackward'), {
    value: '',
    cursor: 0,
  })
  assert.equal(formatMoneyInput(''), '')
  assert.equal(formatMoneyInput(0), '۰')
  assert.equal(formatMoneyInput('012500000'), '۱۲٬۵۰۰٬۰۰۰')
  assert.deepEqual(editMoneyInput('۰1', 2, '۰', 'insertText'), { value: '۱', cursor: 1 })
  assert.equal(formatMoneyInput('9007199254740993'), '۹٬۰۰۷٬۱۹۹٬۲۵۴٬۷۴۰٬۹۹۳')
  assert.equal(formatMoneyInput('-1234.50'), '-۱٬۲۳۴.۵۰')
  assert.equal(formatMoneyInput('۱۲۳۴٫۵۰'), '۱٬۲۳۴.۵۰')
  assert.equal(parseNumber('۱٬۲۳۴٫۵۰'), 1234.5)
  assert.equal(formatMoneyInput('100abc'), '100abc')
  assert.ok(Number.isNaN(parseNumber(formatMoneyInput('100abc'))))
})
