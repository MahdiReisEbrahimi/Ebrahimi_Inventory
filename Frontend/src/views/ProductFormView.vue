<template>
  <div :class="embedded ? '' : 'page-stack'">
    <PageHeader
      v-if="!embedded"
      :title="editing ? 'ویرایش کالا' : 'ثبت کالای جدید'"
      description="اطلاعات کالا، قیمت‌ها و موجودی انبار را وارد کنید."
      eyebrow="کالاها و قیمت‌ها"
    />
    <form
      :id="formId"
      :class="embedded ? 'product-form' : 'product-form panel panel-body standalone-form'"
      @submit.prevent="submit"
    >
      <div v-if="loading" class="table-loading" role="status">در حال دریافت اطلاعات…</div>
      <div v-else-if="loadError" class="notice notice--error" role="alert">
        {{ loadError }}<Button variant="outline" @click="load">تلاش دوباره</Button>
      </div>
      <template v-else>
        <section class="form-section">
          <h3><Package :size="18" /> مشخصات کالا</h3>
          <div class="form-grid">
            <label class="form-field"
              ><span>نام کالا <small>الزامی و یکتا</small></span
              ><input
                v-model="form.name"
                required
                maxlength="200"
                placeholder="مثلاً شیر روشویی"
                autocomplete="off"
            /></label>
            <label class="form-field"
              ><span>دسته‌بندی <small>الزامی</small></span
              ><select v-model.number="form.categoryId" required>
                <option :value="undefined" disabled>انتخاب دسته‌بندی</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">
                  {{ c.name }}
                </option></select
              ><button type="button" class="inline-link" @click="addingCategory = !addingCategory">
                <Plus :size="14" />ثبت دسته‌بندی جدید
              </button></label
            >
            <label class="form-field"
              ><span>واحد شمارش</span
              ><input
                v-model="form.unit"
                required
                maxlength="50"
                placeholder="عدد، بسته، جعبه…"
              /><small>همان واحدی که در انبار و فاکتور استفاده می‌کنید.</small></label
            >
          </div>
          <div v-if="addingCategory" class="category-create">
            <label class="form-field"
              ><span>نام دسته‌بندی جدید</span
              ><input
                v-model="categoryName"
                maxlength="100"
                @keydown.enter.prevent="createCategory" /></label
            ><Button
              variant="outline"
              :disabled="categorySaving || !categoryName.trim()"
              @click="createCategory"
              >{{ categorySaving ? 'در حال ثبت…' : 'ثبت دسته‌بندی' }}</Button
            >
          </div>
        </section>
        <section class="form-section">
          <h3><Tags :size="18" /> قیمت و موجودی</h3>
          <div class="form-grid">
            <label class="form-field"
              ><span>قیمت خرید <small>تومان</small></span
              ><MoneyInput v-model="form.buyPrice" required dir="ltr"
            /></label>
            <label class="form-field"
              ><span>قیمت فروش <small>تومان</small></span
              ><MoneyInput v-model="form.sellPrice" required dir="ltr"
            /></label>
            <label class="form-field">
              <span>موجودی انبار</span>
              <input v-model.number="form.stock" type="number" min="0" step="1" required />
            </label>
            <label class="form-field"
              ><span>حداقل موجودی مورد نیاز</span
              ><input
                v-model.number="form.minStock"
                type="number"
                min="0"
                step="1"
                required
              /><small>در این مقدار یا کمتر، هشدار تأمین نمایش داده می‌شود.</small></label
            >
          </div>
        </section>

        <DialogActions>
          <Button variant="outline" @click="close(false)">انصراف</Button
          ><Button :form="formId" type="submit" :disabled="saving">{{
            saving ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ثبت کالا'
          }}</Button>
        </DialogActions>
      </template>
    </form>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref, useId } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Package, Plus, Tags } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { toast } from '@/lib/toast'
import { number, parseNumber } from '@/lib/format'
import { categoriesApi } from '@/services/categories'
import { productsApi } from '@/services/products'
import type { Category, Product } from '@/types'
const formId = useId()
const props = defineProps<{ editData?: Product; embedded?: boolean }>()
const emit = defineEmits<{ close: [saved: boolean] }>()
const route = useRoute(),
  router = useRouter()
const id = computed(
  () =>
    props.editData?.id ||
    (!props.embedded && route.params.id ? Number(route.params.id) : undefined),
)
const editing = computed(() => Boolean(id.value))
const categories = ref<Category[]>([]),
  loading = ref(true),
  saving = ref(false)
const loadError = ref(''),
  addingCategory = ref(false),
  categoryName = ref(''),
  categorySaving = ref(false)
const form = reactive({
  name: '',
  categoryId: undefined as number | undefined,
  unit: 'عدد',
  buyPrice: '0',
  sellPrice: '0',
  stock: 0,
  minStock: 0,
  description: '',
})
function assignProduct(p: Product) {
  Object.assign(form, {
    name: p.name,
    categoryId: p.categoryId,
    unit: p.unit,
    buyPrice: number(p.buyPrice),
    sellPrice: number(p.sellPrice),
    stock: p.stock,
    minStock: p.minStock,
    description: p.description || '',
  })
}
async function load() {
  loading.value = true
  loadError.value = ''
  try {
    categories.value = await categoriesApi.list()
    if (props.editData) assignProduct(props.editData)
    else if (id.value) assignProduct(await productsApi.get(id.value))
  } catch {
    loadError.value = 'دریافت اطلاعات فرم ممکن نشد.'
  } finally {
    loading.value = false
  }
}
function close(saved: boolean) {
  emit('close', saved)
  if (!props.embedded) void router.push('/products')
}
async function createCategory() {
  if (!categoryName.value.trim() || categorySaving.value) return
  categorySaving.value = true
  try {
    const category = await categoriesApi.create(categoryName.value.trim())
    categories.value.push(category)
    form.categoryId = category.id
    addingCategory.value = false
    categoryName.value = ''
    toast.success('دسته‌بندی ثبت شد.')
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ثبت دسته‌بندی انجام نشد.')
  } finally {
    categorySaving.value = false
  }
}
async function submit() {
  if (saving.value) return

  const buyPrice = parseNumber(form.buyPrice),
    sellPrice = parseNumber(form.sellPrice)
  if (!form.categoryId || !form.name.trim() || !form.unit.trim()) {
    toast.error('نام، واحد و دسته‌بندی کالا را تکمیل کنید.')
    return
  }
  if (
    ![buyPrice, sellPrice, form.stock, form.minStock].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 2147483647,
    )
  ) {
    toast.error('قیمت‌ها و موجودی باید عدد صحیح و غیرمنفی باشند.')
    return
  }
  saving.value = true
  try {
    const data = {
      ...form,
      name: form.name.trim(),
      unit: form.unit.trim(),
      buyPrice,
      sellPrice,
    }
    if (id.value) await productsApi.update(id.value, data)
    else await productsApi.create(data)
    toast.success(editing.value ? 'تغییرات کالا ذخیره شد.' : 'کالا و موجودی انبار ثبت شد.')
    close(true)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'ذخیره اطلاعات انجام نشد.')
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.product-form .form-grid {
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}
.product-form .form-field {
  gap: 5px;
}
.product-form input,
.product-form select {
  min-height: 38px;
  padding-block: 7px;
  padding-right: 11px;
  font-size: 12px;
  border-radius: 8px;
}
.product-form input {
  padding-left: 11px;
}
.product-form .form-section {
  gap: 12px;
}
.product-form .form-section + .form-section {
  padding-top: 16px;
}
.standalone-form {
  max-width: 860px;
}
.form-section h3 {
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-section h3 svg {
  color: var(--primary);
}
.inline-link {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  justify-self: start;
  background: none;
  border: 0;
  color: var(--primary);
  font-size: 11px;
  padding: 3px 0;
}
.category-create {
  display: flex;
  align-items: end;
  gap: 12px;
  padding: 16px;
  background: var(--muted);
  border-radius: 12px;
}
.category-create .form-field {
  flex: 1;
}
.product-form > .notice {
  margin-top: 18px;
}
</style>
