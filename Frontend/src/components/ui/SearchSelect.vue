<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger
      class="search-select-trigger"
      role="combobox"
      :aria-label="label"
      :aria-expanded="open"
      :disabled="disabled"
    >
      <span :class="{ muted: !selected }">{{ selected?.label || placeholder || label }}</span
      ><ChevronsUpDown :size="16" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="search-select-popover"
        dir="rtl"
        :side-offset="6"
        :collision-padding="12"
        align="start"
        @close-auto-focus="emit('closeAutoFocus', $event)"
      >
        <label class="search-field"
          ><Search :size="16" /><input
            v-model="search"
            :aria-label="'جست‌وجوی ' + label"
            placeholder="جست‌وجو…"
            @keydown="navigate"
        /></label>
        <div class="search-select-options" role="listbox" :aria-label="label">
          <button
            v-for="(option, index) in filtered"
            :key="option.value"
            type="button"
            role="option"
            :aria-selected="option.value === modelValue"
            :disabled="option.disabled"
            :class="{ highlighted: index === highlighted }"
            @click="choose(option.value)"
          >
            <span
              >{{ option.label
              }}<small v-if="option.description">{{ option.description }}</small></span
            >
            <Check v-if="option.value === modelValue" :size="16" />
          </button>
          <p v-if="!filtered.length" class="muted">موردی پیدا نشد.</p>
        </div>
        <button v-if="createLabel" type="button" class="search-select-create" @click="createOption">
          <Plus :size="16" />{{ createLabel }}
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { Check, ChevronsUpDown, Plus, Search } from '@lucide/vue'
const props = defineProps<{
  modelValue?: number
  options: { value: number; label: string; description?: string; disabled?: boolean }[]
  label: string
  placeholder?: string
  createLabel?: string
  disabled?: boolean
}>()
const emit = defineEmits<{
  'update:modelValue': [value: number]
  create: []
  closeAutoFocus: [event: Event]
}>()
const open = ref(false)
const search = ref('')
const highlighted = ref(0)
const selected = computed(() => props.options.find((option) => option.value === props.modelValue))
const filtered = computed(() =>
  props.options.filter((option) =>
    `${option.label} ${option.description || ''}`
      .toLocaleLowerCase('fa')
      .includes(search.value.trim().toLocaleLowerCase('fa')),
  ),
)
watch(open, () => {
  search.value = ''
  highlighted.value = 0
})
watch(search, () => {
  highlighted.value = 0
})
function choose(value: number) {
  emit('update:modelValue', value)
  open.value = false
}
function createOption() {
  open.value = false
  emit('create')
}
function navigate(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    const direction = event.key === 'ArrowDown' ? 1 : -1
    for (let i = 0; i < filtered.value.length; i++) {
      highlighted.value =
        (highlighted.value + direction + filtered.value.length) % filtered.value.length
      if (!filtered.value[highlighted.value]?.disabled) break
    }
  }
  if (event.key === 'Enter') {
    event.preventDefault()
    const option = filtered.value[highlighted.value]
    if (option && !option.disabled) choose(option.value)
  }
}
</script>
<style>
.search-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 9px 12px 9px 16px;
  background: var(--card);
  color: var(--foreground);
  border: 1px solid var(--input);
  border-radius: 10px;
  text-align: start;
}
.search-select-trigger span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.search-select-popover {
  z-index: 101;
  width: max(300px, var(--reka-popover-trigger-width));
  max-width: calc(100vw - 24px);
  background: var(--popover);
  color: var(--foreground);
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
}
.search-select-options {
  max-height: 240px;
  overflow: auto;
  margin-top: 8px;
}
.search-select-options button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  text-align: start;
  background: transparent;
  border: 0;
  border-radius: 7px;
  padding: 10px;
}
.search-select-options button:hover,
.search-select-options .highlighted {
  background: var(--muted);
}
.search-select-options small {
  display: block;
  color: var(--muted-foreground);
  font-size: 11px;
}
.search-select-create {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 8px 4px;
  border: 0;
  border-top: 1px solid var(--border);
  margin-top: 8px;
  background: transparent;
  color: var(--primary);
}
</style>
