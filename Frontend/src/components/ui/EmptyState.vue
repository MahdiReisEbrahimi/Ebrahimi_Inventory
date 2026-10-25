<template>
  <div class="empty-state" :role="error ? 'alert' : 'status'">
    <div class="empty-state__icon">
      <component :is="error ? CircleAlert : PackageOpen" :size="26" />
    </div>
    <h3>{{ title }}</h3>
    <p v-if="description">{{ description }}</p>
    <div v-if="$slots.default" class="empty-state__actions"><slot /></div>
  </div>
</template>
<script setup lang="ts">
import { CircleAlert, PackageOpen } from '@lucide/vue'
defineProps<{ title: string; description?: string; error?: boolean }>()
</script>
