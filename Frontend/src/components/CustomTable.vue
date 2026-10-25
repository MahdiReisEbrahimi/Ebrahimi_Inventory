<template>
  <section class="list-section" :aria-busy="loading">
    <div v-if="header || searchable || refreshable" class="table-toolbar">
      <strong v-if="header">{{ header }}</strong>
      <label v-if="searchable" class="search-field"
        ><Search :size="17" /><input
          v-model="searchValue"
          type="search"
          placeholder="جست‌وجو…"
          aria-label="جست‌وجوی جدول"
          @input="emits('search', searchValue)"
      /></label>
      <Button
        v-if="refreshable"
        variant="ghost"
        size="icon"
        aria-label="دریافت دوباره اطلاعات"
        :disabled="loading"
        @click="emits('refresh')"
        ><RefreshCw :size="16"
      /></Button>
    </div>
    <div v-if="loading" class="table-loading" role="status">در حال دریافت اطلاعات…</div>
    <EmptyState v-else-if="error" title="اطلاعات دریافت نشد" :description="error" error
      ><Button variant="outline" @click="emits('refresh')">تلاش دوباره</Button></EmptyState
    >
    <EmptyState
      v-else-if="!tableData?.length"
      title="موردی برای نمایش نیست"
      description="اگر فیلتری انتخاب کرده‌اید، آن را تغییر دهید یا یک مورد جدید ثبت کنید."
      ><slot name="empty"
    /></EmptyState>
    <div
      v-else
      class="table-scroll"
      :style="
        height ? { maxHeight: typeof height === 'number' ? height + 'px' : height } : undefined
      "
    >
      <table class="data-table responsive-table">
        <thead>
          <tr>
            <th class="index-column">ردیف</th>
            <th
              v-for="col in tableColumns"
              :key="col.prop"
              :style="{
                minWidth: typeof col.minWidth === 'number' ? col.minWidth + 'px' : col.minWidth,
              }"
            >
              {{ col.label }}
            </th>
            <th v-if="rowActions?.length">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in tableData" :key="String(row.id ?? row.sku ?? index)">
            <td class="index-column">{{ number(index + 1) }}</td>
            <td
              v-for="col in tableColumns"
              :key="col.prop"
              :data-label="col.label"
              :class="{ 'number-cell': col.type === 'price' }"
            >
              <slot :name="col.prop" :item="getCellValue(row, col.prop)" :row="row">{{
                col.formatter
                  ? col.formatter(getCellValue(row, col.prop), row)
                  : col.type === 'price'
                    ? number(Number(getCellValue(row, col.prop)))
                    : getCellValue(row, col.prop)
              }}</slot>
            </td>
            <td v-if="rowActions?.length" class="row-actions" data-label="عملیات">
              <button
                v-for="action in rowActions"
                :key="action.name"
                type="button"
                class="icon-button"
                :class="'icon-button--' + action.name"
                :aria-label="action.label || actionLabel(action.name)"
                :title="action.label || actionLabel(action.name)"
                @click="emits('actionClick', { actionName: action.name, row })"
              >
                <component
                  v-if="action.icon && typeof action.icon !== 'string'"
                  :is="action.icon"
                  :size="17"
                /><span v-else>{{ action.label || actionLabel(action.name) }}</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts" generic="Row extends { id?: string | number; sku?: string }">
import { ref, type Component } from 'vue'
import { RefreshCw, Search } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { number } from '@/lib/format'
export type TableColumn = {
  label: string
  prop: string
  minWidth?: string | number
  type?: 'price'
  formatter?: (value: unknown, row: object) => string
}
type RowAction = {
  name: string
  label?: string
  icon?: Component | string
  color?: string
  fillColor?: string
}
defineProps<{
  tableData?: Row[]
  tableColumns?: TableColumn[]
  height?: number | string
  searchable?: boolean
  refreshable?: boolean
  header?: string
  rowActions?: RowAction[]
  loading?: boolean
  error?: string
}>()
const emits = defineEmits<{
  actionClick: [payload: { actionName: string; row: Row }]
  search: [value: string]
  refresh: []
}>()
const searchValue = ref('')
const getCellValue = (row: Row, path: string) =>
  path
    .split('.')
    .reduce<unknown>(
      (value, key) =>
        typeof value === 'object' && value !== null
          ? (value as Record<string, unknown>)[key]
          : undefined,
      row,
    )
const actionLabel = (name: string) =>
  ({ view: 'مشاهده جزئیات', edit: 'ویرایش کالا', delete: 'حذف کالا' })[name] || name
</script>
<style scoped>
.table-toolbar {
  padding: 12px 20px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  border-bottom: 1px solid var(--border);
}
.index-column {
  width: 50px;
  color: var(--muted-foreground);
  font-size: 11px;
}
.row-actions {
  white-space: nowrap;
}
@media (max-width: 640px) {
  .responsive-table,
  .responsive-table tbody {
    display: block;
  }
  .responsive-table thead,
  .responsive-table .index-column {
    display: none;
  }
  .responsive-table tr {
    display: block;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .responsive-table td {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    border: 0;
    padding: 7px 0;
    text-align: end;
  }
  .responsive-table td::before {
    content: attr(data-label);
    color: var(--muted-foreground);
    font-size: 11px;
    text-align: start;
    flex-shrink: 0;
  }
  .responsive-table .row-actions {
    justify-content: flex-end;
    border-top: 1px dashed var(--border);
    margin-top: 8px;
    padding-top: 10px;
  }
  .responsive-table .row-actions::before {
    margin-inline-end: auto;
  }
}
</style>
