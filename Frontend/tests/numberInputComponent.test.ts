import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import { pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'

test('numeric fields accept localized typing, paste and composition with numeric models', async () => {
  const source = await readFile(
    new URL('../src/components/ui/NumberInput.vue', import.meta.url),
    'utf8',
  )
  const script = compileScript(parse(source).descriptor, {
    id: 'number-input-test',
    inlineTemplate: true,
  })
  const require = createRequire(import.meta.url)
  const code = script.content
    .replace(
      /from (['"])vue\1/g,
      `from ${JSON.stringify(pathToFileURL(require.resolve('vue')).href)}`,
    )
    .replace(
      "'@/lib/format'",
      JSON.stringify(new URL('../src/lib/format.ts', import.meta.url).href),
    )
    .replace(
      "'@/lib/numberInput'",
      JSON.stringify(new URL('../src/lib/numberInput.ts', import.meta.url).href),
    )
  const compiled = stripTypeScriptTypes(code)
  const { default: NumberInput } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  )

  const renderer = createRenderer<any, any>({
    createElement: (tag) => ({
      tag,
      props: {},
      children: [],
      value: '',
      selectionStart: 0,
      setCustomValidity(message: string) {
        this.validityMessage = message
      },
      setSelectionRange(start: number, end: number) {
        this.selectionStart = start
        this.selectionEnd = end
      },
    }),
    createText: (text) => ({ text }),
    createComment: (text) => ({ text }),
    insert: (node, parent) => {
      parent.children.push(node)
      node.parent = parent
    },
    remove: () => {},
    setText: (node, text) => {
      node.text = text
    },
    setElementText: (node, text) => {
      node.text = text
    },
    parentNode: (node) => node.parent,
    nextSibling: () => null,
    patchProp: (node, key, _previous, value) => {
      node.props[key] = value
      if (key === 'value') node.value = value
    },
  })
  const amount = ref(1)
  const max = ref(10000000)
  const root = { children: [] as any[] }
  const app = renderer.createApp({
    render: () =>
      h('form', [
        h(NumberInput, {
          modelValue: amount.value,
          'onUpdate:modelValue': (value: number) => {
            amount.value = value
          },
          min: 1,
          max: max.value,
          required: true,
          dir: 'ltr',
        }),
      ]),
  })
  app.mount(root)
  const input = root.children[0].children[0]
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { activeElement: input },
  })
  try {
    assert.equal(input.props.type, 'text')
    assert.equal(input.props.required, true)
    assert.equal(input.props.inputmode, 'numeric')
    for (const digits of ['۱۲۳۴', '١٢٣٤', '1234']) {
      for (const isComposing of [false, true]) {
        input.value = ''
        for (const digit of digits) {
          input.value += digit
          input.props.onInput({ target: input, isComposing, inputType: 'insertText' })
          await nextTick()
        }
        assert.equal(amount.value, 1234)
        assert.equal(input.value, digits)
        assert.equal(input.validityMessage, '')
      }
    }
    for (const [text, expected] of [
      ['۲٬۳۴۵', 2345],
      ['٢٣', 23],
      ['42', 42],
    ] as const) {
      input.value = text
      input.props.onInput({ target: input, inputType: 'insertFromPaste' })
      await nextTick()
      assert.equal(amount.value, expected)
    }
    for (const text of ['۰', '-۱', '۱٫۵', 'abc', '0x10', '۱۰۰۰۰۰۰۱']) {
      input.value = text
      input.props.onInput({ target: input })
      await nextTick()
      assert.notEqual(input.validityMessage, '', text)
      if (text === 'abc' || text === '0x10') assert.ok(Number.isNaN(amount.value))
    }
    input.value = ''
    input.props.onInput({ target: input })
    await nextTick()
    assert.equal(input.value, '')
    assert.ok(Number.isNaN(amount.value))
    amount.value = 15
    await nextTick()
    assert.equal(input.value, '15')
    assert.equal(input.validityMessage, '')
    max.value = 10
    await nextTick()
    assert.notEqual(input.validityMessage, '')
  } finally {
    app.unmount()
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
