<script setup lang="ts">
import { useRoute } from "vue-router";
const route = useRoute();
</script>
<template>
  <section class="empty-panel">
    <div class="empty-icon">{{ route.meta.icon }}</div>
    <h2>{{ route.meta.title }}</h2>
    <p>{{ route.meta.description }}</p>
    <el-tag type="info">در انتظار اتصال API</el-tag>
  </section>
</template>
