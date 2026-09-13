<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { categoriesApi } from '@/services/categories'
import type { Category } from '@/types'

const router = useRouter()
const categories = ref<Category[]>([])
const loading = ref(false)

async function loadCategories() {
  loading.value = true
  try {
    categories.value = await categoriesApi.list()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'دریافت دسته‌بندی‌ها ناموفق بود.')
  } finally {
    loading.value = false
  }
}

function showProducts(category: Category) {
  router.push({
    path: '/products',
    query: { categoryId: String(category.id), categoryName: category.name },
  })
}

onMounted(loadCategories)
</script>

<template>
  <section class="categories-dashboard">
    <div class="section-header">
      <div>
        <h2>دسته‌بندی‌های کالا</h2>
        <p>برای نمایش کالاهای هر دسته، روی آن کلیک کنید.</p>
      </div>
      <router-link to="/categories"><el-button>مدیریت دسته‌بندی‌ها</el-button></router-link>
    </div>
    <el-skeleton v-if="loading" :rows="5" animated />
    <div v-else-if="categories.length" class="category-cards">
      <button
        v-for="category in categories"
        :key="category.id"
        class="category-card"
        @click="showProducts(category)"
      >
        <span class="category-card__icon">◈</span
        ><span
          ><b>{{ category.name }}</b
          ><small>مشاهده کالاهای این دسته</small></span
        ><i>‹</i>
      </button>
    </div>
    <section v-else class="empty-panel">
      <div class="empty-icon">◈</div>
      <h2>دسته‌بندی ثبت نشده است</h2>
      <p>برای شروع، اولین دسته‌بندی کالا را ایجاد کنید.</p>
      <router-link to="/categories"
        ><el-button type="primary">ایجاد دسته‌بندی</el-button></router-link
      >
    </section>
  </section>
</template>
