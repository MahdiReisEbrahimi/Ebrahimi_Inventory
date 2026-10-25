<template>
  <article class="stat-card" :class="{ 'stat-card--warning': warning }">
    <div class="stat-card__heading">
      <span>{{ label }}</span
      ><component :is="icon" v-if="icon" :size="19" />
    </div>
    <strong
      >{{ value }}<small v-if="unit">{{ unit }}</small></strong
    >
    <p v-if="hint">{{ hint }}</p>
  </article>
</template>
<script setup lang="ts">
import type { Component } from 'vue'
defineProps<{
  label: string
  value: string | number
  unit?: string
  hint?: string
  icon?: Component
  warning?: boolean
}>()
</script>
