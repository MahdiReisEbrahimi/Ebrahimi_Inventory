<template>
  <div class="page-stack categories-page">
    <PageHeader title="مدیریت دسته‌بندی‌ها">
      <RouterLink to="/products" class="button button--outline">
        <Package :size="17" />کالاها و قیمت‌ها
      </RouterLink>
      <Button @click="openForm()"><Plus :size="18" />دسته‌بندی جدید</Button>
    </PageHeader>

    <section class="panel">
      <div class="filter-bar">
        <label class="search-field">
          <Search :size="18" />
          <input
            v-model="search"
            type="search"
            placeholder="جست‌وجوی نام دسته‌بندی…"
            aria-label="جست‌وجوی دسته‌بندی"
          />
        </label>
        <span v-if="!loading && !error" class="muted"
          >{{ number(categories.length) }} دسته‌بندی</span
        >
        <Button
          variant="ghost"
          size="icon"
          aria-label="دریافت دوباره دسته‌بندی‌ها"
          :disabled="loading"
          @click="load"
        >
          <RefreshCw :size="18" />
        </Button>
      </div>
      <p class="category-notice muted">فقط دسته‌بندی‌هایی که هیچ کالایی ندارند قابل حذف هستند.</p>
    </section>

    <div v-if="loading" class="panel table-loading" role="status">در حال دریافت دسته‌بندی‌ها…</div>
    <EmptyState
      v-else-if="error"
      class="panel"
      title="دریافت دسته‌بندی‌ها ممکن نشد"
      :description="error"
      error
    >
      <Button variant="outline" @click="load">تلاش دوباره</Button>
    </EmptyState>
    <div v-else-if="filtered.length" class="category-grid">
      <article v-for="category in filtered" :key="category.id" class="panel category-card">
        <div class="category-card__heading">
          <span class="category-mark"><Tags :size="24" /></span>
          <h2>{{ category.name }}</h2>
        </div>
        <p class="category-count">
          <b>{{ number(category._count?.products ?? 0) }}</b> کالای ثبت‌شده
        </p>
        <RouterLink
          :to="{ path: '/products', query: { categoryId: category.id } }"
          class="category-products"
          >مشاهده کالاها<ArrowLeft :size="16"
        /></RouterLink>
        <div class="category-card__actions">
          <Button variant="outline" size="sm" @click="openForm(category)">
            <Pencil :size="16" />ویرایش
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="danger"
            :disabled="category._count?.products !== 0"
            :title="
              category._count?.products !== 0
                ? 'دسته‌بندی دارای کالا قابل حذف نیست.'
                : 'حذف دسته‌بندی'
            "
            :aria-label="'حذف دسته‌بندی ' + category.name"
            @click="openDelete(category)"
            ><Trash2 :size="16" />حذف</Button
          >
        </div>
        <small class="category-delete-hint muted">
          {{
            category._count?.products !== 0
              ? 'برای حذف، ابتدا کالاهای این دسته‌بندی را منتقل کنید.'
              : 'این دسته‌بندی کالا ندارد و قابل حذف است.'
          }}
        </small>
      </article>
    </div>
    <EmptyState
      v-else
      class="panel"
      :title="search.trim() ? 'دسته‌بندی پیدا نشد' : 'هنوز دسته‌بندی ثبت نشده است'"
      :description="
        search.trim() ? 'عبارت جست‌وجو را تغییر دهید.' : 'اولین دسته‌بندی کالاهای خود را ثبت کنید.'
      "
    >
      <Button v-if="!search.trim()" @click="openForm()">ثبت دسته‌بندی جدید</Button>
    </EmptyState>

    <AppDialog
      :open="formOpen"
      :title="editing ? 'ویرایش دسته‌بندی' : 'ثبت دسته‌بندی جدید'"
      width="460px"
      @update:open="setFormOpen"
    >
      <form :id="categoryFormId" class="category-form" :aria-busy="saving" @submit.prevent="save">
        <label class="form-field">
          <span>نام دسته‌بندی <small>الزامی</small></span>
          <input
            v-model="name"
            required
            maxlength="100"
            autocomplete="off"
            placeholder="مثلاً شیرآلات"
            :disabled="saving"
          />
          <small>حداکثر ۱۰۰ کاراکتر؛ نام دسته‌بندی باید یکتا باشد.</small>
        </label>

        <DialogActions>
          <Button variant="outline" :disabled="saving" @click="setFormOpen(false)">انصراف</Button>
          <Button :form="categoryFormId" type="submit" :disabled="saving || !name.trim()">{{
            saving ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ثبت دسته‌بندی'
          }}</Button>
        </DialogActions>
      </form>
    </AppDialog>
    <AppDialog :open="deleteOpen" title="حذف دسته‌بندی" width="440px" @update:open="setDeleteOpen">
      <form :id="deleteFormId" class="category-form" :aria-busy="deleting" @submit.prevent="remove">
        <p>دسته‌بندی «{{ deletingCategory?.name }}» حذف شود؟</p>
        <p class="muted">حذف فقط در صورت نداشتن کالا انجام می‌شود.</p>

        <DialogActions>
          <Button variant="outline" :disabled="deleting" @click="setDeleteOpen(false)"
            >انصراف</Button
          >
          <Button
            :form="deleteFormId"
            type="submit"
            variant="destructive"
            :disabled="deleting || deletingCategory?._count?.products !== 0"
          >
            {{ deleting ? 'در حال حذف…' : 'تأیید حذف' }}
          </Button>
        </DialogActions>
      </form>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import { ArrowLeft, Package, Pencil, Plus, RefreshCw, Search, Tags, Trash2 } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import AppDialog from '@/components/ui/AppDialog.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import { categoriesApi } from '@/services/categories'
import { number } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Category } from '@/types'

const categoryFormId = useId()
const deleteFormId = useId()
const categories = ref<Category[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const filtered = computed(() =>
  categories.value.filter((category) =>
    category.name.toLocaleLowerCase('fa').includes(search.value.trim().toLocaleLowerCase('fa')),
  ),
)
const formOpen = ref(false)
const editing = ref<Category | null>(null)
const name = ref('')
const saving = ref(false)
const deleteOpen = ref(false)
const deletingCategory = ref<Category | null>(null)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    categories.value = await categoriesApi.list()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'اتصال به سرور را بررسی کنید.'
  } finally {
    loading.value = false
  }
}
function openForm(category?: Category) {
  editing.value = category ?? null
  name.value = category?.name ?? ''

  formOpen.value = true
}
function setFormOpen(open: boolean) {
  if (!saving.value) formOpen.value = open
}
async function save() {
  if (saving.value || !name.value.trim()) return
  saving.value = true

  try {
    const current = editing.value
    const saved = current
      ? await categoriesApi.update(current.id, name.value.trim())
      : await categoriesApi.create(name.value.trim())
    const category = { ...saved, _count: current?._count ?? { products: 0 } }
    categories.value = [...categories.value.filter((item) => item.id !== saved.id), category].sort(
      (a, b) => a.name.localeCompare(b.name, 'fa'),
    )
    formOpen.value = false
    toast.success(current ? 'دسته‌بندی ویرایش شد.' : 'دسته‌بندی جدید ثبت شد.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ذخیره دسته‌بندی انجام نشد.')
  } finally {
    saving.value = false
  }
}
function openDelete(category: Category) {
  if (category._count?.products !== 0) return
  deletingCategory.value = category

  deleteOpen.value = true
}
function setDeleteOpen(open: boolean) {
  if (!deleting.value) deleteOpen.value = open
}
async function remove() {
  const category = deletingCategory.value
  if (!category || category._count?.products !== 0 || deleting.value) return
  deleting.value = true

  try {
    await categoriesApi.remove(category.id)
    categories.value = categories.value.filter((item) => item.id !== category.id)
    deleteOpen.value = false
    toast.success('دسته‌بندی حذف شد.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'حذف دسته‌بندی انجام نشد.')
    await load()
    deletingCategory.value = categories.value.find((item) => item.id === category.id) ?? category
  } finally {
    deleting.value = false
  }
}
onMounted(load)
</script>

<style scoped>
.categories-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: auto auto minmax(0, 1fr);
}
.categories-page > .panel {
  min-height: 0;
}

.category-grid {
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  scrollbar-gutter: stable;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr));
  gap: 12px;
}
.category-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.category-card__heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.category-card h2 {
  margin: 0;
  font-size: 15px;
}
.category-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--accent);
  color: var(--primary);
}
.category-count {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 12px;
}
.category-count b {
  color: var(--foreground);
  font-size: 22px;
  margin-inline-end: 6px;
}
.category-products {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 8px;
  color: var(--primary);
  font-size: 12px;
}
.category-products:hover {
  text-decoration: underline;
}
.category-card__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-top: auto;
}
.category-delete-hint {
  font-size: 11px;
}
.category-notice {
  margin: 0;
  padding: 12px 20px;
  font-size: 12px;
}
.category-form {
  display: grid;
  gap: 18px;
}
.category-form p {
  margin: 0;
}
.category-form .form-actions {
  margin-top: 0;
}
</style>
