import { normalizeNumberText, parseNumber } from './format.ts'

export function stripNumberInputLeadingZeros(text: string): string {
  // Keep incomplete decimal edits and invalid text available for validation.
  if (!/^-?[0-9۰-۹٠-٩]*(?:[.٫][0-9۰-۹٠-٩]*)?$/.test(text)) return text
  return text.replace(/^(-?)[0۰٠]+(?=[0-9۰-۹٠-٩])/, '$1')
}

export function parseNumberInput(text: string | number): number {
  return /^-?\d*(?:\.\d*)?$/.test(normalizeNumberText(text)) ? parseNumber(text) : Number.NaN
}

/** Text inputs need explicit numeric constraints; required remains native. */
export function numberInputError(
  text: string,
  constraints: { min?: number | string; max?: number | string; step?: number | string },
): string {
  if (!text) return ''
  const value = parseNumberInput(text)
  if (!Number.isFinite(value)) {
    return 'یک عدد معتبر وارد کنید.'
  }
  const min = constraints.min === undefined ? undefined : Number(constraints.min)
  const max = constraints.max === undefined ? undefined : Number(constraints.max)
  if (min !== undefined && value < min) return `مقدار باید حداقل ${min} باشد.`
  if (max !== undefined && value > max) return `مقدار باید حداکثر ${max} باشد.`
  if (constraints.step !== 'any') {
    const step = Number(constraints.step ?? 1)
    const steps = (value - (min ?? 0)) / step
    if (step > 0 && Math.abs(steps - Math.round(steps)) > 1e-7) {
      return step === 1 ? 'عدد صحیح وارد کنید.' : `مقدار باید مضربی از ${step} باشد.`
    }
  }
  return ''
}
