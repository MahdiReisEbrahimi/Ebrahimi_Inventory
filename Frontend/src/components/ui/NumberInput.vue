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
import { toPersianDigits } from '@/lib/format'
import { numberInputError, parseNumberInput, stripNumberInputLeadingZeros } from '@/lib/numberInput'

const props = withDefaults(
  defineProps<{
    modelValue: number | string
    persianDigits?: boolean
    min?: number | string
    max?: number | string
    step?: number | string
  }>(),
  { step: 1 },
)
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
const localize = (value: string) => (props.persianDigits ? toPersianDigits(value) : value)
const displayValue = (value: number | string) =>
  localize(
    stripNumberInputLeadingZeros(
      typeof value === 'number' && !Number.isFinite(value) ? '' : String(value),
    ),
  )
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
  const element = event.target as HTMLInputElement
  const start = element.selectionStart
  const end = element.selectionEnd
  const original = element.value
  text.value = localize(stripNumberInputLeadingZeros(original))
  if (element.value !== text.value) {
    element.value = text.value
    const removed = original.length - text.value.length
    const signLength = original.startsWith('-') ? 1 : 0
    const adjust = (position: number) =>
      position - Math.min(removed, Math.max(0, position - signLength))
    if (start !== null && end !== null) element.setSelectionRange(adjust(start), adjust(end))
  }
  validate()
  emit('update:modelValue', parseNumberInput(text.value))
}
</script>
