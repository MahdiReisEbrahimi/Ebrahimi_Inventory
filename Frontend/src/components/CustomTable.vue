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
    <div
      class="table-scroll"
      :class="{ 'table-scroll--empty': loading || error || !tableData?.length }"
      tabindex="0"
      role="region"
      :aria-label="header || 'فهرست کالاها'"
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
            <th v-if="rowActions?.length" class="action-column">عملیات</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading || error || !tableData?.length" class="table-state-row">
            <td
              :colspan="(tableColumns?.length || 0) + 1 + (rowActions?.length ? 1 : 0)"
              class="table-state-cell"
            >
              <div class="table-state-content">
                <div v-if="loading" class="table-loading" role="status">در حال دریافت اطلاعات…</div>
                <EmptyState v-else-if="error" title="اطلاعات دریافت نشد" :description="error" error>
                  <Button variant="outline" @click="emits('refresh')">تلاش دوباره</Button>
                </EmptyState>
                <EmptyState
                  v-else
                  title="رکوردی وجود ندارد"
                  description="فیلترها را تغییر دهید یا یک مورد جدید ثبت کنید."
                  ><slot name="empty"
                /></EmptyState>
              </div>
            </td>
          </tr>
          <template v-else>
            <tr v-for="(row, index) in tableData" :key="String(row.id ?? index)">
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
              <td v-if="rowActions?.length" class="row-actions action-column" data-label="عملیات">
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
          </template>
        </tbody>
      </table>
    </div>
  </section>
</template>
<script setup lang="ts" generic="Row extends { id?: string | number }">
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
.list-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.list-section > .table-scroll {
  flex: 1;
  min-height: 0;
  max-height: none;
}

.table-toolbar {
  padding: 12px 20px;
  display: flex;
  flex-wrap: wrap;
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
.data-table thead .index-column {
  color: var(--table-header-foreground);
}
.row-actions {
  white-space: nowrap;
}
.responsive-table {
  min-width: 760px;
  border-collapse: separate;
  border-spacing: 0;
}
.action-column {
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 154px;
  background: var(--card);
  box-shadow: 4px 0 10px color-mix(in srgb, var(--foreground) 8%, transparent);
}
.data-table thead .action-column {
  z-index: 4;
  background: var(--table-header-background);
}
.data-table tbody tr:hover .action-column {
  background: var(--table-row-hover);
}
@media (max-width: 640px) {
  .responsive-table {
    min-width: 720px;
  }
  .responsive-table .action-column {
    min-width: 142px;
  }
}
</style>
