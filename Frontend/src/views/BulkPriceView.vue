<template>
  <div class="bulk-price">
    <!-- تنظیمات -->
    <section class="price-card">
      <div class="section-header">
        <div class="section-icon">
          <el-icon>
            <PriceTag />
          </el-icon>
        </div>

        <div>
          <h3>تغییر گروهی قیمت</h3>
          <p>قیمت محصولات یک دسته را به‌صورت گروهی تغییر دهید.</p>
        </div>
      </div>

      <div class="form-grid">
        <!-- دسته بندی -->
        <div class="field">
          <label>دسته‌بندی</label>

          <el-select v-model="form.categoryId" placeholder="همه دسته‌ها" clearable filterable>
            <el-option v-for="c in categories" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>

          <small>در صورت انتخاب نکردن، همه محصولات بررسی می‌شوند.</small>
        </div>

        <!-- نوع قیمت -->
        <div class="field">
          <label>نوع قیمت</label>

          <el-select v-model="form.priceType">
            <el-option label="قیمت فروش" value="SELL" />
            <el-option label="قیمت خرید" value="BUY" />
          </el-select>
        </div>

        <!-- نوع تغییر -->
        <div class="field">
          <label>نوع تغییر</label>

          <el-select v-model="form.type">
            <el-option label="درصدی" value="PERCENTAGE" />
            <el-option label="مبلغ ثابت" value="FIXED" />
          </el-select>
        </div>

        <!-- مقدار -->
        <div class="field">
          <label> مقدار تغییر </label>

          <el-input-number
            v-model="form.value"
            :precision="0"
            controls-position="right"
            :placeholder="form.type === 'PERCENTAGE' ? 'مثلاً 10' : 'مثلاً 500000'"
          />

          <small>
            {{ form.type === 'PERCENTAGE' ? 'درصد افزایش قیمت' : 'مبلغ افزایش قیمت به تومان' }}
          </small>
        </div>
      </div>

      <div class="form-footer">
        <span class="hint">
          <el-icon>
            <WarningFilled />
          </el-icon>

          ابتدا پیش‌نمایش را بررسی کنید، سپس تغییرات را ثبت کنید.
        </span>

        <el-button type="primary" :loading="loading" @click="preview"> پیش‌نمایش </el-button>
      </div>
    </section>

    <!-- Preview -->
    <section v-if="rows.length" class="preview-card">
      <div class="preview-header">
        <div class="preview-title">
          <div class="success-icon">
            <el-icon>
              <CircleCheck />
            </el-icon>
          </div>

          <div>
            <h3>پیش‌نمایش تغییرات</h3>

            <span>
              {{ rows.length }}
              محصول تحت تأثیر این تغییر قرار می‌گیرد
            </span>
          </div>
        </div>

        <div class="preview-actions">
          <el-button text @click="clearPreview"> لغو پیش‌نمایش </el-button>

          <el-button type="success" :loading="applying" :icon="CircleCheck" @click="apply">
            تأیید و اعمال تغییرات
          </el-button>
        </div>
      </div>

      <div class="preview-info">
        <span>
          {{ priceTypeLabel() }}
        </span>

        <span class="arrow">←</span>

        <strong>
          {{ form.type === 'PERCENTAGE' ? `${form.value}%` : money(form.value) }}
        </strong>
      </div>

      <el-table :data="rows" class="preview-table" stripe>
        <el-table-column type="index" label="#" width="55" align="center" />

        <el-table-column prop="name" label="محصول" min-width="220" align="center" />

        <el-table-column label="قیمت قبلی" min-width="150" align="center">
          <template #default="{ row }">
            <span class="old-price">
              {{ money(row.oldPrice) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="قیمت جدید" min-width="170" align="center">
          <template #default="{ row }">
            <span
              class="new-price"
              :style="{ color: row.newPrice >= row.oldPrice ? 'darkGreen' : 'darkRed' }"
            >
              {{ money(row.newPrice) }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="تغییر" width="130" align="center">
          <template #default="{ row }">
            <el-tag
              style="direction: ltr"
              :type="row.newPrice >= row.oldPrice ? 'success' : 'danger'"
              effect="light"
            >
              {{
                row.oldPrice
                  ? `${Math.round(((row.newPrice - row.oldPrice) / row.oldPrice) * 100)}%`
                  : '-'
              }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </section>
  </div>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { productsApi } from '@/services/products'
import { categoriesApi } from '@/services/categories'
import type { Category } from '@/types'
import { PriceTag, View, CircleCheck, WarningFilled } from '@element-plus/icons-vue'

const emits = defineEmits(['close'])
const form = reactive({
  categoryId: undefined as number | undefined,
  type: 'PERCENTAGE',
  value: 0,
  priceType: 'SELL',
})

const rows = ref<{ id: number; name: string; oldPrice: number; newPrice: number }[]>([])

const categories = ref<Category[]>([])
const loading = ref(false)
const applying = ref(false)

categoriesApi
  .list()
  .then((r) => (categories.value = r))
  .catch(() => {})

const money = (v: number) => new Intl.NumberFormat('fa-IR').format(v) + ' تومان'

const priceTypeLabel = () => (form.priceType === 'SELL' ? 'قیمت فروش' : 'قیمت خرید')

const typeLabel = () => (form.type === 'PERCENTAGE' ? 'درصدی' : 'مبلغ ثابت')

async function preview() {
  if (!form.value || form.value === 0) {
    ElMessage.warning(`لطفاً مقدار ${typeLabel()} را وارد کنید`)
    return
  }

  loading.value = true

  try {
    rows.value = (await productsApi.previewBulk(form)).items

    if (!rows.value.length) {
      ElMessage.info('محصولی برای تغییر قیمت پیدا نشد')
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا در دریافت پیش‌نمایش')
  } finally {
    loading.value = false
  }
}

async function apply() {
  if (!rows.value.length) return

  try {
    await ElMessageBox.confirm(
      `قیمت ${rows.value.length} محصول تغییر خواهد کرد. آیا از انجام این عملیات مطمئن هستید؟`,
      'تأیید تغییر قیمت',
      {
        confirmButtonText: 'بله، اعمال کن',
        cancelButtonText: 'انصراف',
        type: 'warning',
      },
    )

    applying.value = true

    const r = await productsApi.bulk(form)

    ElMessage.success(`قیمت ${r.affectedProducts} محصول با موفقیت تغییر کرد`)
    emits('close', true)
    rows.value = []
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e instanceof Error ? e.message : 'خطا در اعمال تغییرات')
    }
  } finally {
    applying.value = false
  }
}

function clearPreview() {
  rows.value = []
}
</script>
<style scoped>
.bulk-price {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* ---------- common card ---------- */

.price-card,
.preview-card {
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  padding: 20px;
}

/* ---------- header ---------- */

.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 22px;
}

.section-icon {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
  font-size: 21px;
}

.section-header h3,
.preview-header h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
}

.section-header p {
  margin: 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

/* ---------- form ---------- */

.form-grid {
  display: grid;
  grid-template-columns:
    minmax(180px, 1.3fr)
    minmax(150px, 1fr)
    minmax(150px, 1fr)
    minmax(180px, 1fr);
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.field label {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.field .el-select,
.field .el-input-number {
  width: 100%;
}

.field small {
  color: var(--el-text-color-secondary);
  font-size: 11px;
  line-height: 1.5;
}

/* ---------- summary ---------- */

.operation-summary {
  display: flex;
  align-items: center;
  margin-top: 20px;
  padding: 12px 16px;
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.summary-item span {
  font-size: 11px;
  color: var(--el-text-color-secondary);
}

.summary-item strong {
  font-size: 13px;
}

.summary-divider {
  width: 1px;
  height: 30px;
  background: var(--el-border-color);
}

/* ---------- footer ---------- */

.form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 20px;
  padding: 0 2px;
}

.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

/* ---------- preview ---------- */

.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.preview-title span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.success-icon {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
  font-size: 20px;
}

.preview-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.preview-info {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  margin-bottom: 14px;
  border-radius: 7px;
  background: var(--el-fill-color-light);
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.preview-info strong {
  color: var(--el-color-success);
}

.arrow {
  color: var(--el-text-color-placeholder);
}

.preview-table {
  border-radius: 8px;
  overflow: hidden;
}

.old-price {
  color: var(--el-text-color-secondary);
}

.new-price {
  color: var(--el-color-success);
  font-weight: 700;
}

/* ---------- responsive ---------- */

@media (max-width: 900px) {
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .preview-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .preview-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 600px) {
  .price-card,
  .preview-card {
    padding: 14px;
  }

  .form-grid {
    grid-template-columns: 1fr;
  }

  .operation-summary {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }

  .summary-divider {
    width: 100%;
    height: 1px;
  }

  .form-footer {
    align-items: stretch;
    flex-direction: column;
  }

  .form-footer .el-button {
    width: 100%;
  }

  .preview-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }
}
</style>
