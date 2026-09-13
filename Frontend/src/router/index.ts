import { createRouter, createWebHistory } from 'vue-router'
import DashboardView from '@/views/DashboardView.vue'
import ProductsView from '@/views/ProductsView.vue'
import ProductFormView from '@/views/ProductFormView.vue'
import ProductDetailsView from '@/views/ProductDetailsView.vue'
import CategoriesView from '@/views/CategoriesView.vue'
import BulkPriceView from '@/views/BulkPriceView.vue'
import PlaceholderView from '@/views/PlaceholderView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: DashboardView, meta: { title: 'داشبورد' } },
    { path: '/products', component: ProductsView, meta: { title: 'محصولات' } },
    { path: '/products/new', component: ProductFormView, meta: { title: 'محصول جدید' } },
    { path: '/products/:id', component: ProductDetailsView, meta: { title: 'جزئیات محصول' } },
    { path: '/products/:id/edit', component: ProductFormView, meta: { title: 'ویرایش محصول' } },
    { path: '/bulk-price-update', component: BulkPriceView, meta: { title: 'تغییر گروهی قیمت' } },
    { path: '/categories', component: CategoriesView, meta: { title: 'دسته‌بندی‌ها' } },
    { path: '/inventory', component: PlaceholderView, meta: { title: 'موجودی و انبار', icon: '▣', description: 'ثبت ورود و خروج، تعدیل موجودی و مشاهده گردش کالا.' } },
    { path: '/transactions', component: PlaceholderView, meta: { title: 'تراکنش‌ها', icon: '↔', description: 'مدیریت خرید، فروش و اسناد مالی.' } },
    { path: '/reports', component: PlaceholderView, meta: { title: 'گزارش‌ها', icon: '◫', description: 'گزارش فروش، موجودی و تحلیل عملکرد.' } },
  ],
})

export default router
