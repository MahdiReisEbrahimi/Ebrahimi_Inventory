<template>
  <input
    type="text"
    inputmode="numeric"
    :value="formatMoneyInput(modelValue)"
    @input="onInput"
    @change="onInput"
    @compositionend="onInput"
  />
</template>

<script setup lang="ts">
import { nextTick } from 'vue'
import { editMoneyInput, formatMoneyInput, isMoneyInputValue } from '@/lib/moneyInput'

const props = defineProps<{ modelValue: string | number }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
let editVersion = 0

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const inputEvent = event as InputEvent
  // Numeric keyboard composition should format immediately, including inside dialogs.
  if (inputEvent.isComposing && !isMoneyInputValue(input.value)) return
  const version = ++editVersion
  const result = editMoneyInput(
    input.value,
    input.selectionStart ?? input.value.length,
    formatMoneyInput(props.modelValue),
    inputEvent.inputType || '',
  )
  input.value = result.value
  input.setSelectionRange(result.cursor, result.cursor)
  emit('update:modelValue', result.value)
  void nextTick(() => {
    if (version === editVersion && document.activeElement === input)
      input.setSelectionRange(result.cursor, result.cursor)
  })
}
</script>
