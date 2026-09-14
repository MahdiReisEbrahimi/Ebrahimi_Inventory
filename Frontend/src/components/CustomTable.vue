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
        :placeholder="'setting.search' + '...'"
        @input="(val) => emits('search', val)"
      />
      <div>
        <el-button
          v-if="refreshable"
          circle
          @click="emits('refresh')"
          :loading="loading"
          style="margin-left: 5px"
          class="table-actions"
        >
          <el-icon>
            <Refresh />
          </el-icon>
        </el-button>
      </div>
    </div>
    <el-divider />
    <el-table
      :data="tableData"
      :max-height="height || `calc(100vh - 420)`"
      :height="height || `calc(100vh - 420)`"
    >
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
          <slot
            :name="col.prop"
            :item="row[col.prop]"
            v-if="col.formatter == null && typeof row[col.prop] != 'number'"
          >
            <!-- fallback -->
            <span :style="detectLanguage(row[col.prop])">
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
        :label="'common.operation'"
        fixed="right"
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
import { computed, ref } from 'vue'
import type { a } from 'vue-router/dist/index-D7ja2BKs.js'

export type TableColumn = {
  label: string
  prop: string
  width?: string | number
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

function detectLanguage(text: string) {
  const persianRegex = /[\u0600-\u06FF]/
  return persianRegex.test(text) ? 'font-family: IranSans ;' : 'font-family: Arial ;'
}

function handleActionButtons(actionName: string, row: object) {
  emits('actionClick', { actionName: actionName, row: row })
}

function colorGetter(button: any) {
  switch (button.name) {
    case 'view':
      return '#355e9ad6'
    case 'edit':
      return '#368536'
    case 'delete':
      return '#ff0000b0'
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
