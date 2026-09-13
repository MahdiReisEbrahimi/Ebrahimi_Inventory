<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
const route = useRoute(); const title = computed(() => route.meta.title ?? 'انبارک')
const nav = [{ to: '/', text: 'داشبورد', icon: '⌂' }, { to: '/products', text: 'محصولات', icon: '▦' }, { to: '/categories', text: 'دسته‌بندی‌ها', icon: '◈' }, { to: '/inventory', text: 'موجودی و انبار', icon: '▣' }, { to: '/transactions', text: 'تراکنش‌ها', icon: '↔' }, { to: '/reports', text: 'گزارش‌ها', icon: '◫' }]
</script>

<template>
  <el-container class="app-shell"><aside class="sidebar"><router-link class="brand" to="/"><b>انبارک</b><span>مدیریت هوشمند موجودی</span></router-link><nav><router-link v-for="item in nav" :key="item.to" :to="item.to" class="nav-link"><i>{{ item.icon }}</i>{{ item.text }}</router-link></nav><div class="sidebar-bottom"><span class="avatar">م</span><div><b>مدیر سیستم</b><small>مدیریت فروشگاه</small></div></div></aside><el-container><el-header class="topbar"><div><h1>{{ title }}</h1><p>مدیریت موجودی و قیمت‌گذاری کالاها</p></div><div class="top-actions"><el-button circle>⌕</el-button><el-button circle>♧</el-button><span class="avatar">م</span></div></el-header><el-main><router-view /></el-main></el-container></el-container>
</template>
