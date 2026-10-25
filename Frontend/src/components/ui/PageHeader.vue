<template>
  <header class="page-header">
    <div class="page-header__copy">
      <span v-if="eyebrow" class="eyebrow">{{ eyebrow }}</span>
      <h1>{{ title }}</h1>
      <p v-if="description">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="page-header__actions"><slot /></div>
  </header>
</template>
<script setup lang="ts">
defineProps<{ title: string; description?: string; eyebrow?: string }>()
</script>
