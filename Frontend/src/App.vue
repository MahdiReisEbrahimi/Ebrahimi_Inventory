<template>
  <div class="app-shell">
    <a class="skip-link" href="#main-content">رفتن به محتوای صفحه</a>
    <aside id="desktop-sidebar" class="sidebar" :class="{ 'is-collapsed': sidebarCollapsed }">
      <RouterLink to="/" class="brand" aria-label="فروشگاه ابراهیمی، صفحه اصلی">
        <StoreLogo on-dark />
      </RouterLink>
      <div class="workspace-label"></div>
      <nav aria-label="منوی اصلی">
        <RouterLink
          v-for="item in navigation"
          :key="item.to"
          :to="item.to"
          class="nav-link"
          :class="{ 'is-active': isActive(item.to) }"
          :aria-label="item.text"
          :title="sidebarCollapsed ? item.text : undefined"
        >
          <component :is="item.icon" :size="20" :stroke-width="1.7" /><span class="nav-label">{{
            item.text
          }}</span>
          <span v-if="isActive(item.to)" class="nav-dot" />
        </RouterLink>
      </nav>
    </aside>

    <div class="main-container">
      <header class="topbar no-print" :class="{ 'topbar--invoices': route.path === '/invoices' }">
        <div class="topbar-context">
          <button
            type="button"
            class="icon-button menu-toggle"
            :aria-label="menuLabel"
            :title="menuLabel"
            :aria-expanded="smallScreen ? mobileOpen : !sidebarCollapsed"
            :aria-controls="smallScreen ? 'mobile-sidebar' : 'desktop-sidebar'"
            :aria-haspopup="smallScreen ? 'dialog' : undefined"
            @click="toggleNavigation"
          >
            <Menu :size="22" />
          </button>
          <span class="topbar-store">فروشگاه ابراهیمی</span
          ><ChevronLeft :size="14" class="breadcrumb-arrow" /><span
            class="topbar-title"
            :title="String(title)"
            >{{ title }}</span
          >
        </div>
        <div id="page-toolbar" class="topbar-page-actions" />
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
                    :to="{ path: '/products', query: { search: product.name } }"
                    class="stock-alert"
                    @click="alertsOpen = false"
                  >
                    <span
                      ><b>{{ product.name }}</b
                      ><small>{{ product.category.name }}</small></span
                    >
                    <span class="badge badge--warning"
                      >{{ number(product.stock) }} {{ product.unit }}</span
                    >
                  </RouterLink>
                </div>
                <p v-else class="muted stock-empty">کالایی نیازمند تأمین نیست.</p>
                <RouterLink
                  :to="{ path: '/products', query: { lowStock: 'true' } }"
                  class="button button--outline stock-link"
                  @click="alertsOpen = false"
                  >ثبت ورود کالا<ArrowLeft :size="15"
                /></RouterLink>
              </PopoverContent>
            </PopoverPortal>
          </PopoverRoot>
        </div>
      </header>
      <main
        id="main-content"
        class="page-content"
        :class="{ 'page-content--invoices': route.path === '/invoices' }"
        tabindex="-1"
      >
        <RouterView />
      </main>
    </div>

    <DialogRoot v-if="smallScreen" v-model:open="mobileOpen">
      <DialogPortal>
        <DialogOverlay class="sidebar-overlay" />
        <DialogContent
          id="mobile-sidebar"
          class="mobile-sidebar"
          :aria-describedby="undefined"
          dir="rtl"
        >
          <div class="mobile-sidebar__heading">
            <DialogTitle aria-label="منوی اصلی فروشگاه ابراهیمی"><StoreLogo on-dark /></DialogTitle
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
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import {
  ArrowLeft,
  ArrowLeftRight,
  Bell,
  ChevronLeft,
  House,
  Tags,
  Menu,
  Moon,
  Package,
  Receipt,
  Settings,
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
import StoreLogo from '@/components/StoreLogo.vue'
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
const sidebarCollapsed = ref(false)
const smallScreen = ref(false)
const menuLabel = computed(() =>
  smallScreen.value
    ? 'باز کردن منوی اصلی'
    : sidebarCollapsed.value
      ? 'نمایش کامل منو'
      : 'کوچک کردن منو',
)
let sidebarMedia: MediaQueryList | undefined
function syncSidebarViewport() {
  smallScreen.value = !!sidebarMedia?.matches
  if (!smallScreen.value) mobileOpen.value = false
}
function toggleNavigation() {
  if (smallScreen.value) mobileOpen.value = !mobileOpen.value
  else sidebarCollapsed.value = !sidebarCollapsed.value
}
onMounted(() => {
  sidebarMedia = window.matchMedia('(max-width: 820px)')
  syncSidebarViewport()
  sidebarMedia.addEventListener('change', syncSidebarViewport)
})
onUnmounted(() => sidebarMedia?.removeEventListener('change', syncSidebarViewport))
const alertsOpen = ref(false)
const alertsLoading = ref(false)
const alertsError = ref('')
const lowStock = ref<Product[]>([])
const navigation = [
  { to: '/', text: 'نمای کلی', icon: House },
  { to: '/products', text: 'کالاها و قیمت‌ها', icon: Package },
  { to: '/categories', text: 'مدیریت دسته‌بندی‌ها', icon: Tags },
  { to: '/transactions', text: 'گردش موجودی', icon: ArrowLeftRight },
  { to: '/invoices', text: 'فاکتورهای فروش', icon: Receipt },
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
  height: 100dvh;
  overflow: hidden;
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
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.sidebar.is-collapsed {
  width: 84px;
  flex-basis: 84px;
  padding-inline: 12px;
  scrollbar-gutter: auto;
}
.sidebar.is-collapsed .brand {
  justify-content: center;
  padding-inline: 0;
}
.sidebar.is-collapsed .nav-label,
.sidebar.is-collapsed .nav-dot {
  display: none;
}
.sidebar.is-collapsed .nav-link {
  justify-content: center;
  padding-inline: 12px;
}
.brand {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
}
.brand .store-logo {
  width: 104px;
}
.sidebar.is-collapsed .store-logo {
  width: 48px;
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
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.topbar {
  flex-shrink: 0;
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
  min-width: 0;
  font-size: 12px;
}
.topbar-page-actions {
  flex-shrink: 0;
  margin-inline-end: auto;
}
.topbar-page-actions:empty {
  display: none;
}
.topbar-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.topbar-actions,
.topbar-store,
.topbar-context > .icon-button {
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
.page-content > * {
  max-width: 1488px;
  margin-inline: auto;
}
.page-content {
  padding: 32px 36px 48px;
  margin: 0 auto;
}
.page-content.page-content--invoices {
  padding: 16px;
}
/* Let the invoice editor meet the content edges at every viewport size. */
.page-content.page-content--invoices:has(.invoice-editor) {
  padding: 0;
  margin: 0;
  scrollbar-gutter: auto;
}
@media screen {
  .page-content.page-content--invoices:has(.invoice-archive) {
    overflow: hidden;
  }
}
.page-content--invoices > * {
  max-width: none;
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
  max-height: min(560px, 80dvh, var(--reka-popover-content-available-height, 80dvh));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--popover);
  color: var(--foreground);
  box-shadow: var(--shadow-lg);
  direction: rtl;
}
.stock-popover__head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding-bottom: 12px;
}
.stock-popover__list {
  min-height: 0;
  max-height: 320px;
  overflow: auto;
  overscroll-behavior: contain;
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
  flex-shrink: 0;
  width: 100%;
  margin-top: 12px;
}
.menu-toggle {
  display: inline-grid;
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
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.mobile-sidebar nav {
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.mobile-sidebar__heading {
  flex-shrink: 0;
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
  .topbar--invoices {
    gap: 10px;
  }
  .topbar--invoices .topbar-store,
  .topbar--invoices .breadcrumb-arrow {
    display: none;
  }
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
@media (max-width: 600px) {
  .topbar--invoices {
    flex-wrap: wrap;
    gap: 8px;
    padding-block: 10px;
  }
  .topbar--invoices .topbar-page-actions {
    order: 3;
    width: 100%;
    margin: 0;
  }
  .topbar--invoices .topbar-page-actions > * {
    width: 100%;
  }
  .page-content.page-content--invoices {
    padding: 10px;
  }
}
</style>
