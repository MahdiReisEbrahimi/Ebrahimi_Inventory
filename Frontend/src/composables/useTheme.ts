import { readonly, ref } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'
export interface UiPreferences {
  primaryColor: string | null
  sidebarColor: string | null
  density: 'comfortable' | 'compact'
  corners: 'rounded' | 'subtle'
  reduceMotion: boolean
}

const defaults: UiPreferences = {
  primaryColor: null,
  sidebarColor: null,
  density: 'comfortable',
  corners: 'rounded',
  reduceMotion: false,
}
const storageKey = 'anbarak-ui-preferences'
const dark = ref(false)
const mode = ref<ThemeMode>('system')
const preferences = ref<UiPreferences>({ ...defaults })
const storageAvailable = ref(true)
let systemTheme: MediaQueryList | undefined

function readStorage(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    storageAvailable.value = false
    return null
  }
}

function save() {
  try {
    localStorage.setItem('theme', mode.value)
    localStorage.setItem(storageKey, JSON.stringify(preferences.value))
    storageAvailable.value = true
  } catch {
    storageAvailable.value = false
  }
}

function validColor(value: unknown): value is string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
}

// Choose readable text even for very light or very dark custom colors.
function foreground(color: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(color.slice(offset, offset + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  const luminance = channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
  return luminance > 0.179 ? '#000000' : '#ffffff'
}

function applyTheme() {
  dark.value = mode.value === 'dark' || (mode.value === 'system' && !!systemTheme?.matches)
  const root = document.documentElement
  root.classList.toggle('dark', dark.value)
  root.dataset.density = preferences.value.density
  root.dataset.corners = preferences.value.corners
  root.dataset.reduceMotion = String(preferences.value.reduceMotion)
  const primary = preferences.value.primaryColor
  const sidebar = preferences.value.sidebarColor
  const tokens: Record<string, string | null> = {
    '--primary': primary,
    '--primary-foreground': primary ? foreground(primary) : null,
    '--ring': primary,
    '--accent': primary ? `color-mix(in srgb, ${primary} 14%, var(--card))` : null,
    '--accent-foreground': primary ? `color-mix(in srgb, ${primary} 65%, var(--foreground))` : null,
    '--secondary': primary ? `color-mix(in srgb, ${primary} 8%, var(--card))` : null,
    '--secondary-foreground': primary
      ? `color-mix(in srgb, ${primary} 65%, var(--foreground))`
      : null,
    '--sidebar': sidebar
      ? `color-mix(in srgb, ${sidebar} ${dark.value ? '30%' : '45%'}, #181818)`
      : null,
    '--sidebar-foreground': sidebar ? '#f5f5f5' : null,
    '--sidebar-muted': sidebar ? '#d4d4d4' : null,
    '--sidebar-accent': sidebar ? 'color-mix(in srgb, var(--sidebar) 80%, white)' : null,
    '--sidebar-accent-foreground': sidebar ? '#ffffff' : null,
    '--sidebar-border': sidebar ? 'color-mix(in srgb, var(--sidebar) 72%, white)' : null,
  }
  for (const [name, value] of Object.entries(tokens)) {
    if (value) root.style.setProperty(name, value)
    else root.style.removeProperty(name)
  }
}

function onSystemThemeChange() {
  if (mode.value === 'system') applyTheme()
}

export function initializeTheme() {
  storageAvailable.value = true
  const savedMode = readStorage('theme')
  mode.value = savedMode === 'light' || savedMode === 'dark' ? savedMode : 'system'
  let saved: Partial<UiPreferences> = {}
  try {
    const parsed: unknown = JSON.parse(readStorage(storageKey) || '{}')
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      saved = parsed as Partial<UiPreferences>
    }
  } catch {
    // Ignore malformed preferences and use the defaults.
  }
  preferences.value = {
    primaryColor: validColor(saved.primaryColor) ? saved.primaryColor : null,
    sidebarColor: validColor(saved.sidebarColor) ? saved.sidebarColor : null,
    density: saved.density === 'compact' ? 'compact' : 'comfortable',
    corners: saved.corners === 'subtle' ? 'subtle' : 'rounded',
    reduceMotion: saved.reduceMotion === true,
  }
  systemTheme?.removeEventListener?.('change', onSystemThemeChange)
  systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
  systemTheme.addEventListener?.('change', onSystemThemeChange)
  applyTheme()
}

export function useTheme() {
  function setTheme(value: ThemeMode) {
    mode.value = value
    applyTheme()
    save()
  }
  function updatePreferences(patch: Partial<UiPreferences>) {
    const next = { ...preferences.value, ...patch }
    if (next.primaryColor !== null && !validColor(next.primaryColor)) return
    if (next.sidebarColor !== null && !validColor(next.sidebarColor)) return
    preferences.value = next
    applyTheme()
    save()
  }
  function resetPreferences() {
    preferences.value = { ...defaults }
    setTheme('system')
  }
  return {
    isDark: readonly(dark),
    themeMode: readonly(mode),
    preferences: readonly(preferences),
    storageAvailable: readonly(storageAvailable),
    toggleTheme: () => setTheme(dark.value ? 'light' : 'dark'),
    setTheme,
    updatePreferences,
    resetPreferences,
  }
}
