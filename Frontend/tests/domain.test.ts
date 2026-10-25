import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseNumber, money } from '../src/lib/format.ts'
import { validateInvoiceLines } from '../src/lib/invoice.ts'
import { initializeTheme, useTheme } from '../src/composables/useTheme.ts'

test('prices accept Persian, Arabic, and Latin digits with group separators', () => {
  for (const value of ['۱۲۳٬۴۵۶', '١٢٣٬٤٥٦', '123,456', ' 123 456 ']) {
    assert.equal(parseNumber(value), 123456)
  }
  assert.equal(parseNumber('۰'), 0)
  assert.equal(parseNumber(24000), 24000)
})

test('missing and invalid prices stay invalid instead of becoming free items', () => {
  for (const value of ['', ' ', 'نامعتبر', '12x']) {
    assert.ok(Number.isNaN(parseNumber(value)))
  }
  assert.equal(money(Number.NaN), '—')
  assert.equal(money(null), '—')
})

const line = { productId: 1, quantity: 2, unitPrice: 150000 }
const stock = () => 5

test('invoice accepts valid quantities, available stock, and explicit zero prices', () => {
  assert.equal(validateInvoiceLines([line], stock), '')
  assert.equal(validateInvoiceLines([{ ...line, unitPrice: 0 }], stock), '')
  assert.equal(validateInvoiceLines([{ ...line, quantity: 5 }], stock), '')
})

test('invoice rejects empty drafts, missing products, fractions, and overselling', () => {
  assert.notEqual(validateInvoiceLines([], stock), '')
  for (const quantity of [0, -1, 1.5, 6, Number.NaN]) {
    assert.notEqual(validateInvoiceLines([{ ...line, quantity }], stock), '')
  }
  assert.notEqual(
    validateInvoiceLines([line], () => 0),
    '',
  )
  assert.notEqual(validateInvoiceLines([{ ...line, productId: -1 }], stock), '')
})

test('duplicate rows cannot jointly exceed available stock', () => {
  assert.notEqual(validateInvoiceLines([line, { ...line, quantity: 4 }], stock), '')
  assert.equal(validateInvoiceLines([line, { ...line, quantity: 3 }], stock), '')
})

test('invoice rejects invalid prices and totals that cannot fit database integers', () => {
  for (const unitPrice of [-1, 1.5, Number.NaN, Infinity]) {
    assert.notEqual(validateInvoiceLines([{ ...line, unitPrice }], stock), '')
  }
  assert.notEqual(validateInvoiceLines([{ ...line, unitPrice: 1_500_000_000 }], stock), '')
  assert.notEqual(
    validateInvoiceLines(
      [
        { productId: 1, quantity: 1, unitPrice: 1_500_000_000 },
        { productId: 2, quantity: 1, unitPrice: 1_500_000_000 },
      ],
      stock,
    ),
    '',
  )
})

function withThemeEnvironment(
  saved: string | null,
  systemDark: boolean,
  storageFails: boolean,
  run: (state: { darkClass: boolean; stored: string | null }) => void,
) {
  const state = { darkClass: false, stored: saved }
  const replacements = {
    document: {
      documentElement: {
        classList: {
          toggle(_name: string, value: boolean) {
            state.darkClass = value
          },
        },
      },
    },
    window: {
      matchMedia() {
        return { matches: systemDark }
      },
    },
    localStorage: {
      getItem() {
        if (storageFails) throw new Error('Storage unavailable')
        return state.stored
      },
      setItem(_key: string, value: string) {
        if (storageFails) throw new Error('Storage unavailable')
        state.stored = value
      },
    },
  }
  const previous = new Map<string, PropertyDescriptor | undefined>()
  for (const [key, value] of Object.entries(replacements)) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    Object.defineProperty(globalThis, key, { value, configurable: true })
  }
  try {
    run(state)
  } finally {
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
}

test('saved theme overrides system preference and toggles persistently', () => {
  withThemeEnvironment('light', true, false, (state) => {
    initializeTheme()
    const theme = useTheme()
    assert.equal(theme.isDark.value, false)
    assert.equal(state.darkClass, false)
    theme.toggleTheme()
    assert.equal(theme.isDark.value, true)
    assert.equal(state.darkClass, true)
    assert.equal(state.stored, 'dark')
  })
  withThemeEnvironment('dark', false, false, (state) => {
    initializeTheme()
    assert.equal(state.darkClass, true)
  })
})

test('theme uses system preference on first visit and works when storage is blocked', () => {
  withThemeEnvironment(null, true, false, (state) => {
    initializeTheme()
    assert.equal(state.darkClass, true)
  })
  withThemeEnvironment(null, false, true, (state) => {
    assert.doesNotThrow(initializeTheme)
    assert.equal(state.darkClass, false)
    assert.doesNotThrow(() => useTheme().toggleTheme())
    assert.equal(state.darkClass, true)
  })
})
