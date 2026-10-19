import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/InventoryDashboardView.vue'
import ProductsView from '@/views/ProductsView.vue'
import ProductFormView from '@/views/ProductFormView.vue'
import BulkPriceView from '@/views/BulkPriceView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'
import InventoryView from '@/views/InventoryView.vue'
import InvoicesView from '@/views/InvoicesView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: DashboardView, meta: { title: 'داشبورد' } },
    { path: '/products', component: ProductsView, meta: { title: 'محصولات' } },
    { path: '/products/new', component: ProductFormView, meta: { title: 'محصول جدید' } },
    { path: '/products/:id/edit', component: ProductFormView, meta: { title: 'ویرایش محصول' } },
    {
      path: '/inventory',
      component: InventoryView,
      meta: {
        title: 'موجودی و انبار',
        icon: '▣',
        description: 'ثبت ورود و خروج، تعدیل موجودی و مشاهده گردش کالا.',
      },
    },
    {
      path: '/transactions',
      component: InventoryView,
      meta: { title: 'تراکنش‌ها', icon: '↔', description: 'مدیریت خرید، فروش و اسناد مالی.' },
    },
    { path: '/invoices', component: InvoicesView, meta: { title: 'فاکتور فروش' } },
    {
      path: '/reports',
      component: PlaceholderView,
      meta: { title: 'گزارش‌ها', icon: '◫', description: 'گزارش فروش، موجودی و تحلیل عملکرد.' },
    },
  ],
})

export default router
