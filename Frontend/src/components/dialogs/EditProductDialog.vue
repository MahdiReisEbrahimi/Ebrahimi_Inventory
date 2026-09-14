<template>
  <p>
    آیا از حذف محصول <span style="font-weight: bold">{{ props.selectedRow.name }}</span> اطمینان
    دارید؟
  </p>
  <div dir="ltr">
    <el-button @click="editProductHandle" type="danger">حذف</el-button>
    <el-button style="margin-left: 2px" @click="emits('close', false)"> انصراف </el-button>
  </div>
</template>
<script setup lang="ts">
import { productsApi } from '@/services/products'
import { ElMessage } from 'element-plus'

const props = defineProps({
  selectedRow: {
    type: Object,
    required: true,
  },
})

const emits = defineEmits(['close'])

async function editProductHandle() {
  try {
    await productsApi.remove(props.selectedRow.value?.id)
    emits('close', true)
    ElMessage.success('عملیات انجام شد')
  } catch {}
}
</script>
