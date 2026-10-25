import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(_to, _from, saved) {
    return saved || { top: 0 }
  },
  routes: [
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
      path: '/inventory',
      component: () => import('@/views/InventoryView.vue'),
      meta: { title: 'ورود و مرجوعی کالا' },
    },
    {
      path: '/transactions',
      component: () => import('@/views/InventoryView.vue'),
      meta: { title: 'گردش موجودی' },
    },
    {
      path: '/invoices',
      component: () => import('@/views/InvoicesView.vue'),
      meta: { title: 'فاکتورهای فروش' },
    },
    {
      path: '/reports',
      component: () => import('@/views/PlaceholderView.vue'),
      meta: { title: 'گزارش‌ها' },
    },
    {
      path: '/settings',
      component: () => import('@/views/SettingsView.vue'),
      meta: { title: 'تنظیمات ظاهر' },
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

export default router
