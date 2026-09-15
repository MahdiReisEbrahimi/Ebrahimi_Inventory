<template>
  <div v-if="categoryTitle" class="selected-category">
    <span>دسته‌بندی انتخاب‌شده</span>
    <el-tag type="primary" effect="dark" size="large">{{ categoryTitle }}</el-tag>
  </div>
  <el-alert v-if="categoryTitle" class="category-filter-alert" type="info" :closable="false">
    <template #title>کالاهای دسته‌بندی «{{ categoryTitle }}»</template>
    <template #default> <router-link to="/products">نمایش همه کالاها</router-link> </template>
  </el-alert>
  <div class="page-actions">
    <div class="filters">
      <el-input
        v-model="query.search"
        class="filter-item"
        placeholder="جست‌وجو در نام یا کد کالا"
        clearable
      >
        <i slot="prefix" class="el-icon-search"></i>
      </el-input>

      <el-select v-model="query.categoryId" class="filter-item" placeholder="همه دسته‌ها" clearable>
        <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
      </el-select>

      <el-select v-model="query.isActive" class="filter-item" placeholder="همه وضعیت‌ها" clearable>
        <el-option label="فعال" :value="true" />
        <el-option label="غیرفعال" :value="false" />
      </el-select>
    </div>

    <div class="actions">
      <el-button class="bulk-price-btn" @click="showDialogs.bulkPriceUpdate = true">
        <i class="el-icon-money"></i>
        تغییر گروهی قیمت
      </el-button>

      <el-button type="primary" class="new-product-btn" @click="showDialogs.newProduct = true">
        <i class="el-icon-plus"></i>
        محصول جدید
      </el-button>
    </div>
  </div>
  <el-table
    stripe
    border
    :header-cell-style="{ background: '#f5f7fa', height: '60px' }"
    align="center"
    dir="rtl"
    :data="paginatedItems"
    v-loading="loading"
    style="width: 100%"
  >
    <el-table-column type="index" width="50" align="center" label="ردیف" />
    <el-table-column width="200" align="center" label="محصول">
      <template #default="{ row }">
        <div style="font-weight: bold">{{ row.name }}</div>
        <small>{{ row.sku }}</small>
      </template>
    </el-table-column>
    <el-table-column align="center" label="دسته‌بندی" prop="category.name" />
    <el-table-column width="150" align="center" label="قیمت فروش (تومان)">
      <template #default="{ row }">{{ money(row.sellPrice) }} </template>
    </el-table-column>
    <el-table-column align="center" label="موجودی">
      <template #default="{ row }">
        <span :class="{ danger: row.stock <= row.minStock }">{{ row.stock }} {{ row.unit }}</span>
      </template>
    </el-table-column>
    <el-table-column align="center" label="وضعیت">
      <template #default="{ row }">
        <el-switch :model-value="row.isActive" @change="toggle(row)" />
      </template>
    </el-table-column>
    <el-table-column min-width="200" align="center" label="عملیات">
      <template #default="{ row }">
        <el-tooltip
          v-for="action in actions"
          :key="action.tooltip"
          :content="action.hint"
          trigger="hover"
        >
          <el-button
            @click="action.handler(row)"
            style="margin: 0px 2px; width: 32px; height: 32px"
            :type="action.type"
            circle
          >
            <el-icon> <component :is="action.icon" /> </el-icon>
          </el-button>
        </el-tooltip>
      </template>
    </el-table-column>
  </el-table>
  <div class="pagination" style="direction: ltr; text-align: center">
    <el-pagination
      v-model:current-page="query.page"
      v-model:page-size="query.limit"
      :total="total"
      :page-sizes="[10, 20, 50, 100]"
      layout="total, sizes, prev, pager, next"
      @size-change="query.page = 1"
    />
  </div>
  <el-dialog
    v-for="dialog in dialogs"
    :key="dialog.title"
    v-model="showDialogs[dialog.model]"
    :title="dialog.title"
    :width="dialog.width"
    :max-width="300"
    align-center
    destroy-on-close
  >
    <component :is="dialog.component" v-bind="dialog.props" v-on="dialog.emits" />
  </el-dialog>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { productsApi } from '@/services/products'
import { categoriesApi } from '@/services/categories'
import type { Category, Product } from '@/types'
import { Delete, Edit, View } from '@element-plus/icons-vue'
import DeleteProductDialog from '@/components/dialogs/DeleteProductDialog.vue'
import ProductFormView from './ProductFormView.vue'
import ProductDetailsDialog from '@/components/dialogs/ProductDetailsDialog.vue'
import { computed, onMounted, reactive, ref, watch } from 'vue'
import BulkPriceView from './BulkPriceView.vue'

const filteredItems = computed(() => {
  let result = [...items.value]

  if (query.search.trim()) {
    const search = query.search.trim().toLowerCase()

    result = result.filter((item) => {
      return item.name?.toLowerCase().includes(search) || item.sku?.toLowerCase().includes(search)
    })
  }

  if (query.categoryId !== undefined) {
    result = result.filter((item) => item.categoryId === query.categoryId)
  }

  if (query.isActive !== undefined) {
    result = result.filter((item) => item.isActive === query.isActive)
  }

  if (query.lowStock !== undefined) {
    result = result.filter((item) => {
      const isLowStock = item.stock <= item.minStock

      return query.lowStock ? isLowStock : !isLowStock
    })
  }

  return result
})

const paginatedItems = computed(() => {
  const start = (query.page - 1) * query.limit
  const end = start + query.limit

  return filteredItems.value.slice(start, end)
})

const total = computed(() => filteredItems.value.length)
const items = ref<Product[]>([])
const categories = ref<Category[]>([])
const loading = ref(false)
const selectedRow = ref(null)
const query = reactive({
  page: 1,
  limit: 10,
  search: '',
  categoryId: undefined as number | undefined,
  isActive: undefined as boolean | undefined,
  lowStock: undefined as boolean | undefined,
})
const showDialogs = reactive({
  editProduct: false,
  deleteProduct: false,
  newProduct: false,
  moreInfo: false,
  bulkPriceUpdate: false,
})

const dialogs = reactive([
  {
    title: 'حذف محصول',
    model: 'deleteProduct',
    width: '400',
    component: DeleteProductDialog,
    emits: {
      close: async (status: boolean) => {
        if (status) await load()
        showDialogs.deleteProduct = false
      },
    },
    props: {
      selectedRow,
    },
  },
  {
    title: 'محصول جدید',
    model: 'newProduct',
    width: '700',
    maxWidth: '700',
    component: ProductFormView,
    emits: {
      close: async (status: boolean) => {
        if (status) await load()
        showDialogs.newProduct = false
      },
    },
  },
  {
    title: 'ویرایش محصول',
    model: 'editProduct',
    width: '700',
    maxWidth: '700',
    component: ProductFormView,
    emits: {
      close: async (status: boolean) => {
        if (status) await load()
        showDialogs.editProduct = false
      },
    },
    props: {
      editData: selectedRow,
    },
  },
  {
    title: 'اطلاعات محصول',
    model: 'moreInfo',
    width: '700',
    maxWidth: '700',
    component: ProductDetailsDialog,
    props: {
      selectedRow: selectedRow,
    },
    emits: {
      close: async (status: boolean) => {
        if (status) await load()
        showDialogs.editProduct = false
      },
    },
  },
  {
    title: 'تغییر قیمت گروهی',
    model: 'bulkPriceUpdate',
    width: '800',
    maxWidth: '800',
    component: BulkPriceView,
    props: {
      selectedRow: selectedRow,
    },
    emits: {
      close: async (status: boolean) => {
        if (status) await load()
        showDialogs.bulkPriceUpdate = false
      },
    },
  },
])

const actions = reactive([
  {
    hint: 'ویرایش',
    icon: Edit,
    type: 'success',
    handler: (row: any) => {
      selectedRow.value = row
      showDialogs.editProduct = true
    },
  },
  {
    hint: 'حذف',
    icon: Delete,
    type: 'danger',
    handler: (row: any) => {
      selectedRow.value = row
      showDialogs.deleteProduct = true
    },
  },
  {
    hint: 'اطلاعات بیشتر',
    icon: View,
    type: 'info',
    handler: (row: any) => {
      selectedRow.value = row
      console.log(selectedRow.value)
      showDialogs.moreInfo = true
    },
  },
])
const route = useRoute()
const categoryTitle = ref('')
const money = (v: number) => new Intl.NumberFormat('fa-IR').format(v)

async function load() {
  loading.value = true

  try {
    const r = await productsApi.list({
      page: 1,
      limit: 10000,
    })

    items.value = r.data
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا در دریافت محصولات')
  } finally {
    loading.value = false
  }
}

async function toggle(p: any) {
  try {
    await productsApi.status(p.id, !p.isActive)
    p.isActive = !p.isActive
    ElMessage.success('وضعیت محصول تغییر کرد')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا')
  }
}

onMounted(async () => {
  const categoryId = Number(route.query.categoryId)
  if (Number.isInteger(categoryId) && categoryId > 0) {
    query.categoryId = categoryId
    categoryTitle.value = String(route.query.categoryName ?? '')
  }
  await Promise.all([
    load(),
    categoriesApi
      .list()
      .then((r) => (categories.value = r))
      .catch(() => {}),
  ])
})

watch(
  () => route.query.categoryId,
  (categoryId) => {
    query.categoryId = categoryId ? Number(categoryId) : undefined

    categoryTitle.value = String(route.query.categoryName ?? '')

    query.page = 1
  },
)

watch(
  () => [query.search, query.categoryId, query.isActive, query.lowStock],
  () => {
    query.page = 1
  },
)
</script>
<style scoped>
.page-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 16px 18px;
  margin-bottom: 20px;
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, #ebeef5);
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.filter-item {
  min-width: 200px !important;
  height: 40px !important;
}
::v-deep .el-select__wrapper{
  height: 40px !important;
}

.page-actions .el-input,
.page-actions .el-select {
  height: 40px;
}

.page-actions .el-input /deep/ .el-input__inner,
.page-actions .el-select /deep/ .el-input__inner {
  border-radius: 8px;
}

.page-actions .el-button {
  height: 40px;
  border-radius: 8px;
  font-weight: 500;
}

.bulk-price-btn {
  color: #409eff;
  border-color: #d9ecff;
  background: #f0f8ff;
}

.new-product-btn {
  min-width: 125px;
}

/* Responsive */
@media (max-width: 1100px) {
  .page-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .filters {
    width: 100%;
  }

  .actions {
    justify-content: flex-start;
  }
}

@media (max-width: 700px) {
  .filters {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input,
  .filter-select {
    width: 100%;
  }

  .actions {
    width: 100%;
  }

  .actions .el-button {
    flex: 1;
  }
}
</style>
