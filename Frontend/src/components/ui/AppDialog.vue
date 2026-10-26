<template>
  <DialogRoot :open="open" @update:open="emit('update:open', $event)">
    <DialogPortal>
      <DialogOverlay class="dialog-overlay" />
      <DialogContent
        class="dialog-content"
        dir="rtl"
        :aria-describedby="undefined"
        :style="{ maxWidth: /^\d+$/.test(width) ? `${width}px` : width }"
      >
        <div class="dialog-heading">
          <DialogTitle class="dialog-title">{{ title }}</DialogTitle>
          <DialogClose class="dialog-close" aria-label="بستن">×</DialogClose>
        </div>
        <div class="dialog-body"><slot /></div>
        <div ref="footer" class="dialog-footer" />
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import { provide, useTemplateRef } from 'vue'
import { dialogFooterKey } from '@/lib/dialog'
import {
  DialogClose,
  DialogContent,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from 'reka-ui'

withDefaults(defineProps<{ open: boolean; title: string; width?: string }>(), { width: '560px' })
const emit = defineEmits<{ 'update:open': [value: boolean] }>()
provide(dialogFooterKey, useTemplateRef<HTMLDivElement>('footer'))
</script>

<style>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: #0008;
}
.dialog-content {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 81;
  width: calc(100vw - 32px);
  max-height: calc(100dvh - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: translate(-50%, -50%);
  border: 1px solid var(--border);
  border-radius: 20px;
  background: var(--card);
  color: var(--card-foreground);
  box-shadow: var(--shadow-lg);
}
.dialog-heading {
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
  background: var(--card);
}
.dialog-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}
.dialog-close {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 23px;
  cursor: pointer;
}
.dialog-close:hover {
  background: var(--muted);
}
.dialog-body {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  padding: 18px 20px;
}
.dialog-footer {
  flex-shrink: 0;
  display: grid;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid var(--border);
  background: var(--card);
}
.dialog-footer:empty {
  display: none;
}
.dialog-footer .form-actions {
  padding: 0;
  margin: 0;
  border: 0;
}
@media (max-width: 600px) {
  .dialog-content {
    width: calc(100vw - 20px);
  }
}
</style>
