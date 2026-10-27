<template>
  <input
    ref="input"
    type="text"
    :inputmode="step === 'any' || !Number.isInteger(Number(step)) ? 'decimal' : 'numeric'"
    :value="text"
    @input="onInput"
    @change="onInput"
    @compositionend="onInput"
  />
</template>

<script setup lang="ts">
import { ref, watch, watchEffect } from 'vue'
import { numberInputError, parseNumberInput } from '@/lib/numberInput'

const props = withDefaults(
  defineProps<{
    modelValue: number | string
    min?: number | string
    max?: number | string
    step?: number | string
  }>(),
  { step: 1 },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const displayValue = (value: number | string) =>
  typeof value === 'number' && !Number.isFinite(value) ? '' : String(value)
const text = ref(displayValue(props.modelValue))
const input = ref<HTMLInputElement>()

// Keep partial edits (empty text, a trailing decimal, or a minus sign) while
// emitting numeric values for calculations and API requests.
watch(
  () => props.modelValue,
  (value) => {
    if (!Object.is(parseNumberInput(text.value), parseNumberInput(value)))
      text.value = displayValue(value)
  },
)
function validate() {
  input.value?.setCustomValidity(numberInputError(text.value, props))
}
watchEffect(validate)
function onInput(event: Event) {
  text.value = (event.target as HTMLInputElement).value
  validate()
  emit('update:modelValue', parseNumberInput(text.value))
}
</script>
