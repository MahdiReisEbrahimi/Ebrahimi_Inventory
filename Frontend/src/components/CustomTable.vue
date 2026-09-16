<template>
  <div class="list-section">
    <div v-if="props.header">
      <div>
        <span>{{ props.header }}</span>
      </div>
      <el-divider />
    </div>

    <div class="users-navbar">
      <el-input
        v-if="props.searchable"
        class="search-input"
        v-model="searchValue"
        :placeholder="'جستجو' + '...'"
        @input="(val) => emits('search', val)"
      />
      <div>
        <el-button
          v-if="refreshable"
          circle
          @click="emits('refresh')"
          :loading="false"
          style="margin-left: 5px"
          class="table-actions"
        >
          <el-icon>
            <Refresh />
          </el-icon>
        </el-button>
      </div>
    </div>
    <el-table
      :data="tableData"
      :max-height="height || `calc(100vh - 420)`"
      :height="height || `calc(100vh - 420)`"
      :header-cell-style="{ background: '#f5f7fa', height: '60px' }"
      stripe
      border
      align="center"
    >
      <el-table-column type="index" width="55" align="center" label="ردیف" />

      <el-table-column
        v-for="(col, index) in tableColumns"
        :key="index"
        :prop="col.prop"
        :label="col.label"
        :min-width="col.label.length * 8 + 60"
        :align="`center`"
      >
        <template #header>
          <span style="text-transform: capitalize">{{ col.label }}</span>
        </template>
        <template #default="{ row }">
          <slot :name="col.prop" :item="row[col.prop]">
            <span v-if="col.type === 'price'">
              {{ handlePriceInput(String(row[col.prop])) }}
            </span>
            <span v-else>
              {{ row[col.prop] }}
            </span>
          </slot>
        </template>
      </el-table-column>
      <slot name="custom" />
      <slot name="operation" />

      <!-- Actions Column -->
      <el-table-column
        v-if="rowActions"
        :prop="'Actions'"
        :label="'عملیات'"
        :min-width="Math.max(rowActions.length * 50, 170)"
        align="center"
      >
        <template #default="scope">
          <el-tooltip
            v-for="button of props.rowActions"
            :key="button"
            trigger="hover"
            :content="`tableOperations`"
          >
            <el-button
              :color="colorGetter(button)"
              circle
              @click="handleActionButtons(button.name, scope.row)"
              style="margin: 0px 2px; width: 32px; height: 32px"
            >
              <el-icon :color="button.fillColor || '#fff'">
                <span v-if="iconType(button.icon) === 'string'" v-html="button.icon"> </span>
                <component v-else :is="button.icon" />
              </el-icon>
            </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { handlePriceInput } from '@/utils/general'
import { computed, ref } from 'vue'

export type TableColumn = {
  label: string
  prop: string
  minWidth?: string | number
  type?: 'price'
  formatter?: Function
}

const searchValue = ref<string>('')

const iconType = computed(() => (icon) => {
  return typeof icon
})

const props = defineProps({
  tableData: Array,
  tableColumns: Array<TableColumn>,
  height: [Number, String],
  options: Object,
  hasTopModalButtons: {
    type: Boolean,
    required: false,
    default: true,
  },
  rowActions: {
    type: Object,
    required: false,
  },
  searchable: { type: Boolean, default: true },
  refreshable: { type: Boolean, default: false },
  exportColumns: { type: Object, required: false },
  header: { type: String, required: false },
})
const emits = defineEmits(['actionClick', 'search', 'refresh'])

function handleActionButtons(actionName: string, row: object) {
  emits('actionClick', { actionName: actionName, row: row })
}

function colorGetter(button: any) {
  switch (button.name) {
    case 'view':
      return '#64748b'
    case 'edit':
      return '#11813b'
    case 'delete':
      return '#dc2626'
  }
  if (button.color) return button.color
  return '#355e9ad6'
}
</script>
<style scoped>
.users-navbar {
  display: flex;
  justify-content: space-between;
}
</style>
