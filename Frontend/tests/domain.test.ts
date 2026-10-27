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

test('invoice rejects invalid prices and totals above 100 billion rials', () => {
  for (const unitPrice of [-1, 1.5, Number.NaN, Infinity]) {
    assert.notEqual(validateInvoiceLines([{ ...line, unitPrice }], stock), '')
  }
  assert.notEqual(validateInvoiceLines([{ ...line, unitPrice: 50_000_000_001 }], stock), '')
  assert.notEqual(
    validateInvoiceLines(
      [
        { productId: 1, quantity: 1, unitPrice: 50_000_000_001 },
        { productId: 2, quantity: 1, unitPrice: 50_000_000_001 },
      ],
      stock,
    ),
    '',
  )
})

test('invoice cap includes exactly 100 billion rials across one or multiple rows', () => {
  const stock = () => 100
  const largeLine = { productId: 1, quantity: 50, unitPrice: 2_000_000_000 }
  assert.equal(validateInvoiceLines([largeLine], stock), '')
  assert.equal(
    validateInvoiceLines([{ ...largeLine, quantity: 1, unitPrice: 100_000_000_000 }], stock),
    '',
  )
  assert.equal(
    validateInvoiceLines(
      [
        { ...largeLine, quantity: 25 },
        { ...largeLine, productId: 2, quantity: 25 },
      ],
      stock,
    ),
    '',
  )
  assert.notEqual(
    validateInvoiceLines([largeLine, { productId: 2, quantity: 1, unitPrice: 1 }], stock),
    '',
  )
  assert.notEqual(validateInvoiceLines([{ ...largeLine, quantity: 51 }], stock), '')
})

function withThemeEnvironment(
  saved: string | null,
  systemDark: boolean,
  storageFails: boolean,
  run: (state: {
    darkClass: boolean
    stored: string | null
    savedPreferences: string | null
    tokens: Map<string, string>
    dataset: Record<string, string>
    changeSystemTheme: (dark: boolean) => void
  }) => void,
  savedPreferences: string | null = null,
) {
  let onChange: (() => void) | undefined
  const media = {
    matches: systemDark,
    addEventListener(_event: string, listener: () => void) {
      onChange = listener
    },
    removeEventListener() {
      onChange = undefined
    },
  }
  const state = {
    darkClass: false,
    stored: saved,
    savedPreferences,
    tokens: new Map<string, string>(),
    dataset: {} as Record<string, string>,
    changeSystemTheme(value: boolean) {
      media.matches = value
      onChange?.()
    },
  }
  const replacements = {
    document: {
      documentElement: {
        dataset: state.dataset,
        style: {
          setProperty(key: string, value: string) {
            state.tokens.set(key, value)
          },
          removeProperty(key: string) {
            state.tokens.delete(key)
          },
        },
        classList: {
          toggle(_name: string, value: boolean) {
            state.darkClass = value
          },
        },
      },
    },
    window: {
      matchMedia() {
        return media
      },
    },
    localStorage: {
      getItem(key: string) {
        if (storageFails) throw new Error('Storage unavailable')
        return key === 'theme' ? state.stored : state.savedPreferences
      },
      setItem(key: string, value: string) {
        if (storageFails) throw new Error('Storage unavailable')
        if (key === 'theme') state.stored = value
        else state.savedPreferences = value
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

test('custom colors and display preferences survive reload and reset clears overrides', () => {
  withThemeEnvironment(null, false, false, (state) => {
    initializeTheme()
    const theme = useTheme()
    theme.updatePreferences({
      primaryColor: '#ffffff',
      sidebarColor: '#2563eb',
      density: 'compact',
      corners: 'subtle',
      reduceMotion: true,
    })
    assert.equal(state.tokens.get('--primary'), '#ffffff')
    assert.equal(state.tokens.get('--primary-foreground'), '#000000')
    assert.equal(state.dataset.density, 'compact')
    assert.equal(state.dataset.corners, 'subtle')
    assert.equal(state.dataset.reduceMotion, 'true')
    initializeTheme()
    assert.equal(theme.preferences.value.primaryColor, '#ffffff')
    assert.equal(theme.preferences.value.density, 'compact')
    theme.updatePreferences({ primaryColor: '#000000' })
    assert.equal(state.tokens.get('--primary-foreground'), '#ffffff')
    theme.resetPreferences()
    assert.equal(theme.themeMode.value, 'system')
    assert.equal(state.tokens.has('--primary'), false)
    assert.equal(state.tokens.has('--sidebar'), false)
    assert.equal(state.dataset.density, 'comfortable')
    assert.equal(state.dataset.reduceMotion, 'false')
    initializeTheme()
    assert.equal(theme.preferences.value.primaryColor, null)
  })
})

test('system mode follows device changes while explicit choice remains fixed', () => {
  withThemeEnvironment(null, false, false, (state) => {
    initializeTheme()
    const theme = useTheme()
    state.changeSystemTheme(true)
    assert.equal(theme.isDark.value, true)
    theme.setTheme('light')
    state.changeSystemTheme(true)
    assert.equal(theme.isDark.value, false)
    theme.setTheme('system')
    assert.equal(theme.isDark.value, true)
  })
})

test('malformed or invalid stored UI preferences fall back safely', () => {
  for (const saved of [
    '{broken',
    'null',
    '[]',
    '{"primaryColor":"red; color: white", "density":"invalid", "reduceMotion":"true"}',
  ]) {
    withThemeEnvironment(
      'light',
      false,
      false,
      (state) => {
        assert.doesNotThrow(initializeTheme)
        assert.equal(useTheme().preferences.value.primaryColor, null)
        assert.equal(state.dataset.density, 'comfortable')
        assert.equal(state.dataset.reduceMotion, 'false')
        useTheme().updatePreferences({ primaryColor: 'invalid' })
        assert.equal(state.tokens.has('--primary'), false)
      },
      saved,
    )
  }
})
