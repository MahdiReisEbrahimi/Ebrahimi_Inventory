<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import { productsApi } from "@/services/products";
import { categoriesApi } from "@/services/categories";
import type { Category, Product } from "@/types";
const items = ref<Product[]>([]),
  categories = ref<Category[]>([]),
  loading = ref(false),
  total = ref(0);
const query = reactive({
  page: 1,
  limit: 20,
  search: "",
  categoryId: undefined as number | undefined,
  isActive: undefined as boolean | undefined,
  lowStock: undefined as boolean | undefined,
});
const money = (v: number) => new Intl.NumberFormat("fa-IR").format(v) + " تومان";
async function load() {
  loading.value = true;
  try {
    const r = await productsApi.list(query);
    items.value = r.data;
    total.value = r.meta.total;
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "خطا");
  } finally {
    loading.value = false;
  }
}
async function toggle(p: any) {
  try {
    await productsApi.status(p.id, !p.isActive);
    p.isActive = !p.isActive;
    ElMessage.success("وضعیت محصول تغییر کرد");
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : "خطا");
  }
}
async function remove(p: any) {
  try {
    await ElMessageBox.confirm(`حذف «${p.name}»؟`, "تأیید حذف");
    await productsApi.remove(p.id);
    await load();
    ElMessage.success("عملیات انجام شد");
  } catch {}
}
onMounted(async () => {
  await Promise.all([
    load(),
    categoriesApi
      .list()
      .then((r) => (categories.value = r))
      .catch(() => {}),
  ]);
});
</script>
<template>
  <div class="page-actions">
    <el-input
      v-model="query.search"
      placeholder="جست‌وجو در نام یا کد کالا"
      clearable
      @keyup.enter="load"
    /><el-select v-model="query.categoryId" placeholder="همه دسته‌ها" clearable
      ><el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" /></el-select
    ><el-select v-model="query.isActive" placeholder="وضعیت" clearable
      ><el-option label="فعال" :value="true" /><el-option
        label="غیرفعال"
        :value="false" /></el-select
    ><el-button @click="load">اعمال فیلتر</el-button
    ><router-link to="/bulk-price-update"><el-button>تغییر گروهی قیمت</el-button></router-link
    ><router-link to="/products/new"
      ><el-button type="primary">+ محصول جدید</el-button></router-link
    >
  </div>
  <el-card shadow="never"
    ><el-table :data="items" v-loading="loading" responsive
      ><el-table-column label="محصول" min-width="200"
        ><template #default="{ row }"
          ><router-link class="product-name" :to="`/products/${row.id}`">{{ row.name }}</router-link
          ><small>{{ row.sku }}</small></template
        ></el-table-column
      ><el-table-column label="دسته‌بندی" prop="category.name" /><el-table-column label="قیمت فروش"
        ><template #default="{ row }">{{ money(row.sellPrice) }}</template></el-table-column
      ><el-table-column label="موجودی"
        ><template #default="{ row }"
          ><span :class="{ danger: row.stock <= row.minStock }"
            >{{ row.stock }} {{ row.unit }}</span
          ></template
        ></el-table-column
      ><el-table-column label="وضعیت"
        ><template #default="{ row }"
          ><el-switch
            :model-value="row.isActive"
            @change="toggle(row)" /></template></el-table-column
      ><el-table-column label="عملیات" width="145"
        ><template #default="{ row }"
          ><router-link :to="`/products/${row.id}/edit`"
            ><el-button link type="primary">ویرایش</el-button></router-link
          ><el-button link type="danger" @click="remove(row)">حذف</el-button></template
        ></el-table-column
      ></el-table
    >
    <div class="pagination">
      <el-pagination
        v-model:current-page="query.page"
        :page-size="query.limit"
        layout="total, prev, pager, next"
        :total="total"
        @current-change="load"
      /></div
  ></el-card>
</template>
