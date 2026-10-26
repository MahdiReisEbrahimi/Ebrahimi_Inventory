import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { h } from 'vue'
import { renderToString } from 'vue/server-renderer'

test('table headers remain visible with empty data, loading and errors', async () => {
  const server = await createServer({
    configFile: false,
    plugins: [vue()],
    server: { middlewareMode: true, watch: null },
    resolve: { alias: { '@': fileURLToPath(new URL('../src', import.meta.url)) } },
  })
  try {
    const { default: Table } = await server.ssrLoadModule('/src/components/CustomTable.vue')
    const props = {
      tableColumns: [
        { prop: 'name', label: 'نام کالا' },
        { prop: 'stock', label: 'موجودی' },
      ],
      rowActions: [{ name: 'edit', label: 'ویرایش' }],
      tableData: [],
    }
    for (const state of [
      { loading: false, error: '', message: 'رکوردی وجود ندارد' },
      { loading: true, error: '', message: 'در حال دریافت اطلاعات' },
      { loading: false, error: 'خطای اتصال آزمایشی', message: 'خطای اتصال آزمایشی' },
    ]) {
      const html = await renderToString(
        h(Table, { ...props, loading: state.loading, error: state.error }),
      )
      assert.match(html, /<thead[^]*نام کالا[^]*موجودی[^]*عملیات[^]*<\/thead>/)
      assert.match(html, /colspan="4"/)
      assert.ok(html.includes(state.message))
      if (state.loading || state.error) assert.doesNotMatch(html, /رکوردی وجود ندارد/)
      if (state.error) assert.match(html, /تلاش دوباره/)
    }
    const populated = await renderToString(
      h(Table, { ...props, tableData: [{ id: 1, name: 'کالای نمونه', stock: 5 }] }),
    )
    assert.match(populated, /کالای نمونه/)
    assert.doesNotMatch(populated, /رکوردی وجود ندارد|table-state-cell/)
  } finally {
    await server.close()
  }
})
