<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="date-picker-trigger" :disabled="disabled" aria-label="انتخاب تاریخ صدور">
      <CalendarDays :size="17" /><span>{{ persianDateLabel(modelValue) }}</span>
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        class="date-picker-popover"
        dir="rtl"
        :side-offset="8"
        :collision-padding="12"
      >
        <div class="calendar-heading">
          <button type="button" class="icon-button" aria-label="ماه قبل" @click="moveMonth(-1)">
            <ChevronRight :size="18" />
          </button>
          <select
            :value="parts.month"
            aria-label="ماه"
            @change="changeMonth(Number(($event.target as HTMLSelectElement).value), parts.year)"
          >
            <option v-for="(month, index) in months" :key="month" :value="index + 1">
              {{ month }}
            </option>
          </select>
          <select
            :value="parts.year"
            aria-label="سال"
            @change="changeMonth(parts.month, Number(($event.target as HTMLSelectElement).value))"
          >
            <option v-for="year in years" :key="year" :value="year">{{ number(year) }}</option>
          </select>
          <button type="button" class="icon-button" aria-label="ماه بعد" @click="moveMonth(1)">
            <ChevronLeft :size="18" />
          </button>
        </div>
        <div ref="grid" class="calendar-grid" role="group" aria-label="روزهای ماه">
          <span v-for="day in weekdays" :key="day" class="weekday">{{ day }}</span>
          <button
            v-for="day in days"
            :key="day.iso"
            type="button"
            :class="{
              outside: day.outside,
              selected: day.iso === modelValue,
              today: day.iso === today,
            }"
            :data-date="day.iso"
            :aria-label="persianDateLabel(day.iso)"
            :aria-pressed="day.iso === modelValue"
            @click="choose(day.iso)"
            @keydown="navigate($event, day.iso)"
          >
            {{ number(day.day) }}
          </button>
        </div>
        <button
          type="button"
          class="button button--ghost button--small calendar-today"
          @click="choose(today)"
        >
          امروز · {{ persianDateLabel(today) }}
        </button>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { PopoverRoot, PopoverTrigger, PopoverPortal, PopoverContent } from 'reka-ui'
import { CalendarDays, ChevronLeft, ChevronRight } from '@lucide/vue'
import {
  addDays,
  monthStart,
  persianParts,
  persianToIso,
  persianDateLabel,
  todayInTehran,
} from '@/lib/persianDate'
import { number } from '@/lib/format'
const props = defineProps<{ modelValue: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)
const grid = ref<HTMLElement>()
const today = todayInTehran()
const cursor = ref(monthStart(props.modelValue))
const parts = computed(() => persianParts(cursor.value))
const months = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
]
const weekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']
const years = computed(() => Array.from({ length: 41 }, (_, i) => parts.value.year - 20 + i))
const days = computed(() => {
  const offset = (new Date(`${cursor.value}T12:00:00Z`).getUTCDay() + 1) % 7
  const start = addDays(cursor.value, -offset)
  return Array.from({ length: 42 }, (_, i) => {
    const iso = addDays(start, i)
    const p = persianParts(iso)
    return { iso, day: p.day, outside: p.month !== parts.value.month }
  })
})
watch(open, (value) => {
  if (value) cursor.value = monthStart(props.modelValue)
})
function choose(value: string) {
  emit('update:modelValue', value)
  open.value = false
}
function moveMonth(direction: number) {
  cursor.value = monthStart(addDays(cursor.value, direction < 0 ? -1 : 32))
}
function changeMonth(month: number, year: number) {
  cursor.value = persianToIso(year, month, 1)
}
async function navigate(event: KeyboardEvent, iso: string) {
  const delta = { ArrowLeft: 1, ArrowRight: -1, ArrowUp: -7, ArrowDown: 7 }[event.key]
  if (delta === undefined) return
  event.preventDefault()
  const target = addDays(iso, delta)
  emit('update:modelValue', target)
  cursor.value = monthStart(target)
  await nextTick()
  grid.value?.querySelector<HTMLButtonElement>(`[data-date="${target}"]`)?.focus()
}
</script>
<style>
.date-picker-trigger {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  min-height: 42px;
  border: 1px solid var(--input);
  border-radius: 10px;
  color: var(--foreground);
  background: var(--card);
}
.date-picker-popover {
  z-index: 100;
  width: min(340px, calc(100vw - 24px));
  padding: 14px;
  background: var(--popover);
  color: var(--foreground);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: var(--shadow-lg);
}
.calendar-heading {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}
.calendar-heading select {
  min-height: 36px;
  padding-block: 4px;
  padding-right: 4px;
}
.calendar-heading .icon-button {
  width: 30px;
  flex-shrink: 0;
}
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  text-align: center;
}
.calendar-grid .weekday {
  font-size: 11px;
  color: var(--muted-foreground);
  padding: 4px;
}
.calendar-grid button {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  min-height: 36px;
}
.calendar-grid button:hover {
  background: var(--muted);
}
.calendar-grid .outside {
  color: var(--muted-foreground);
  opacity: 0.6;
}
.calendar-grid .today {
  border-color: var(--primary);
}
.calendar-grid .selected {
  background: var(--primary);
  color: var(--primary-foreground);
  opacity: 1;
}
.calendar-today {
  margin-top: 10px;
  width: 100%;
}
</style>
