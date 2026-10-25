<template>
  <div class="page-stack">
    <PageHeader
      title="گزارش‌های فروشگاه"
      description="فضایی برای شناخت بهتر موجودی و عملکرد فروش."
      eyebrow="گزارش‌ها"
    />
    <section class="panel reports-placeholder">
      <div class="report-symbol"><ChartNoAxesColumn :size="40" :stroke-width="1.4" /></div>
      <span class="badge">در حال توسعه</span>
      <h2>تصویر روشن‌تری از فروشگاه شما</h2>
      <p>
        گزارش‌های تحلیلی هنوز آماده نیستند. در حال حاضر می‌توانید گردش کالا و فاکتورهای ثبت‌شده را
        بررسی کنید.
      </p>
      <div class="report-links">
        <RouterLink to="/transactions" class="button button--primary"
          >مشاهده گردش موجودی<ArrowLeft :size="16" /></RouterLink
        ><RouterLink to="/invoices" class="button button--outline">فاکتورهای فروش</RouterLink>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { ArrowLeft, ChartNoAxesColumn } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
</script>
<style scoped>
.reports-placeholder {
  display: grid;
  justify-items: center;
  text-align: center;
  padding: 70px 24px;
}
.report-symbol {
  display: grid;
  place-items: center;
  width: 90px;
  height: 90px;
  background: var(--accent);
  color: var(--primary);
  border-radius: 27px;
  margin-bottom: 24px;
}
.reports-placeholder h2 {
  margin: 20px 0 12px;
  font-size: 24px;
}
.reports-placeholder p {
  max-width: 430px;
  color: var(--muted-foreground);
  font-size: 13px;
  line-height: 2;
}
.report-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin-top: 20px;
}
</style>
