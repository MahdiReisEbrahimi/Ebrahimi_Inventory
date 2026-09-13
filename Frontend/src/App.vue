<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  Fold,
  Expand,
  House,
  Goods,
  Box,
  Switch,
  DataAnalysis,
  Search,
  Bell,
  Moon,
  Sunny,
} from '@element-plus/icons-vue'

import { productsApi } from '@/services/products'
import type { Product } from '@/types'

const route = useRoute()

const title = computed(() => route.meta.title ?? 'انبارک')

/* -----------------------------
 * Sidebar
 * ----------------------------- */

const isSidebarCollapsed = ref(false)
const isMobileSidebarOpen = ref(false)

const nav = [
  {
    to: '/',
    text: 'داشبورد',
    icon: House,
  },
  {
    to: '/products',
    text: 'محصولات',
    icon: Goods,
  },
  {
    to: '/inventory',
    text: 'موجودی و انبار',
    icon: Box,
  },
  {
    to: '/transactions',
    text: 'تراکنش‌ها',
    icon: Switch,
  },
  {
    to: '/reports',
    text: 'گزارش‌ها',
    icon: DataAnalysis,
  },
]

function toggleSidebar() {
  if (window.innerWidth <= 768) {
    isMobileSidebarOpen.value = !isMobileSidebarOpen.value
  } else {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }
}

function closeMobileSidebar() {
  if (window.innerWidth <= 768) {
    isMobileSidebarOpen.value = false
  }
}

/* -----------------------------
 * Theme
 * ----------------------------- */

const isDark = ref(false)

/* -----------------------------
 * Low stock
 * ----------------------------- */

const lowStockProducts = ref<Product[]>([])
const lowStockLoading = ref(false)

async function loadLowStockAlerts() {
  lowStockLoading.value = true

  try {
    const result = await productsApi.list({
      page: 1,
      limit: 100,
      lowStock: true,
      isActive: true,
    })

    lowStockProducts.value = result.data
  } catch {
    lowStockProducts.value = []
  } finally {
    lowStockLoading.value = false
  }
}

/* -----------------------------
 * Lifecycle
 * ----------------------------- */

onMounted(() => {
  isDark.value = localStorage.getItem('theme') === 'dark'

  void loadLowStockAlerts()

  // در شروع روی موبایل سایدبار بسته باشد
  if (window.innerWidth <= 768) {
    isMobileSidebarOpen.value = false
  }
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
  <el-container class="app-shell">
    <!-- Mobile overlay -->
    <div v-if="isMobileSidebarOpen" class="sidebar-overlay" @click="closeMobileSidebar" />

    <!-- Sidebar -->
    <aside
      class="sidebar"
      :class="{
        'sidebar--collapsed': isSidebarCollapsed,
        'sidebar--mobile-open': isMobileSidebarOpen,
      }"
    >
      <!-- Sidebar header -->
      <div class="sidebar-header">
        <router-link  v-if="!isSidebarCollapsed" class="brand" to="/" @click="closeMobileSidebar">
          <div class="brand-logo">Z</div>
          <div class="brand-content">
            <b>انبارک</b>
            <span>مدیریت هوشمند موجودی</span>
          </div>
        </router-link>

        <!-- Desktop collapse -->
        <el-button
          class="sidebar-toggle"
          text
          circle
          :aria-label="isSidebarCollapsed ? 'باز کردن منو' : 'جمع کردن منو'"
          :aria-expanded="!isSidebarCollapsed"
          @click="toggleSidebar"
        >
          <el-icon :size="20">
            <Fold v-if="!isSidebarCollapsed" />
            <Expand v-else />
          </el-icon>
        </el-button>
      </div>

      <!-- Navigation -->
      <nav class="sidebar-nav">
        <router-link
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          @click="closeMobileSidebar"
        >
          <el-icon class="nav-icon">
            <component :is="item.icon" />
          </el-icon>

          <span class="nav-text">
            {{ item.text }}
          </span>
        </router-link>
      </nav>

      <!-- Sidebar bottom -->
      <div class="sidebar-bottom">
        <div class="user-avatar">م</div>

        <div class="user-info">
          <b>مدیر سیستم</b>
          <small>مدیریت فروشگاه</small>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <el-container class="main-container">
      <!-- Topbar -->
      <el-header class="topbar">
        <div class="topbar-right">
          <!-- Hamburger -->
          <el-button
            class="mobile-menu-button"
            text
            circle
            aria-label="باز کردن منو"
            :aria-expanded="isMobileSidebarOpen"
            @click="toggleSidebar"
          >
            <el-icon :size="22">
              <Fold />
            </el-icon>
          </el-button>

          <div class="page-heading">
            <h1>{{ title }}</h1>
            <p>مدیریت موجودی و قیمت‌گذاری کالاها</p>
          </div>
        </div>

        <!-- Top actions -->
        <div class="top-actions">
          <!-- Search -->
          <el-tooltip content="جست‌وجو" placement="bottom">
            <el-button circle aria-label="جست‌وجو">
              <el-icon :size="18">
                <Search />
              </el-icon>
            </el-button>
          </el-tooltip>

          <!-- Low stock -->
          <el-popover
            placement="bottom-start"
            :width="340"
            trigger="click"
            @show="loadLowStockAlerts"
          >
            <template #reference>
              <el-badge
                :value="lowStockProducts.length"
                :hidden="lowStockProducts.length === 0"
                type="danger"
              >
                <el-tooltip content="هشدار موجودی کم" placement="bottom">
                  <el-button circle aria-label="هشدار موجودی کم">
                    <el-icon :size="18">
                      <Bell />
                    </el-icon>
                  </el-button>
                </el-tooltip>
              </el-badge>
            </template>

            <div class="stock-alerts">
              <div class="stock-alerts__header">
                <b>کالاهای نیازمند تأمین</b>

                <el-tag v-if="lowStockProducts.length" type="danger" size="small">
                  {{ lowStockProducts.length }} کالا
                </el-tag>
              </div>

              <el-skeleton v-if="lowStockLoading" :rows="3" animated />

              <template v-else-if="lowStockProducts.length">
                <router-link
                  v-for="product in lowStockProducts"
                  :key="product.id"
                  :to="`/products/${product.id}`"
                  class="stock-alert"
                >
                  <span>
                    <b>{{ product.name }}</b>
                    <small>{{ product.sku }}</small>
                  </span>

                  <em>
                    {{ product.stock }}
                    / حداقل {{ product.minStock }}
                  </em>
                </router-link>
              </template>

              <p v-else class="stock-alerts__empty">همه کالاها موجودی کافی دارند.</p>
            </div>
          </el-popover>

          <!-- Theme -->
          <el-tooltip :content="isDark ? 'حالت روشن' : 'حالت تاریک'" placement="bottom">
            <el-button circle aria-label="تغییر حالت نمایش" @click="isDark = !isDark">
              <el-icon :size="18">
                <Sunny v-if="isDark" />
                <Moon v-else />
              </el-icon>
            </el-button>
          </el-tooltip>

          <!-- User -->
          <div class="top-user-avatar">م</div>
        </div>
      </el-header>

      <!-- Page -->
      <el-main class="page-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
/* --------------------------------
   Layout
--------------------------------- */

.app-shell {
  min-height: 100vh;
  background: var(--el-bg-color-page);
  direction: rtl;
}

.main-container {
  min-width: 0;
}

/* --------------------------------
   Sidebar
--------------------------------- */

.sidebar {
  width: 250px;
  min-width: 250px;
  height: 100vh;

  display: flex;
  flex-direction: column;

  background: var(--app-surface);
  border-left: 1px solid var(--el-border-color-lighter);

  transition:
    width 0.25s ease,
    min-width 0.25s ease,
    transform 0.25s ease;

  position: sticky;
  top: 0;
  z-index: 100;
}

.sidebar--collapsed {
  width: 76px;
  min-width: 76px;
}

/* --------------------------------
   Sidebar header
--------------------------------- */

.sidebar-header {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.brand {
  min-width: 0;

  display: flex;
  align-items: center;
  gap: 11px;

  color: inherit;
  text-decoration: none;
}

.brand-logo {
  width: 38px;
  height: 38px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 11px;

  background: var(--el-color-primary);
  color: white;

  font-size: 18px;
  font-weight: 800;
}

.brand-content {
  min-width: 0;

  display: flex;
  flex-direction: column;
  gap: 2px;

  overflow: hidden;
  white-space: nowrap;

  transition: opacity 0.15s ease;
}

.brand-content b {
  font-size: 16px;
}

.brand-content span {
  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.sidebar--collapsed .brand-content {
  display: none;
}

.sidebar-toggle {
  flex-shrink: 0;
  color: var(--el-text-color-secondary);
  margin-top: -20px;
  margin-right: 4px;
  scale: 1.5
}

.sidebar-toggle:hover {
  /* color: var(--el-color-primary); */
}

/* --------------------------------
   Navigation
--------------------------------- */

.sidebar-nav {
  flex: 1;

  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 20px;
}

.nav-link {
  height: 46px;
  display: flex;
  align-items: center;
  border-radius: 10px;
  text-decoration: none;
  transition:
    background 0.2s ease,
    color 0.2s ease;
}

.nav-link:hover {
  background: var(--el-fill-color-light);
  color: var(--el-color-primary);
}

.nav-link.router-link-active {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-weight: 600;
}

.nav-icon {
  width: 50px;
  display: flex;
  justify-content: center;
}

.nav-text {
  white-space: nowrap;
  font-weight: bold;
  font-size: large;
}

/* Collapsed sidebar */

.sidebar--collapsed .nav-link {
  justify-content: center;
  padding: 0;
}

.sidebar--collapsed .nav-text {
  display: none;
}

/* --------------------------------
   Sidebar bottom
--------------------------------- */

.sidebar-bottom {
  margin: 12px;
  padding: 12px;

  display: flex;
  align-items: center;
  gap: 10px;

  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.user-avatar,
.top-user-avatar {
  width: 36px;
  height: 36px;

  flex-shrink: 0;

  display: flex;
  align-items: center;
  justify-content: center;

  border-radius: 50%;

  background: var(--el-color-primary-light-8);
  color: var(--el-color-primary);

  font-weight: 700;
}

.user-info {
  min-width: 0;

  display: flex;
  flex-direction: column;
}

.user-info b {
  font-size: 13px;
}

.user-info small {
  margin-top: 2px;

  color: var(--el-text-color-secondary);
  font-size: 11px;
}

.sidebar--collapsed .sidebar-bottom {
  justify-content: center;
  padding: 10px 0;
}

.sidebar--collapsed .user-info {
  display: none;
}

/* --------------------------------
   Topbar
--------------------------------- */

.topbar {
  height: 76px;

  display: flex;
  align-items: center;
  justify-content: space-between;

  padding: 0 28px;

  background: var(--el-bg-color);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 14px;
}

.page-heading h1 {
  margin: 0;

  font-size: 20px;
  font-weight: 700;
}

.page-heading p {
  margin: 4px 0 0;

  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.top-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.top-user-avatar {
  margin-right: 4px;
}

/* --------------------------------
   Mobile menu
--------------------------------- */

.mobile-menu-button {
  display: none;
}

/* --------------------------------
   Page
--------------------------------- */

.page-content {
  padding: 24px 28px;
}

/* --------------------------------
   Mobile overlay
--------------------------------- */

.sidebar-overlay {
  display: none;
}

/* --------------------------------
   Stock alerts
--------------------------------- */

.stock-alerts {
  direction: rtl;
}

.stock-alerts__header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  margin-bottom: 12px;
  padding-bottom: 10px;

  border-bottom: 1px solid var(--el-border-color-lighter);
}

.stock-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;

  gap: 12px;

  padding: 11px 8px;

  border-radius: 8px;

  color: inherit;
  text-decoration: none;
}

.stock-alert:hover {
  background: var(--el-fill-color-light);
}

.stock-alert > span {
  min-width: 0;

  display: flex;
  flex-direction: column;
}

.stock-alert b {
  overflow: hidden;

  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-alert small {
  margin-top: 3px;

  color: var(--el-text-color-secondary);
}

.stock-alert em {
  flex-shrink: 0;

  color: var(--el-color-danger);

  font-size: 12px;
  font-style: normal;
}

.stock-alerts__empty {
  margin: 20px 0;

  color: var(--el-text-color-secondary);
  text-align: center;
}

/* --------------------------------
   Responsive
--------------------------------- */

@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    right: 0;
    top: 0;
    bottom: 0;

    width: 260px;
    min-width: 260px;

    transform: translateX(100%);

    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.12);
  }

  .sidebar--mobile-open {
    transform: translateX(0);
  }

  .sidebar--collapsed {
    width: 260px;
    min-width: 260px;
  }

  .sidebar--collapsed .brand-content,
  .sidebar--collapsed .nav-text,
  .sidebar--collapsed .user-info {
    display: flex;
  }

  .sidebar--collapsed .nav-link {
    justify-content: flex-start;
    padding: 0 13px;
  }

  .sidebar--collapsed .sidebar-bottom {
    justify-content: flex-start;
    padding: 12px;
  }

  .sidebar-toggle {
    display: none;
  }

  .mobile-menu-button {
    display: inline-flex;
  }

  .sidebar-overlay {
    display: block;

    position: fixed;
    inset: 0;

    background: rgba(0, 0, 0, 0.35);

    z-index: 90;

    backdrop-filter: blur(2px);
  }

  .topbar {
    height: 64px;
    padding: 0 14px;
  }

  .page-heading h1 {
    font-size: 17px;
  }

  .page-heading p {
    display: none;
  }

  .top-actions {
    gap: 4px;
  }

  .top-actions > .el-button,
  .top-actions .el-badge .el-button {
    width: 36px;
    height: 36px;
  }

  .top-user-avatar {
    display: none;
  }

  .page-content {
    padding: 16px;
  }
}

@media (max-width: 480px) {
  .topbar {
    padding: 0 10px;
  }

  .topbar-right {
    gap: 7px;
  }

  .page-heading h1 {
    font-size: 16px;
  }

  .top-actions {
    gap: 2px;
  }
}
</style>
