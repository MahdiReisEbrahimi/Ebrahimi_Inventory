<template>
  <span class="store-logo" :class="{ 'store-logo--on-dark': onDark }">
    <img
      class="store-logo__light"
      src="/branding/ebrahimi-blue.svg"
      alt="فروشگاه ابراهیمی"
      width="1030"
      height="879"
    />
    <img
      class="store-logo__dark"
      src="/branding/ebrahimi-blue-dark.svg"
      alt="فروشگاه ابراهیمی"
      width="1030"
      height="879"
    />
  </span>
</template>

<script setup lang="ts">
defineProps<{ onDark?: boolean }>()
</script>

<style scoped>
.store-logo {
  display: inline-flex;
  flex-shrink: 0;
  width: 64px;
  aspect-ratio: 1030 / 879;
}
.store-logo img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.store-logo .store-logo__dark {
  display: none;
}
:global(.dark) .store-logo__light,
.store-logo--on-dark .store-logo__light {
  display: none;
}
:global(.dark) .store-logo__dark,
.store-logo--on-dark .store-logo__dark {
  display: block;
}
</style>
