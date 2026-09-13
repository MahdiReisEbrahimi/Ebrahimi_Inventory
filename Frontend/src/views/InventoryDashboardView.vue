<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { categoriesApi } from '@/services/categories'
import type { Category } from '@/types'

const router = useRouter()
const categories = ref<Category[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const newCategoryName = ref('')
const saving = ref(false)

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

async function createCategory() {
  if (!newCategoryName.value.trim()) return
  saving.value = true
  try {
    await categoriesApi.create(newCategoryName.value.trim())
    newCategoryName.value = ''
    dialogVisible.value = false
    await loadCategories()
    ElMessage.success('دسته‌بندی جدید ایجاد شد.')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'ایجاد دسته‌بندی ناموفق بود.')
  } finally {
    saving.value = false
  }
}

async function removeCategory(category: Category, event: MouseEvent) {
  event.stopPropagation()
  try {
    await ElMessageBox.confirm(`دسته‌بندی «${category.name}» حذف شود؟`, 'تأیید حذف', {
      type: 'warning',
    })
    await categoriesApi.remove(category.id)
    await loadCategories()
    ElMessage.success('دسته‌بندی حذف شد.')
  } catch {
    // The user cancelled the confirmation or the API rejected the deletion.
  }
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
      <el-button type="primary" @click="dialogVisible = true">+ دسته‌بندی جدید</el-button>
    </div>
    <el-skeleton v-if="loading" :rows="5" animated />
    <div v-else-if="categories.length" class="category-cards">
      <article
        v-for="category in categories"
        :key="category.id"
        class="category-card"
        role="button"
        tabindex="0"
        @click="showProducts(category)"
        @keydown.enter="showProducts(category)"
      >
        <span class="category-card__icon">◈</span
        ><span
          ><b>{{ category.name }}</b
          ><small>مشاهده کالاهای این دسته</small></span
        ><el-button
          class="category-delete"
          link
          type="danger"
          aria-label="حذف دسته‌بندی"
          @click="removeCategory(category, $event)"
          >حذف</el-button
        ><i>‹</i>
      </article>
    </div>
    <section v-else class="empty-panel">
      <div class="empty-icon">◈</div>
      <h2>دسته‌بندی ثبت نشده است</h2>
      <p>برای شروع، اولین دسته‌بندی کالا را ایجاد کنید.</p>
      <el-button type="primary" @click="dialogVisible = true">ایجاد دسته‌بندی</el-button>
    </section>
    <el-dialog v-model="dialogVisible" title="دسته‌بندی جدید" width="420"
      ><el-input
        v-model="newCategoryName"
        placeholder="مثلاً شیرآلات"
        @keyup.enter="createCategory"
      /><template #footer
        ><el-button @click="dialogVisible = false">انصراف</el-button
        ><el-button
          type="primary"
          :loading="saving"
          :disabled="!newCategoryName.trim()"
          @click="createCategory"
          >ایجاد دسته‌بندی</el-button
        ></template
      ></el-dialog
    >
  </section>
</template>
