<template>
  <div class="page-stack table-page">
    <PageHeader title="گردش موجودی" />
    <div v-if="error" class="notice notice--error" role="alert">
      {{ error }}<Button variant="outline" @click="load">تلاش دوباره</Button>
    </div>
    <section class="panel table-panel movement-panel">
      <div class="panel-heading">
        <div>
          <h2>فهرست گردش‌ها</h2>
          <p>حداکثر ۵۰۰ گردش اخیر · {{ number(filteredMovements.length) }} نتیجه</p>
        </div>
        <button
          class="icon-button"
          :disabled="loading"
          aria-label="دریافت دوباره گردش‌ها"
          @click="load"
        >
          <RefreshCw :size="18" />
        </button>
      </div>
      <div class="filter-bar">
        <label class="search-field"
          ><Search :size="18" /><input
            v-model="search"
            type="search"
            placeholder="جست‌وجوی نام کالا یا شماره فاکتور…"
            aria-label="جست‌وجوی گردش‌ها" /></label
        ><select v-model="movementType" aria-label="نوع گردش">
          <option value="">همه عملیات</option>
          <option value="PURCHASE">ورود خرید</option>
          <option value="SALE">فروش</option>
          <option value="RETURN">مرجوعی</option>
        </select>
      </div>
      <div
        class="table-scroll"
        :class="{ 'table-scroll--empty': loading || !filteredMovements.length }"
      >
        <table class="data-table">
          <thead>
            <tr>
              <th>کالا</th>
              <th>نوع عملیات</th>
              <th>تعداد</th>
              <th>قیمت واحد</th>
              <th>تاریخ</th>
              <th>فاکتور / توضیحات</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading || !filteredMovements.length" class="table-state-row">
              <td colspan="6" class="table-state-cell">
                <div class="table-state-content">
                  <div v-if="loading" class="table-loading" role="status">
                    در حال دریافت اطلاعات…
                  </div>
                  <EmptyState
                    v-else
                    title="گردشی وجود ندارد"
                    description="پس از ثبت ورود کالا یا صدور فاکتور، گردش موجودی نمایش داده می‌شود."
                  />
                </div>
              </td>
            </tr>
            <tr v-for="movement in filteredMovements" :key="movement.id">
              <td>
                <b>{{ movement.product.name }}</b>
              </td>
              <td>
                <span
                  class="badge"
                  :class="movement.type === 'SALE' ? 'badge--primary' : 'badge--success'"
                  >{{ typeLabel(movement.type) }}</span
                >
              </td>
              <td class="number-cell">
                {{ movement.type === 'SALE' ? '−' : '+' }} {{ number(movement.quantity) }}
                {{ movement.product.unit }}
              </td>
              <td class="number-cell">
                {{
                  money(
                    movement.unitPrice == null
                      ? null
                      : movement.unitPrice / (movement.currency === 'IRR' ? 10 : 1),
                  )
                }}
              </td>
              <td class="number-cell">{{ date(movement.createdAt) }}</td>
              <td class="movement-note">
                {{ movement.invoice?.number || movement.description || '—' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RefreshCw, Search } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import Button from '@/components/ui/Button.vue'
import { date, money, number } from '@/lib/format'
import { inventoryApi } from '@/services/inventory'
import type { InventoryMovement } from '@/types'

const movements = ref<InventoryMovement[]>([])
const loading = ref(true)
const error = ref('')
const search = ref('')
const movementType = ref('')
const filteredMovements = computed(() =>
  movements.value.filter(
    (m) =>
      (!movementType.value || m.type === movementType.value) &&
      [m.product.name, m.invoice?.number || '', m.description || '']
        .join(' ')
        .toLowerCase()
        .includes(search.value.trim().toLowerCase()),
  ),
)
const typeLabel = (value: string) =>
  ({ PURCHASE: 'ورود خرید', SALE: 'فروش', RETURN: 'مرجوعی', ADJUSTMENT: 'اصلاح موجودی' })[value] ||
  value
async function load() {
  loading.value = true
  error.value = ''
  try {
    movements.value = await inventoryApi.movements()
  } catch {
    error.value = 'دریافت گردش موجودی ممکن نشد. دوباره تلاش کنید.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
</script>
<style scoped>
.movement-panel {
  overflow: hidden;
}
.movement-note {
  min-width: 150px;
  font-size: 12px;
}
</style>
