<template>
  <form :id="formId" class="stock-form" @submit.prevent="receive">
    <div class="stock-product">
      <span class="stock-product__icon"><Package :size="24" /></span>
      <div>
        <strong>{{ product.name }}</strong>
        <small>موجودی: {{ number(product.stock) }} {{ product.unit }}</small>
      </div>
    </div>
    <fieldset class="stock-fields" :disabled="saving">
      <div class="form-grid">
        <label class="form-field">
          <span>تعداد {{ type === 'RETURN' ? 'مرجوعی' : 'خرید' }} · {{ product.unit }}</span>
          <NumberInput v-model="form.quantity" min="1" step="1" required />
        </label>
        <template v-if="type === 'PURCHASE'">
          <label class="price-unchanged">
            <input v-model="pricesUnchanged" type="checkbox" />
            <span>تغییر قیمتی صورت نگرفته</span>
          </label>
          <label class="form-field">
            <span>قیمت خرید · تومان</span>
            <MoneyInput
              v-model="buyPriceText"
              :required="!pricesUnchanged"
              :disabled="pricesUnchanged"
            />
          </label>
          <label class="form-field">
            <span>قیمت فروش · تومان</span>
            <MoneyInput
              v-model="sellPriceText"
              :required="!pricesUnchanged"
              :disabled="pricesUnchanged"
            />
          </label>
        </template>
      </div>
    </fieldset>
    <div v-if="Number.isInteger(form.quantity) && form.quantity > 0" class="stock-preview">
      <span>موجودی پس از ثبت</span>
      <strong
        >{{ number(product.stock + form.quantity) }} <small>{{ product.unit }}</small></strong
      >
    </div>

    <DialogActions>
      <Button type="button" variant="outline" :disabled="saving" @click="emit('close', false)">
        انصراف
      </Button>
      <Button :form="formId" type="submit" :disabled="saving">
        <Check :size="17" />{{
          saving ? 'در حال ثبت…' : type === 'RETURN' ? 'ثبت مرجوعی' : 'ثبت خرید'
        }}
      </Button>
    </DialogActions>
  </form>
</template>

<script setup lang="ts">
import { reactive, ref, useId } from 'vue'
import { Check, Package } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import MoneyInput from '@/components/ui/MoneyInput.vue'
import NumberInput from '@/components/ui/NumberInput.vue'
import { inventoryApi } from '@/services/inventory'
import { number, parseNumber } from '@/lib/format'
import { toast } from '@/lib/toast'
import type { Product } from '@/types'

const formId = useId()
const props = defineProps<{ product: Product; type: 'PURCHASE' | 'RETURN' }>()
const emit = defineEmits<{ close: [saved: boolean] }>()
const form = reactive({ quantity: 1 })
const pricesUnchanged = ref(false)
const buyPriceText = ref('')
const sellPriceText = ref('')
const saving = ref(false)

async function receive() {
  if (saving.value) return

  if (!Number.isSafeInteger(form.quantity) || form.quantity < 1) {
    toast.error('تعداد باید عدد صحیح و بزرگ‌تر از صفر باشد.')
    return
  }
  const changingPrices = props.type === 'PURCHASE' && !pricesUnchanged.value
  const unitPrice = changingPrices ? parseNumber(buyPriceText.value) : undefined
  const sellPrice = changingPrices ? parseNumber(sellPriceText.value) : undefined
  if (
    changingPrices &&
    (!buyPriceText.value.trim() ||
      !sellPriceText.value.trim() ||
      ![unitPrice, sellPrice].every(
        (price) => Number.isSafeInteger(price) && price! >= 0 && price! <= 2147483647,
      ))
  ) {
    toast.error('قیمت خرید و فروش باید عدد صحیح و غیرمنفی باشند.')
    return
  }
  saving.value = true
  try {
    await inventoryApi.receive({
      productId: props.product.id,
      quantity: form.quantity,
      type: props.type,
      unitPrice,
      sellPrice,
    })
    toast.success(
      props.type === 'RETURN' ? 'مرجوعی ثبت و موجودی به‌روز شد.' : 'خرید ثبت و موجودی به‌روز شد.',
    )
    emit('close', true)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'ثبت انجام نشد.')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.stock-form .form-grid {
  grid-template-columns: minmax(0, 1fr);
}
.price-unchanged {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.price-unchanged input {
  width: 18px;
  height: 18px;
  accent-color: var(--primary);
}
.stock-form {
  display: grid;
  gap: 20px;
}
.stock-product {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--secondary);
}
.stock-product__icon {
  color: var(--primary);
}
.stock-product small {
  display: block;
  margin-top: 5px;
  color: var(--muted-foreground);
}
.stock-fields {
  padding: 0;
  margin: 0;
  border: 0;
  min-width: 0;
}
.stock-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  background: var(--accent);
  border-radius: 12px;
  color: var(--accent-foreground);
}
.stock-preview strong {
  font-size: 22px;
}
.stock-preview small {
  font-size: 12px;
  font-weight: 400;
}
.stock-form .notice,
.stock-form .form-actions {
  margin: 0;
}
</style>
