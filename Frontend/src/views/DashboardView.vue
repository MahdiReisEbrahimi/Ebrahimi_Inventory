<script setup lang="ts">
import { onMounted, ref } from "vue";
import { productsApi } from "@/services/products";
const total = ref("—"),
  low = ref("—");
onMounted(async () => {
  try {
    const all = await productsApi.list({ page: 1, limit: 100 });
    total.value = String(all.meta.total);
    low.value = String(all.data.filter((p) => p.stock <= p.minStock).length);
  } catch {
    total.value = "۰";
    low.value = "۰";
  }
});
</script>
<template>
  <div class="stats">
    <div class="stat">
      <span>▦</span>
      <div>
        <small>کل محصولات</small><b>{{ total }}</b>
      </div>
    </div>
    <div class="stat warning">
      <span>◉</span>
      <div>
        <small>نیازمند تأمین</small><b>{{ low }}</b>
      </div>
    </div>
    <div class="stat">
      <span>◈</span>
      <div><small>دسته‌بندی‌ها</small><b>—</b></div>
    </div>
    <div class="stat">
      <span>↗</span>
      <div><small>فروش امروز</small><b>—</b></div>
    </div>
  </div>
  <section class="empty-panel">
    <div class="empty-icon">▦</div>
    <h2>نمای کلی کسب‌وکار</h2>
    <p>
      آمار زندهٔ محصولات از API دریافت می‌شود. گزارش فروش و گردش انبار پس از آماده‌شدن سرویس‌های
      مربوطه اینجا نمایش داده خواهد شد.
    </p>
    <router-link to="/products"><el-button type="primary">مشاهده محصولات</el-button></router-link>
  </section>
</template>
