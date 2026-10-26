<template>
  <Teleport :to="footerTarget || 'body'" :disabled="!footerTarget">
    <div class="form-actions"><slot /></div>
  </Teleport>
</template>

<script setup lang="ts">
import { inject } from 'vue'
import { dialogFooterKey } from '@/lib/dialog'

const footerTarget = inject(dialogFooterKey, null)
</script>
