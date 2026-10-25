<template>
  <div class="page-stack settings-page">
    <PageHeader
      title="ظاهر برنامه، به سلیقه شما"
      eyebrow="تنظیمات"
      description="رنگ‌ها و نحوه نمایش را انتخاب کنید؛ تغییرات همان لحظه در تمام برنامه اعمال می‌شوند."
    >
      <button class="button button--outline" @click="resetPreferences">
        <RotateCcw :size="16" />بازگشت به پیش‌فرض
      </button>
    </PageHeader>
    <p class="notice" role="status">
      <Info :size="18" />{{
        storageAvailable
          ? 'تنظیمات به‌صورت خودکار در همین مرورگر ذخیره می‌شوند.'
          : 'ذخیره‌سازی مرورگر در دسترس نیست؛ تغییرات فقط تا بستن صفحه باقی می‌مانند.'
      }}
    </p>
    <section class="panel" aria-labelledby="theme-heading">
      <div class="panel-heading">
        <div>
          <h2 id="theme-heading">حالت نمایش</h2>
          <p>فضای مناسب برای نور محیط خود را انتخاب کنید.</p>
        </div>
        <SunMoon :size="22" class="muted" />
      </div>
      <div class="panel-body theme-options" role="group" aria-label="حالت نمایش">
        <button
          v-for="option in themeOptions"
          :key="option.value"
          class="theme-option"
          :aria-pressed="themeMode === option.value"
          @click="setTheme(option.value)"
        >
          <component :is="option.icon" :size="24" /><strong>{{ option.label }}</strong
          ><small>{{ option.description }}</small>
          <Check v-if="themeMode === option.value" class="selected-check" :size="16" />
        </button>
      </div>
    </section>
    <section class="panel" aria-labelledby="colors-heading">
      <div class="panel-heading">
        <div>
          <h2 id="colors-heading">رنگ‌های برنامه</h2>
          <p>از رنگ‌های آماده انتخاب کنید یا رنگ دلخواه خود را بسازید.</p>
        </div>
        <Palette :size="22" class="muted" />
      </div>
      <div class="panel-body color-fields">
        <fieldset v-for="field in colorFields" :key="field.key" class="color-field">
          <legend>{{ field.label }}</legend>
          <p class="muted">{{ field.description }}</p>
          <div class="color-swatches">
            <button
              v-for="color in colors"
              :key="color.value"
              class="color-swatch"
              :style="{ '--swatch': color.value }"
              :aria-label="`${field.label}؛ ${color.label}`"
              :aria-pressed="preferences[field.key] === color.value"
              :title="color.label"
              @click="updatePreferences({ [field.key]: color.value })"
            >
              <span /><Check v-if="preferences[field.key] === color.value" :size="14" />
            </button>
          </div>
          <label class="custom-color"
            ><input
              type="color"
              :value="preferences[field.key] || '#166553'"
              :aria-label="`${field.label} دلخواه`"
              @input="changeColor(field.key, $event)"
            /><span>رنگ دلخواه</span
            ><code dir="ltr">{{ preferences[field.key] || 'پیش‌فرض' }}</code></label
          >
          <button
            class="button button--ghost button--small"
            @click="updatePreferences({ [field.key]: null })"
          >
            رنگ پیش‌فرض
          </button>
        </fieldset>
      </div>
    </section>
    <section class="panel" aria-labelledby="preferences-heading">
      <div class="panel-heading">
        <div>
          <h2 id="preferences-heading">ترجیحات نمایش</h2>
          <p>جزئیات رابط را متناسب با شیوه کار خود تنظیم کنید.</p>
        </div>
        <SlidersHorizontal :size="22" class="muted" />
      </div>
      <div class="panel-body preference-fields">
        <div class="preference-row">
          <div>
            <h3 id="density-label">تراکم نمایش</h3>
            <p class="muted">فاصله ردیف جدول‌ها و بخش‌های صفحه</p>
          </div>
          <div class="segmented-control" role="group" aria-labelledby="density-label">
            <button
              :aria-pressed="preferences.density === 'comfortable'"
              @click="updatePreferences({ density: 'comfortable' })"
            >
              راحت</button
            ><button
              :aria-pressed="preferences.density === 'compact'"
              @click="updatePreferences({ density: 'compact' })"
            >
              فشرده
            </button>
          </div>
        </div>
        <div class="preference-row">
          <div>
            <h3 id="corners-label">گوشه‌های رابط</h3>
            <p class="muted">ظاهر کارت‌ها، دکمه‌ها و ورودی‌ها</p>
          </div>
          <div class="segmented-control" role="group" aria-labelledby="corners-label">
            <button
              :aria-pressed="preferences.corners === 'rounded'"
              @click="updatePreferences({ corners: 'rounded' })"
            >
              گرد</button
            ><button
              :aria-pressed="preferences.corners === 'subtle'"
              @click="updatePreferences({ corners: 'subtle' })"
            >
              کم‌گرد
            </button>
          </div>
        </div>
        <label class="preference-row motion-preference"
          ><span
            ><strong>کاهش حرکت و انیمیشن</strong
            ><small class="muted"
              >برای تجربه‌ای آرام‌تر، انیمیشن‌های رابط را کاهش دهید.</small
            ></span
          ><input type="checkbox" :checked="preferences.reduceMotion" @change="changeMotion"
        /></label>
      </div>
    </section>
    <section class="panel" aria-labelledby="preview-heading">
      <div class="panel-heading">
        <h2 id="preview-heading">پیش‌نمایش انتخاب شما</h2>
        <span class="badge badge--primary">زنده</span>
      </div>
      <div class="panel-body settings-preview">
        <span class="preview-icon"><Package :size="26" /></span>
        <div>
          <h3>همه چیز برای یک روز منظم</h3>
          <p class="muted">رنگ انتخابی شما روی دکمه‌ها، نشان‌ها و بخش‌های فعال اعمال می‌شود.</p>
        </div>
        <RouterLink to="/products" class="button button--primary"
          >مشاهده کالاها<ArrowLeft :size="16"
        /></RouterLink>
      </div>
    </section>
  </div>
</template>
<script setup lang="ts">
import {
  ArrowLeft,
  Check,
  Info,
  Monitor,
  Moon,
  Package,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Sun,
  SunMoon,
} from '@lucide/vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import { useTheme, type ThemeMode } from '@/composables/useTheme'
const { themeMode, preferences, storageAvailable, setTheme, updatePreferences, resetPreferences } =
  useTheme()
const themeOptions: { value: ThemeMode; label: string; description: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'روشن', description: 'روشن و خوانا در طول روز', icon: Sun },
  { value: 'dark', label: 'تاریک', description: 'مناسب محیط‌های کم‌نور', icon: Moon },
  {
    value: 'system',
    label: 'هماهنگ با سیستم',
    description: 'پیروی از تنظیمات دستگاه',
    icon: Monitor,
  },
]
type ColorKey = 'primaryColor' | 'sidebarColor'
const colorFields: { key: ColorKey; label: string; description: string }[] = [
  { key: 'primaryColor', label: 'رنگ اصلی', description: 'دکمه‌ها، نشان‌ها و رنگ تأکیدی برنامه' },
  {
    key: 'sidebarColor',
    label: 'رنگ منوی کناری',
    description: 'طیف تیره رنگ انتخابی برای منوی دسکتاپ و موبایل',
  },
]
const colors = [
  { value: '#166553', label: 'سبز جنگلی' },
  { value: '#2563eb', label: 'آبی' },
  { value: '#7c3aed', label: 'بنفش' },
  { value: '#be185d', label: 'سرخابی' },
  { value: '#b45309', label: 'کهربایی' },
  { value: '#475569', label: 'خاکستری' },
]
function changeColor(key: ColorKey, event: Event) {
  updatePreferences({ [key]: (event.target as HTMLInputElement).value })
}
function changeMotion(event: Event) {
  updatePreferences({ reduceMotion: (event.target as HTMLInputElement).checked })
}
</script>
<style scoped>
.settings-page {
  max-width: 1040px;
  margin-inline: auto;
}
.settings-page > .notice {
  margin: 0;
}
.theme-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
}
.theme-option {
  position: relative;
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 22px;
  text-align: start;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--card);
}
.theme-option[aria-pressed='true'] {
  border-color: var(--ring);
  background: var(--accent);
}
.theme-option small {
  color: var(--muted-foreground);
  font-size: 11px;
}
.selected-check {
  position: absolute;
  top: 16px;
  inset-inline-end: 16px;
}
.color-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 28px;
}
.color-field {
  min-width: 0;
  padding: 0;
  margin: 0;
  border: 0;
}
.color-field legend {
  font-weight: 650;
  margin-bottom: 8px;
}
.color-field p {
  font-size: 12px;
}
.color-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 18px 0;
}
.color-swatch {
  display: grid;
  place-items: center;
  position: relative;
  width: 40px;
  height: 40px;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--card);
}
.color-swatch span {
  width: 100%;
  height: 100%;
  background: var(--swatch);
  border-radius: 50%;
}
.color-swatch svg {
  position: absolute;
  color: white;
}
.color-swatch[aria-pressed='true'] {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
}
.custom-color {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
}
.custom-color input[type='color'] {
  width: 44px;
  height: 44px;
  padding: 4px;
  cursor: pointer;
}
.custom-color code {
  color: var(--muted-foreground);
}
.color-field > button {
  margin-top: 12px;
}
.preference-fields {
  display: grid;
  gap: 22px;
}
.preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}
.preference-row + .preference-row {
  padding-top: 22px;
  border-top: 1px solid var(--border);
}
.preference-row h3,
.settings-preview h3 {
  margin: 0 0 4px;
}
.preference-row p,
.settings-preview p {
  margin: 0;
  font-size: 12px;
}
.motion-preference {
  cursor: pointer;
}
.motion-preference strong {
  font-size: 15px;
}
.motion-preference small {
  display: block;
  margin-top: 4px;
  font-size: 12px;
}
.motion-preference input {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  accent-color: var(--primary);
}
.settings-preview {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 18px;
}
.settings-preview > div {
  flex: 1;
  min-width: 180px;
}
.preview-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  border-radius: var(--radius);
  color: var(--accent-foreground);
  background: var(--accent);
}
@media (max-width: 640px) {
  .theme-options,
  .color-fields {
    grid-template-columns: 1fr;
  }
  .theme-option {
    padding: 18px;
  }
  .preference-row {
    align-items: start;
    flex-direction: column;
    gap: 12px;
  }
  .motion-preference {
    flex-direction: row;
    align-items: center;
  }
}
</style>
