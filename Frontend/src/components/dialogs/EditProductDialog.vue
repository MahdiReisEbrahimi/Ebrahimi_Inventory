<template>
  <ProductFormView embedded :edit-data="selectedRow" @close="emit('close', $event)" />
</template>
<script setup lang="ts">
import ProductFormView from '@/views/ProductFormView.vue'
import type { Product } from '@/types'
defineProps<{ selectedRow: Product }>()
const emit = defineEmits<{ close: [saved: boolean] }>()
</script>
