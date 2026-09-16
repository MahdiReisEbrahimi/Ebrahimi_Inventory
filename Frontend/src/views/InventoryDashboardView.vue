<template>
  <section class="warehouse-dashboard" dir="rtl">
    <section class="stat-row" aria-label="آمار کلیدی انبار">
      <article v-for="stat in stats" :key="stat.id" class="stat-card" :class="stat.tone">
        <div class="stat-card__text">
          <span class="stat-card__label">{{ stat.label }}</span>
          <span class="stat-card__value">
            {{ stat.value }}
            <small v-if="stat.unit">{{ stat.unit }}</small>
          </span>
        </div>
        <div class="chart-slot chart-slot--mini" role="img" aria-label="جای نمودار روند کوچک">
          <svg viewBox="0 0 24 24" class="chart-slot__icon">
            <path d="M4 19h2v-6H4v6Zm7 0h2V9h-2v10Zm7 0h2V4h-2v15Z" />
          </svg>
        </div>
      </article>
    </section>

    <section class="panel-row">
      <article class="chart-panel chart-panel--wide">
        <div class="chart-panel__header">
          <h2>روند موجودی در ۳۰ روز اخیر</h2>
          <p>نمودار خطی ورود/خروج کالا</p>
        </div>
        <div class="chart-slot chart-slot--large" role="img" aria-label="جای نمودار روند موجودی">
          <svg viewBox="0 0 24 24" class="chart-slot__icon">
            <path d="M3 17.25 8.5 11l4 3 7.5-8.5" fill="none" stroke-width="1.6" />
          </svg>
          <span>نمودار روند اینجا قرار می‌گیرد</span>
        </div>
      </article>

      <article class="chart-panel">
        <div class="chart-panel__header">
          <h2>پرمصرف‌ترین کالاها</h2>
          <p>بر اساس تعداد خروج از انبار</p>
        </div>
        <div class="chart-slot chart-slot--large" role="img" aria-label="جای نمودار میله‌ای کالاها">
          <svg viewBox="0 0 24 24" class="chart-slot__icon">
            <path d="M4 19h2v-6H4v6Zm7 0h2V9h-2v10Zm7 0h2V4h-2v15Z" />
          </svg>
          <span>نمودار میله‌ای اینجا قرار می‌گیرد</span>
        </div>
      </article>
    </section>
  </section>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

const loading = ref(false)
const dialogVisible = ref(false)
const newCategoryName = ref('')
const saving = ref(false)

// TODO: این چند مقدار placeholder هستن — بعداً به API واقعی آمار انبار وصل شوند.
const stats = ref([
  { id: 'items', label: 'کل اقلام موجود', value: '—', unit: '' },
  { id: 'value', label: 'ارزش کل موجودی', value: '—', unit: 'تومان' },
  { id: 'low', label: 'کسری موجودی', value: '—', unit: 'قلم', tone: 'danger' },
  { id: 'tx', label: 'تراکنش‌های امروز', value: '—', unit: '' },
])
</script>
<style scoped>
.warehouse-dashboard {
  --surface: #ffffff;
  --ink: #1b211f;
  --ink-soft: #5b625d;
  --line: #e2dfd6;
  --accent: #b8752c;
  --accent-soft: #f2e2cd;
  --danger: #b3261e;
  --danger-soft: #f6e2e0;
  --radius: 10px;

  font-family: 'Vazirmatn', sans-serif;
  color: var(--ink);
  display: flex;
  flex-direction: column;
  gap: 28px;
}

.warehouse-dashboard :deep(.el-button) {
  font-family: 'Vazirmatn', sans-serif;
}

.warehouse-dashboard :deep(.el-dialog) {
  --el-dialog-bg-color: var(--surface);
  --el-dialog-border-color: var(--line);
}

.warehouse-dashboard :deep(.el-button) {
  font-family: 'Vazirmatn', sans-serif;
}

/* ----- Header ----- */
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.page-header h1 {
  margin: 0 0 4px;
  font-size: 26px;
  font-weight: 700;
}

.page-header p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 14px;
}

.btn-primary.el-button {
  background: var(--accent);
  border-color: var(--accent);
}

.btn-primary.el-button:hover {
  background: #a36624;
  border-color: #a36624;
}

/* ----- Stat row ----- */
.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 18px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.stat-card__text {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.stat-card__label {
  font-size: 13px;
  color: var(--ink-soft);
}

.stat-card__value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.stat-card__value small {
  font-family: 'Vazirmatn', sans-serif;
  font-size: 12px;
  font-weight: 400;
  color: var(--ink-soft);
  margin-inline-start: 4px;
}

.stat-card.danger .stat-card__value {
  color: var(--danger);
}

.chart-slot--mini {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  flex-shrink: 0;
}

.chart-slot--mini .chart-slot__icon {
  width: 18px;
  height: 18px;
}

/* ----- Chart placeholder ----- */
.chart-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg);
  border: 1px dashed var(--line);
  color: var(--ink-soft);
}

.chart-slot__icon {
  width: 26px;
  height: 26px;
  fill: none;
  stroke: var(--accent);
  stroke-width: 1.4;
}

.chart-slot__icon path[fill='none'] {
  stroke-linecap: round;
  stroke-linejoin: round;
}

.chart-slot--mini .chart-slot__icon {
  fill: var(--accent);
  stroke: none;
}

.chart-slot--large {
  min-height: 220px;
  border-radius: var(--radius);
  font-size: 13px;
}

/* ----- Panel row ----- */
.panel-row {
  display: grid;
  grid-template-columns: 1.6fr 1fr;
  gap: 16px;
}

.chart-panel {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.chart-panel__header h2 {
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 600;
}

.chart-panel__header p {
  margin: 0;
  font-size: 13px;
  color: var(--ink-soft);
}

/* ----- Categories section (existing feature, restyled) ----- */
.categories-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.section-header h2 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
}

.section-header p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 13px;
}

.category-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.category-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: border-color 0.15s ease;
}

.category-card:hover,
.category-card:focus-visible {
  border-color: var(--accent);
  outline: none;
}

.category-card__icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 8px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

.category-card__text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.category-card__text b {
  font-size: 14px;
  font-weight: 600;
}

.category-card__text small {
  font-size: 12px;
  color: var(--ink-soft);
}

.category-card i {
  font-style: normal;
  color: var(--ink-soft);
}

.category-delete {
  opacity: 0;
  transition: opacity 0.15s ease;
}

.category-card:hover .category-delete,
.category-card:focus-within .category-delete {
  opacity: 1;
}

/* ----- Empty state ----- */
.empty-panel {
  background: var(--surface);
  border: 1px dashed var(--line);
  border-radius: var(--radius);
  padding: 48px 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.empty-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--accent-soft);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 8px;
}

.empty-panel h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.empty-panel p {
  margin: 0 0 8px;
  color: var(--ink-soft);
  font-size: 13px;
}

/* ----- Responsive ----- */
@media (max-width: 960px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .panel-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .warehouse-dashboard {
    padding: 20px;
  }
  .stat-row {
    grid-template-columns: 1fr;
  }
  .page-header {
    flex-direction: column;
  }
}

@media (prefers-reduced-motion: reduce) {
  .category-card {
    transition: none;
  }
}
</style>
