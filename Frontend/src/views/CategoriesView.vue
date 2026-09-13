<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { categoriesApi } from '@/services/categories'
import type { Category } from '@/types'
const items = ref<Category[]>([]),
  name = ref(''),
  dialog = ref(false),
  edit = ref<{ id: number; name: string }>()
async function load() {
  try {
    items.value = await categoriesApi.list()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا')
  }
}
function open(c?: any) {
  edit.value = c
  name.value = c?.name ?? ''
  dialog.value = true
}
async function save() {
  try {
    edit.value
      ? await categoriesApi.update(edit.value.id, name.value)
      : await categoriesApi.create(name.value)
    dialog.value = false
    await load()
    ElMessage.success('ذخیره شد')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : 'خطا')
  }
}
async function remove(c: any) {
  try {
    await ElMessageBox.confirm(`دسته «${c.name}» حذف شود؟`, 'تأیید')
    await categoriesApi.remove(c.id)
    await load()
  } catch {}
}
onMounted(load)
</script>
<template>
  <div class="section-header">
    <div>
      <h2>دسته‌بندی‌های کالا</h2>
      <p>دسته‌بندی‌ها برای فیلتر و مدیریت بهتر محصولات استفاده می‌شوند.</p>
    </div>
    <el-button type="primary" @click="open()">+ دسته‌بندی جدید</el-button>
  </div>
  <el-card shadow="never"
    ><el-table :data="items"
      ><el-table-column label="نام دسته" prop="name" /><el-table-column label="تعداد محصول"
        ><template #default="{ row }">{{ row._count?.products ?? '—' }}</template></el-table-column
      ><el-table-column label="عملیات"
        ><template #default="{ row }"
          ><el-button link type="primary" @click="open(row)">ویرایش</el-button
          ><el-button link type="danger" @click="remove(row)">حذف</el-button></template
        ></el-table-column
      ></el-table
    ></el-card
  ><el-dialog v-model="dialog" :title="edit ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'" width="420"
    ><el-input v-model="name" placeholder="مثلاً شیرآلات" @keyup.enter="save" /><template #footer
      ><el-button @click="dialog = false">انصراف</el-button
      ><el-button type="primary" :disabled="!name" @click="save">ذخیره</el-button></template
    ></el-dialog
  >
</template>
