<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">رفتن به محتوای صفحه</a>
    <aside class="sidebar">
      <RouterLink to="/" class="brand" aria-label="انبارک، صفحه اصلی">
        <span class="brand-symbol"><Boxes :size="25" :stroke-width="1.6" /></span>
        <span
          ><b>انبارک<span class="brand-dot">.</span></b
          ><small>همراه هر روز فروشگاه شما</small></span
        >
      </RouterLink>
      <div class="workspace-label">میز کار فروشگاه</div>
      <nav aria-label="منوی اصلی">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ 'is-active': isActive(item.to) }"
        >
          <component :is="item.icon" :size="20" :stroke-width="1.7" /><span>{{ item.text }}</span>
          <span v-if="isActive(item.to)" class="nav-dot" />
        </RouterLink>
      </nav>
      <div class="sidebar-note">
        <Sprout :size="24" /><strong>نظم بیشتر، خیال آسوده‌تر</strong>
        <p>همه چیز برای مدیریت ساده‌تر کالاها و فروش، در یک جا.</p>
      </div>
      <div class="sidebar-footer">
        <span class="store-avatar"><Store :size="20" /></span>
        <div><b>فروشگاه ابراهیمی</b><small>مدیریت موجودی و فروش</small></div>
      </div>
    </aside>

    <div class="main-container">
      <header class="topbar no-print">
        <div class="topbar-context">
          <button
            class="icon-button mobile-menu"
            aria-label="باز کردن منوی اصلی"
            @click="mobileOpen = true"
          >
            <Menu :size="22" />
          </button>
          <span class="topbar-store">فروشگاه ابراهیمی</span
          ><ChevronLeft :size="14" class="breadcrumb-arrow" /><span>{{ title }}</span>
        </div>
        <div class="topbar-actions">
          <time class="today">{{ today }}</time>
          <button
            class="icon-button theme-toggle"
            :aria-label="isDark ? 'فعال کردن حالت روشن' : 'فعال کردن حالت تاریک'"
            :title="isDark ? 'حالت روشن' : 'حالت تاریک'"
            @click="toggleTheme"
          >
            <Sun v-if="isDark" :size="20" /><Moon v-else :size="20" />
          </button>
          <RouterLink
            to="/settings"
            class="icon-button settings-link"
            :class="{ 'is-active': route.path === '/settings' }"
            aria-label="تنظیمات ظاهر برنامه"
            title="تنظیمات ظاهر برنامه"
          >
            <Settings :size="20" />
          </RouterLink>
          <PopoverRoot v-model:open="alertsOpen">
            <PopoverTrigger
              class="icon-button"
              aria-label="کالاهای نیازمند تأمین"
              title="کالاهای نیازمند تأمین"
              @click="loadAlerts"
              ><Bell :size="20"
            /></PopoverTrigger>
            <PopoverPortal>
              <PopoverContent
                class="stock-popover"
                side="bottom"
                align="end"
                :side-offset="12"
                :collision-padding="16"
              >
                <div class="stock-popover__head">
                  <b>نیازمند تأمین</b
                  ><span class="badge badge--warning">{{ number(lowStock.length) }} کالا</span>
                </div>
                <div v-if="alertsLoading" class="table-loading" role="status">در حال دریافت…</div>
                <p v-else-if="alertsError" class="notice notice--error" role="alert">
                  {{ alertsError }}
                </p>
                <div v-else-if="lowStock.length" class="stock-popover__list">
                  <RouterLink
                    v-for="product in lowStock"
                    :key="product.id"
                    :to="{ path: '/products', query: { search: product.sku } }"
                    class="stock-alert"
                    @click="alertsOpen = false"
                  >
                    <span
                      ><b>{{ product.name }}</b
                      ><small>{{ product.sku }}</small></span
                    >
                    <span class="badge badge--warning"
                      >{{ number(product.stock) }} {{ product.unit }}</span
                    >
                  </RouterLink>
                </div>
                <p v-else class="muted stock-empty">کالایی نیازمند تأمین نیست.</p>
                <RouterLink
                  to="/inventory"
                  class="button button--outline stock-link"
                  @click="alertsOpen = false"
                  >ثبت ورود کالا<ArrowLeft :size="15"
                /></RouterLink>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
        </div>
      </header>
      <main id="main-content" class="page-content" tabindex="-1"><RouterView /></main>
    </div>

    <DialogRoot v-model:open="mobileOpen">
      <DialogPortal>
        <DialogOverlay class="sidebar-overlay" />
        <DialogContent class="mobile-sidebar" :aria-describedby="undefined" dir="rtl">
          <div class="mobile-sidebar__heading">
            <DialogTitle>انبارک · منوی اصلی</DialogTitle
            ><DialogClose class="icon-button" aria-label="بستن منو"><X :size="20" /></DialogClose>
          </div>
          <nav aria-label="منوی موبایل">
            <RouterLink
              v-for="item in navigation"
              :key="item.to"
              :to="item.to"
              class="nav-link"
              :class="{ 'is-active': isActive(item.to) }"
              @click="mobileOpen = false"
              ><component :is="item.icon" :size="20" /><span>{{ item.text }}</span></RouterLink
            >
          </nav>
        </DialogContent>
      </DialogPortal>
    </DialogRoot>
    <ToastHost />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  Boxes,
  ChartNoAxesColumn,
  ChevronLeft,
  House,
  Menu,
  Moon,
  Package,
  Receipt,
  Settings,
  Sprout,
  Store,
  Sun,
  X,
} from '@lucide/vue'
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogClose,
  PopoverRoot,
  PopoverTrigger,
  PopoverPortal,
  PopoverContent,
} from 'reka-ui'
import ToastHost from '@/components/ui/ToastHost.vue'
import { productsApi } from '@/services/products'
import { number } from '@/lib/format'
import type { Product } from '@/types'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const title = computed(() => route.meta.title || 'نمای کلی')
const today = new Intl.DateTimeFormat('fa-IR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
}).format(new Date())
const { isDark, toggleTheme } = useTheme()
const mobileOpen = ref(false)
const alertsOpen = ref(false)
const alertsLoading = ref(false)
const alertsError = ref('')
const lowStock = ref<Product[]>([])
const navigation = [
  { to: '/', text: 'نمای کلی', icon: House },
  { to: '/products', text: 'کالاها و قیمت‌ها', icon: Package },
  { to: '/inventory', text: 'ورود و مرجوعی کالا', icon: Boxes },
  { to: '/transactions', text: 'گردش موجودی', icon: ArrowLeftRight },
  { to: '/invoices', text: 'فاکتورهای فروش', icon: Receipt },
  { to: '/reports', text: 'گزارش‌ها', icon: ChartNoAxesColumn },
]
const isActive = (path: string) => (path === '/' ? route.path === '/' : route.path.startsWith(path))
async function loadAlerts() {
  alertsLoading.value = true
  alertsError.value = ''
  try {
    lowStock.value = (
      await productsApi.list({ page: 1, limit: 100, lowStock: true, isActive: true })
    ).data
  } catch {
    alertsError.value = 'دریافت موجودی ممکن نشد. دوباره تلاش کنید.'
  } finally {
    alertsLoading.value = false
  }
}
watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
    alertsOpen.value = false
  },
)
</script>

<style>
.app-shell {
  display: flex;
  min-height: 100dvh;
}
.sidebar {
  width: 246px;
  flex: 0 0 246px;
  position: sticky;
  top: 0;
  height: 100dvh;
  padding: 32px 20px 20px;
  display: flex;
  flex-direction: column;
  background: var(--sidebar);
  color: var(--sidebar-foreground);
  overflow-y: auto;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 8px;
}
.brand-symbol {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid var(--sidebar-border);
  border-radius: 14px;
  background: var(--sidebar-accent);
}
.brand b {
  font-size: 27px;
  line-height: 1.2;
  font-weight: 850;
}
.brand-dot {
  color: #c4d890;
}
.brand small {
  display: block;
  color: var(--sidebar-muted);
  font-size: 10px;
  margin-top: 7px;
}
.workspace-label {
  font-size: 10px;
  color: var(--sidebar-muted);
  margin: 44px 14px 12px;
}
.sidebar nav,
.mobile-sidebar nav {
  display: grid;
  gap: 7px;
}
.nav-link {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 10px;
  font-size: 13px;
  color: var(--sidebar-muted);
}
.nav-link:hover {
  background: var(--sidebar-accent);
  color: var(--sidebar-foreground);
}
.nav-link.is-active {
  background: var(--sidebar-accent);
  color: var(--sidebar-accent-foreground);
  font-weight: 650;
}
.nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #c4d890;
  margin-inline-start: auto;
}
.sidebar-note {
  padding: 20px 16px;
  border: 1px solid var(--sidebar-border);
  border-radius: 14px;
  margin-top: auto;
  margin-bottom: 24px;
}
.sidebar-note svg {
  color: #c4d890;
  margin-bottom: 12px;
}
.sidebar-note strong {
  display: block;
  font-size: 12px;
}
.sidebar-note p {
  font-size: 11px;
  line-height: 2;
  margin: 7px 0 0;
  color: var(--sidebar-muted);
}
.sidebar nav {
  margin-bottom: 44px;
}
.sidebar-footer {
  display: flex;
  gap: 10px;
  padding: 18px 4px 0;
  border-top: 1px solid var(--sidebar-border);
  align-items: center;
}
.store-avatar {
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  background: var(--sidebar-accent);
  border-radius: 11px;
}
.sidebar-footer b {
  font-size: 12px;
}
.sidebar-footer small {
  display: block;
  font-size: 10px;
  color: var(--sidebar-muted);
}
.main-container {
  flex: 1;
  min-width: 0;
}
.topbar {
  min-height: 76px;
  padding: 0 36px;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.topbar-context,
.topbar-actions {
  display: flex;
  align-items: center;
  gap: 14px;
}
.topbar-context {
  font-size: 12px;
}
.topbar-store,
.today,
.breadcrumb-arrow {
  color: var(--muted-foreground);
}
.today {
  font-size: 11px;
  margin-inline-end: 12px;
}
.settings-link.is-active {
  color: var(--accent-foreground);
  background: var(--accent);
}
.theme-toggle {
  border: 1px solid var(--border);
  background: var(--card);
}
.page-content {
  max-width: 1560px;
  padding: 32px 36px 48px;
  margin: 0 auto;
}
.skip-link {
  position: fixed;
  top: -100px;
  inset-inline-start: 12px;
  z-index: 150;
  background: var(--card);
  padding: 10px 16px;
  border-radius: 8px;
}
.skip-link:focus {
  top: 12px;
}
.stock-popover {
  z-index: 60;
  width: min(360px, calc(100vw - 32px));
  max-height: min(560px, 80dvh);
  overflow-y: auto;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--popover);
  color: var(--foreground);
  box-shadow: var(--shadow-lg);
  direction: rtl;
}
.stock-popover__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 12px;
}
.stock-popover__list {
  max-height: 320px;
  overflow: auto;
}
.stock-alert {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0;
  border-top: 1px solid var(--border);
  font-size: 12px;
}
.stock-alert small {
  display: block;
  color: var(--muted-foreground);
  font-size: 10px;
}
.stock-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
}
.stock-link {
  width: 100%;
  margin-top: 12px;
}
.mobile-menu {
  display: none;
}
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: #00000080;
  backdrop-filter: blur(3px);
  z-index: 90;
}
.mobile-sidebar {
  position: fixed;
  inset-block: 0;
  inset-inline-start: 0;
  width: min(300px, 86vw);
  background: var(--sidebar);
  color: var(--sidebar-foreground);
  z-index: 91;
  padding: 20px;
  overflow-y: auto;
}
.mobile-sidebar__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 28px;
  font-weight: 700;
}
.mobile-sidebar__heading .icon-button {
  color: inherit;
}
@media (max-width: 1100px) {
  .sidebar {
    width: 220px;
    flex-basis: 220px;
    padding-inline: 14px;
  }
  .page-content {
    padding: 26px 24px;
  }
  .topbar {
    padding-inline: 24px;
  }
  .today {
    display: none;
  }
}
@media (max-width: 820px) {
  .sidebar {
    display: none;
  }
  .mobile-menu {
    display: inline-grid;
  }
  .topbar {
    padding-inline: 16px;
    min-height: 66px;
  }
  .page-content {
    padding: 24px 16px 36px;
  }
}
@media (max-width: 480px) {
  .topbar-store,
  .breadcrumb-arrow {
    display: none;
  }
  .topbar-context,
  .topbar-actions {
    gap: 6px;
  }
}
</style>
