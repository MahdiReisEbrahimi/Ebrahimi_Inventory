<template>
  <div class="page-stack accounts-page">
    <PageHeader class="no-print" title="حساب‌های باز" />
    <section class="panel no-print">
      <div class="filter-bar">
        <label class="search-field">
          <Search :size="18" />
          <input
            v-model="search"
            type="search"
            placeholder="جست‌وجوی نام یا تلفن طرف حساب…"
            aria-label="جست‌وجوی حساب‌های باز"
          />
        </label>
        <label
          ><input v-model="showAll" type="checkbox" @change="load" /> نمایش حساب‌های
          تسویه‌شده</label
        >
        <span v-if="!loading && !error" class="muted">{{ number(filtered.length) }} طرف حساب</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="دریافت دوباره حساب‌های باز"
          :disabled="loading"
          @click="load"
          ><RefreshCw :size="18"
        /></Button>
      </div>
      <p class="accounts-notice muted">
        هر کارت، حساب تجمیعی یک طرف حساب است؛ همه فاکتورها، پرداخت‌ها و مرجوعی‌ها در همین حساب
        محاسبه می‌شوند.
      </p>
      <p v-if="unassignedCount" class="notice">
        {{ number(unassignedCount) }} فاکتور قدیمی به طرف حساب ثبت‌شده متصل نیستند و در حساب‌های
        تجمیعی محاسبه نمی‌شوند؛ طرف حساب این فاکتورها را در بایگانی مشخص کنید.
      </p>
    </section>
    <div v-if="loading" class="panel table-loading no-print" role="status">
      در حال دریافت حساب‌ها…
    </div>
    <EmptyState
      v-else-if="error"
      class="panel no-print"
      title="دریافت حساب‌های باز ممکن نشد"
      :description="error"
      error
    >
      <Button variant="outline" @click="load">تلاش دوباره</Button>
    </EmptyState>
    <div v-else-if="filtered.length" class="accounts-grid no-print">
      <article v-for="account in filtered" :key="account.buyer.id" class="panel account-card">
        <div class="account-card__heading">
          <span class="account-mark"><UserRound :size="24" /></span>
          <div>
            <h2>{{ account.buyer.firstName }} {{ account.buyer.lastName }}</h2>
            <p class="account-reference">
              {{ account.role === 'SUPPLIER' ? 'تأمین‌کننده' : 'مشتری' }} ·
              {{ number(account.invoiceCount) }} فاکتور
            </p>
          </div>
        </div>
        <dl class="account-amounts">
          <div>
            <dt>مبلغ خالص فاکتورها</dt>
            <dd>{{ money(account.total) }}</dd>
          </div>
          <div>
            <dt>خالص پرداختی</dt>
            <dd>{{ money(account.paid) }}</dd>
          </div>
          <div>
            <dt>
              {{
                account.balance > 0
                  ? 'بدهکار به فروشگاه'
                  : account.balance < 0
                    ? 'بستانکار از فروشگاه'
                    : 'تسویه'
              }}
            </dt>
            <dd>{{ money(Math.abs(account.balance)) }}</dd>
          </div>
        </dl>
        <p v-if="account.pendingCount" class="muted">
          {{ number(account.pendingCount) }} فاکتور نسیه قیمت‌گذاری نشده؛ مبلغ آن در مانده لحاظ نشده
          است.
        </p>
        <div class="account-card__actions">
          <Button size="sm" variant="outline" @click="openAccount(account)"
            ><Eye :size="16" />مشاهده و تاریخچه / معین</Button
          >
          <Button size="sm" variant="outline" @click="openAccount(account, 'PAYMENT')"
            ><HandCoins :size="16" />ثبت پرداخت</Button
          >
          <Button
            v-if="account.role === 'CUSTOMER'"
            size="sm"
            variant="outline"
            @click="openAccount(account, 'RETURN')"
            >مرجوعی صورت‌حساب</Button
          >
          <Button size="sm" @click="openAccount(account, 'FINALIZE')">نهایی‌کردن صورت‌حساب</Button>
        </div>
      </article>
    </div>
    <EmptyState
      v-else
      class="panel no-print"
      title="حسابی پیدا نشد"
      description="عبارت جست‌وجو یا نمایش حساب‌های تسویه‌شده را تغییر دهید."
    />
    <PartyAccountDialog
      :buyer-id="selectedBuyer"
      :payment="paymentOnOpen"
      :action="actionOnOpen"
      @close="selectedBuyer = null"
      @changed="load"
    />
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Eye, HandCoins, RefreshCw, Search, UserRound } from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import Button from '@/components/ui/Button.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import PartyAccountDialog from '@/components/PartyAccountDialog.vue'
import { accountsApi } from '@/services/accounts'
import { money, number, normalizeNumberText } from '@/lib/format'
import type { PartyAccount } from '@/types'
const route = useRoute()
const selectedBuyer = ref<number | null>(null),
  paymentOnOpen = ref(false),
  actionOnOpen = ref<'RETURN' | 'FINALIZE' | null>(null)
const showAll = ref(false),
  unassignedCount = ref(0),
  accounts = ref<PartyAccount[]>([])
const loading = ref(true),
  error = ref(''),
  search = ref('')
const filtered = computed(() => {
  const query = normalizeNumberText(search.value.trim()).toLocaleLowerCase('fa')
  return accounts.value.filter((account) =>
    normalizeNumberText(
      `${account.buyer.firstName} ${account.buyer.lastName} ${account.buyer.phone || ''}`,
    )
      .toLocaleLowerCase('fa')
      .includes(query),
  )
})
function openAccount(account: PartyAccount, action?: 'PAYMENT' | 'RETURN' | 'FINALIZE') {
  paymentOnOpen.value = action === 'PAYMENT'
  actionOnOpen.value = action === 'RETURN' || action === 'FINALIZE' ? action : null
  selectedBuyer.value = account.buyer.id
}
async function load() {
  loading.value = true
  error.value = ''
  try {
    const result = await accountsApi.list(showAll.value)
    accounts.value = result.accounts
    unassignedCount.value = result.unassignedCount
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'دریافت حساب‌ها انجام نشد.'
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await load()
  const id = Number(route.query.buyerId)
  if (Number.isInteger(id) && id > 0) {
    actionOnOpen.value = route.query.finalizeId ? 'FINALIZE' : null
    selectedBuyer.value = id
  }
})
</script>
<style scoped>
.accounts-page {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  grid-template-rows: auto auto minmax(0, 1fr);
}
.accounts-page > .panel {
  min-height: 0;
}
.accounts-grid {
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  scrollbar-gutter: stable;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr));
  gap: 12px;
  padding-inline-end: 10px;
}
.account-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
}
.account-card__heading {
  display: flex;
  align-items: center;
  gap: 12px;
}
.account-card__heading > div {
  min-width: 0;
}
.account-card h2 {
  margin: 0;
  font-size: 15px;
  overflow-wrap: anywhere;
}
.account-mark {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 14px;
  background: var(--accent);
  color: var(--primary);
}
.account-reference {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--muted-foreground);
  overflow-wrap: anywhere;
}
.account-amounts {
  display: grid;
  gap: 12px;
  margin: 0;
  font-size: 12px;
}
.account-amounts > div {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 12px;
}
.account-amounts dt {
  color: var(--muted-foreground);
}
.account-amounts dd {
  margin: 0;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}
.account-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
  margin-top: auto;
}
.account-card__actions :deep(.button) {
  min-width: 0;
}
.accounts-notice {
  margin: 0;
  padding: 12px 20px;
  font-size: 12px;
}
.muted {
  color: var(--muted-foreground);
  font-size: 13px;
}
</style>
