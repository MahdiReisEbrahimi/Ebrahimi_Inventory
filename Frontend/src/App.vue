<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { productsApi } from '@/services/products'
import type { Product } from '@/types'
const route = useRoute()
const title = computed(() => route.meta.title ?? 'انبارک')
const nav = [
  { to: '/', text: 'داشبورد', icon: '⌂' },
  { to: '/products', text: 'محصولات', icon: '▦' },
  { to: '/categories', text: 'دسته‌بندی‌ها', icon: '◈' },
  { to: '/inventory', text: 'موجودی و انبار', icon: '▣' },
  { to: '/transactions', text: 'تراکنش‌ها', icon: '↔' },
  { to: '/reports', text: 'گزارش‌ها', icon: '◫' },
]
const isDark = ref(false)
const lowStockProducts = ref<Product[]>([])
const lowStockLoading = ref(false)
async function loadLowStockAlerts() {
  lowStockLoading.value = true
  try {
    const result = await productsApi.list({ page: 1, limit: 100, lowStock: true, isActive: true })
    lowStockProducts.value = result.data
  } catch {
    lowStockProducts.value = []
  } finally {
    lowStockLoading.value = false
  }
}
onMounted(() => {
  isDark.value = localStorage.getItem('theme') === 'dark'
  void loadLowStockAlerts()
})
watch(
  isDark,
  (dark) => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  },
  { immediate: true },
)
</script>

<template>
  <el-container class="app-shell"
    ><aside class="sidebar">
      <router-link class="brand" to="/"><b>انبارک</b><span>مدیریت هوشمند موجودی</span></router-link>
      <nav>
        <router-link v-for="item in nav" :key="item.to" :to="item.to" class="nav-link"
          ><i>{{ item.icon }}</i
          >{{ item.text }}</router-link
        >
      </nav>
      <div class="sidebar-bottom">
        <span class="avatar">م</span>
        <div><b>مدیر سیستم</b><small>مدیریت فروشگاه</small></div>
      </div>
    </aside>
    <el-container
      ><el-header class="topbar"
        ><div>
          <h1>{{ title }}</h1>
          <p>مدیریت موجودی و قیمت‌گذاری کالاها</p>
        </div>
        <div class="top-actions">
          <el-button circle aria-label="جست‌وجو">⌕</el-button
          ><el-popover
            placement="bottom-start"
            :width="320"
            trigger="click"
            @show="loadLowStockAlerts"
            ><template #reference
              ><el-badge
                :value="lowStockProducts.length"
                :hidden="lowStockProducts.length === 0"
                type="danger"
                ><el-button circle aria-label="هشدار موجودی کم">⚠</el-button></el-badge
              ></template
            >
            <div class="stock-alerts">
              <div class="stock-alerts__header">
                <b>کالاهای نیازمند تأمین</b
                ><el-tag type="danger" size="small">{{ lowStockProducts.length }} کالا</el-tag>
              </div>
              <el-skeleton v-if="lowStockLoading" :rows="2" animated /><template
                v-else-if="lowStockProducts.length"
                ><router-link
                  v-for="product in lowStockProducts"
                  :key="product.id"
                  :to="`/products/${product.id}`"
                  class="stock-alert"
                  ><span
                    ><b>{{ product.name }}</b
                    ><small>{{ product.sku }}</small></span
                  ><em>{{ product.stock }} / حداقل {{ product.minStock }}</em></router-link
                ></template
              >
              <p v-else class="stock-alerts__empty">همه کالاها موجودی کافی دارند.</p>
            </div></el-popover
          ><el-tooltip :content="isDark ? 'حالت روشن' : 'حالت تاریک'" placement="bottom"
            ><el-button circle aria-label="تغییر حالت نمایش" @click="isDark = !isDark">{{
              isDark ? '☀' : '☾'
            }}</el-button></el-tooltip
          ><span class="avatar">م</span>
        </div></el-header
      ><el-main><router-view /></el-main></el-container
  ></el-container>
</template>
