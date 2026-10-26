<template>
  <div :class="embedded ? '' : 'page-stack'">
    <PageHeader
      v-if="!embedded"
      :title="editing ? 'ویرایش کالا' : 'ثبت کالای جدید'"
      description="اطلاعات پایه و قیمت را وارد کنید؛ موجودی از بخش ورود کالا ثبت می‌شود."
      eyebrow="کالاها و قیمت‌ها"
    />
    <form
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
            <label class="form-field"
              ><span>حداقل موجودی</span
              ><input
                v-model.number="form.minStock"
                type="number"
                min="0"
                step="1"
                required
              /><small>در این مقدار یا کمتر، هشدار تأمین نمایش داده می‌شود.</small></label
            >
            <div class="notice">
              <Info :size="18" /><span
                >برای تغییر تعداد موجودی، از بخش «ورود و مرجوعی کالا» استفاده کنید.</span
              >
            </div>
          </div>
        </section>
        <section class="form-section">
          <label class="form-field"
            ><span>توضیحات <small>اختیاری</small></span
            ><textarea
              v-model="form.description"
              rows="3"
              placeholder="اطلاعات تکمیلی درباره کالا…"
            />
          </label>
        </section>
        <p v-if="formError" class="notice notice--error" role="alert">{{ formError }}</p>
        <div class="form-actions">
          <Button variant="outline" @click="close(false)">انصراف</Button
          ><Button type="submit" :disabled="saving">{{
            saving ? 'در حال ذخیره…' : editing ? 'ذخیره تغییرات' : 'ثبت کالا'
          }}</Button>
        </div>
      </template>
    </form>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Info, Package, Plus, Tags } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import { toast } from '@/lib/toast'
import { number, parseNumber } from '@/lib/format'
import { categoriesApi } from '@/services/categories'
import { productsApi } from '@/services/products'
import type { Category, Product } from '@/types'
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
  formError = ref(''),
  addingCategory = ref(false),
  categoryName = ref(''),
  categorySaving = ref(false)
const form = reactive({
  name: '',
  categoryId: undefined as number | undefined,
  unit: 'عدد',
  buyPrice: '0',
  sellPrice: '0',
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
  formError.value = ''
  const buyPrice = parseNumber(form.buyPrice),
    sellPrice = parseNumber(form.sellPrice)
  if (!form.categoryId || !form.name.trim() || !form.unit.trim()) {
    formError.value = 'نام، واحد و دسته‌بندی کالا را تکمیل کنید.'
    return
  }
  if (
    ![buyPrice, sellPrice, form.minStock].every(
      (v) => Number.isInteger(v) && v >= 0 && v <= 2147483647,
    )
  ) {
    formError.value = 'قیمت‌ها و حداقل موجودی باید عدد صحیح و غیرمنفی باشند.'
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
    toast.success(
      editing.value
        ? 'تغییرات کالا ذخیره شد.'
        : 'کالا ثبت شد. اکنون می‌توانید موجودی آن را وارد کنید.',
    )
    close(true)
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'ذخیره اطلاعات انجام نشد.'
  } finally {
    saving.value = false
  }
}
onMounted(load)
</script>
<style scoped>
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
