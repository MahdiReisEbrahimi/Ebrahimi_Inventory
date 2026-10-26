import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import { pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, ref } from 'vue'
import { parseNumber } from '../src/lib/format.ts'

test('the rendered price field formats each keystroke, including keyboard composition inside forms', async () => {
  const source = await readFile(
    new URL('../src/components/ui/MoneyInput.vue', import.meta.url),
    'utf8',
  )
  const script = compileScript(parse(source).descriptor, {
    id: 'money-input-test',
    inlineTemplate: true,
  })
  const require = createRequire(import.meta.url)
  const code = script.content
    .replace(
      /from (['"])vue\1/g,
      `from ${JSON.stringify(pathToFileURL(require.resolve('vue')).href)}`,
    )
    .replace(
      "'@/lib/moneyInput'",
      JSON.stringify(new URL('../src/lib/moneyInput.ts', import.meta.url).href),
    )
  const compiled = stripTypeScriptTypes(code)
  const { default: MoneyInput } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  )

  const renderer = createRenderer<any, any>({
    createElement: (tag) => ({
      tag,
      props: {},
      children: [],
      value: '',
      selectionStart: 0,
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
  const amount = ref('')
  const root = { children: [] as any[] }
  const app = renderer.createApp({
    render: () =>
      h('form', [
        h(MoneyInput, {
          modelValue: amount.value,
          'onUpdate:modelValue': (value: string) => {
            amount.value = value
          },
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
    for (const isComposing of [false, true]) {
      amount.value = ''
      await nextTick()
      for (const digit of '1234567') {
        input.value += digit
        input.selectionStart = input.value.length
        input.props.onInput({ target: input, isComposing, inputType: 'insertText' })
        assert.equal(
          input.value,
          amount.value,
          'the visible value updates before blur or compositionend',
        )
        if (parseNumber(amount.value) >= 1000) assert.match(input.value, /٬/)
        await nextTick()
        assert.equal(input.selectionStart, input.value.length)
      }
      assert.equal(input.value, '۱٬۲۳۴٬۵۶۷')
      assert.equal(parseNumber(amount.value), 1234567)
    }
    input.value = ''
    input.selectionStart = 0
    input.props.onInput({ target: input, inputType: 'deleteContentBackward' })
    await nextTick()
    assert.equal(input.value, '')
    assert.equal(amount.value, '')
  } finally {
    app.unmount()
    if (previousDocument) Object.defineProperty(globalThis, 'document', previousDocument)
    else Reflect.deleteProperty(globalThis, 'document')
  }
})
