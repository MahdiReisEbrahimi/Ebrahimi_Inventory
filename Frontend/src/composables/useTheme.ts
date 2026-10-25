import { readonly, ref } from 'vue'

const dark = ref(false)

function applyTheme(value: boolean) {
  dark.value = value
  document.documentElement.classList.toggle('dark', value)
}

export function initializeTheme() {
  let saved: string | null = null
  try {
    saved = localStorage.getItem('theme')
  } catch {
    /* Storage can be unavailable. */
  }
  applyTheme(
    saved === 'dark' ||
      (saved !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches),
  )
}

export function useTheme() {
  function toggleTheme() {
    applyTheme(!dark.value)
    try {
      localStorage.setItem('theme', dark.value ? 'dark' : 'light')
    } catch {
      /* Keep the in-memory preference. */
    }
  }
  return { isDark: readonly(dark), toggleTheme }
}
