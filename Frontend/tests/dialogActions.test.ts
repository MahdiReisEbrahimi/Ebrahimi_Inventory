import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire, stripTypeScriptTypes } from 'node:module'
import { pathToFileURL } from 'node:url'
import { compileScript, parse } from '@vue/compiler-sfc'
import { createRenderer, h, nextTick, ref, shallowRef } from 'vue'
import { dialogFooterKey } from '../src/lib/dialog.ts'

const source = await readFile(
  new URL('../src/components/ui/DialogActions.vue', import.meta.url),
  'utf8',
)
const script = compileScript(parse(source).descriptor, {
  id: 'dialog-actions-test',
  inlineTemplate: true,
})
const require = createRequire(import.meta.url)
const code = script.content
  .replace(
    /from (['"])vue\1/g,
    `from ${JSON.stringify(pathToFileURL(require.resolve('vue')).href)}`,
  )
  .replace("'@/lib/dialog'", JSON.stringify(new URL('../src/lib/dialog.ts', import.meta.url).href))
const { default: DialogActions } = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(code)).toString('base64')}`
)

type Element = {
  tag?: string
  text?: string
  props: Record<string, unknown>
  children: Element[]
  parent: Element | null
}
const node = (tag?: string, text?: string): Element => ({
  tag,
  text,
  props: {},
  children: [],
  parent: null,
})
const renderer = createRenderer<Element, Element>({
  createElement: (tag) => node(tag),
  createText: (text) => node(undefined, text),
  createComment: (text) => node(undefined, text),
  insert: (child, parent, anchor) => {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
    const index = anchor ? parent.children.indexOf(anchor) : -1
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
    child.parent = parent
  },
  remove: (child) => {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
    child.parent = null
  },
  setText: (child, text) => {
    child.text = text
  },
  setElementText: (child, text) => {
    child.text = text
  },
  parentNode: (child) => child.parent,
  nextSibling: (child) => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
  patchProp: (child, key, _previous, value) => {
    child.props[key] = value
  },
})
const elements = (root: Element, tag: string): Element[] => [
  ...(root.tag === tag ? [root] : []),
  ...root.children.flatMap((child) => elements(child, tag)),
]

test('dialog actions leave the scrolling body and retain form ownership and reactive behavior', async () => {
  const root = node('root')
  const footer = node('footer')
  const target = shallowRef<HTMLElement | null>(null)
  const visible = ref(true)
  const saving = ref(false)
  let clicks = 0
  const app = renderer.createApp({
    render: () =>
      h('form', { id: 'dialog-form' }, [
        h('input', { required: true }),
        visible.value
          ? h(DialogActions, null, {
              default: () =>
                h(
                  'button',
                  {
                    type: 'submit',
                    form: 'dialog-form',
                    disabled: saving.value,
                    onClick: () => {
                      clicks++
                    },
                  },
                  'ثبت',
                ),
            })
          : null,
      ]),
  })
  app.provide(dialogFooterKey, target)
  app.mount(root)
  try {
    assert.equal(elements(root, 'button').length, 1)
    // The footer becomes available after the dialog's template ref is mounted.
    target.value = footer as unknown as HTMLElement
    await nextTick()
    assert.equal(elements(root, 'button').length, 0)
    assert.equal(elements(root, 'input').length, 1)
    const button = elements(footer, 'button')[0]!
    assert.equal(button.props.form, 'dialog-form')
    assert.equal(button.props.type, 'submit')
    ;(button.props.onClick as () => void)()
    assert.equal(clicks, 1)
    saving.value = true
    await nextTick()
    assert.equal(button.props.disabled, true)
    visible.value = false
    await nextTick()
    assert.equal(elements(footer, 'button').length, 0)
    visible.value = true
    await nextTick()
    assert.equal(elements(footer, 'button').length, 1)
  } finally {
    app.unmount()
  }
  assert.equal(elements(footer, 'button').length, 0)
})

test('actions stay inside standalone forms without a dialog footer', () => {
  const root = node('root')
  const app = renderer.createApp({
    render: () => h('form', [h(DialogActions, null, { default: () => h('button', 'ثبت') })]),
  })
  app.mount(root)
  try {
    assert.equal(elements(root, 'form').length, 1)
    assert.equal(elements(root, 'button').length, 1)
  } finally {
    app.unmount()
  }
})
