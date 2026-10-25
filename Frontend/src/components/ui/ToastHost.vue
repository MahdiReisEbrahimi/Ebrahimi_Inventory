<template>
  <div class="toast-host" aria-live="polite" aria-atomic="false">
    <TransitionGroup name="toast">
      <div
        v-for="item in items"
        :key="item.id"
        class="toast-item"
        :class="'toast-item--' + item.variant"
        role="status"
      >
        <component
          :is="
            item.variant === 'success'
              ? CircleCheck
              : item.variant === 'destructive'
                ? CircleAlert
                : Info
          "
          :size="19"
        />
        <span class="toast-message">{{ item.message }}</span>
        <button
          class="toast-dismiss"
          type="button"
          aria-label="بستن پیام"
          @click="dismiss(item.id)"
        >
          <X :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { CircleAlert, CircleCheck, Info, X } from '@lucide/vue'
import type { ToastVariant } from '@/lib/toast'
const items = ref<Array<{ id: number; message: string; variant: ToastVariant }>>([])
const timers = new Map<number, ReturnType<typeof setTimeout>>()
let nextId = 0
function dismiss(id: number) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  items.value = items.value.filter((item) => item.id !== id)
}
function showToast(event: Event) {
  const detail = (event as CustomEvent<{ message: string; variant: ToastVariant }>).detail
  const item = { id: nextId++, ...detail }
  items.value.push(item)
  timers.set(
    item.id,
    setTimeout(() => dismiss(item.id), 6500),
  )
}
onMounted(() => window.addEventListener('app:toast', showToast))
onUnmounted(() => {
  window.removeEventListener('app:toast', showToast)
  timers.forEach(clearTimeout)
})
</script>
<style scoped>
.toast-message {
  flex: 1;
}
.toast-dismiss {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--muted-foreground);
  border-radius: 6px;
}
.toast-dismiss:hover {
  background: var(--muted);
}
</style>
