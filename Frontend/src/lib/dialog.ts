import type { InjectionKey, Ref } from 'vue'

export const dialogFooterKey: InjectionKey<Readonly<Ref<HTMLElement | null>>> =
  Symbol('dialog-footer')
