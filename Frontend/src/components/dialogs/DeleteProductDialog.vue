<template>
  <div class="delete-confirmation">
    <div class="delete-symbol"><Trash2 :size="25" /></div>
    <h3>«{{ selectedRow.name }}» حذف شود؟</h3>
    <p>
      کالا حذف می‌شود. اگر سابقه فاکتور، انبار یا تغییرات داشته باشد، برای حفظ سوابق غیرفعال می‌شود.
    </p>

    <DialogActions>
      <Button variant="outline" :disabled="saving" @click="emit('close', false)">انصراف</Button
      ><Button variant="destructive" :disabled="saving" @click="remove">{{
        saving ? 'در حال انجام…' : 'تأیید حذف'
      }}</Button>
    </DialogActions>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue'
import { Trash2 } from '@lucide/vue'
import Button from '@/components/ui/Button.vue'
import DialogActions from '@/components/ui/DialogActions.vue'
import { productsApi } from '@/services/products'
import { toast } from '@/lib/toast'
import type { Product } from '@/types'
const props = defineProps<{ selectedRow: Product }>()
const emit = defineEmits<{ close: [deleted: boolean] }>()
const saving = ref(false)
async function remove() {
  if (saving.value) return
  saving.value = true

  try {
    await productsApi.remove(props.selectedRow.id)
    toast.success('عملیات انجام شد.')
    emit('close', true)
  } catch (e) {
    toast.error(e instanceof Error ? e.message : 'حذف کالا انجام نشد.')
  } finally {
    saving.value = false
  }
}
</script>
<style scoped>
.delete-symbol {
  width: 54px;
  height: 54px;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--destructive) 10%, var(--card));
  color: var(--destructive);
  border-radius: 16px;
  margin-bottom: 18px;
}
.delete-confirmation p {
  color: var(--muted-foreground);
  font-size: 12px;
  line-height: 2;
}
</style>
