import { createRouter, createWebHistory } from 'vue-router'

const scrollPositions = new Map<string, { top: number; left: number }>()

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, _from, saved) {
    const content = document.getElementById('main-content')
    const position = saved ? scrollPositions.get(to.fullPath) : undefined
    content?.scrollTo(position || { top: 0, left: 0 })
    return false
  },
  routes: [
    {
      path: '/categories',
      component: () => import('@/views/CategoriesView.vue'),
      meta: { title: 'مدیریت دسته‌بندی‌ها' },
    },
    {
      path: '/',
      component: () => import('@/views/InventoryDashboardView.vue'),
      meta: { title: 'نمای کلی' },
    },
    {
      path: '/products',
      component: () => import('@/views/ProductsView.vue'),
      meta: { title: 'کالاها و قیمت‌ها' },
    },
    {
      path: '/products/new',
      component: () => import('@/views/ProductFormView.vue'),
      meta: { title: 'ثبت کالای جدید' },
    },
    {
      path: '/products/:id/edit',
      component: () => import('@/views/ProductFormView.vue'),
      meta: { title: 'ویرایش کالا' },
    },
    {
      path: '/transactions',
      component: () => import('@/views/TransactionsView.vue'),
      meta: { title: 'گردش موجودی' },
    },
    {
      path: '/invoices',
      component: () => import('@/views/InvoicesView.vue'),
      meta: { title: 'فاکتورهای فروش' },
    },
    {
      path: '/settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'تنظیمات ظاهر' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

router.beforeEach((_to, from) => {
  const content = document.getElementById('main-content')
  if (content) {
    scrollPositions.set(from.fullPath, { top: content.scrollTop, left: content.scrollLeft })
  }
})

export default router
