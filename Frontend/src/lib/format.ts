const numberFormatter = new Intl.NumberFormat('fa-IR', { useGrouping: true })
export const number = (value: number) =>
  Number.isFinite(value) ? numberFormatter.format(value) : '—'
export const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '—' : `${number(value)} تومان`
export const date = (value: string) => new Date(value).toLocaleDateString('fa-IR')
export function normalizeNumberText(value: string | number): string {
  return String(value)
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[,٬\s]/g, '')
    .replace(/٫/g, '.')
}
export function parseNumber(value: string | number): number {
  const normalized = normalizeNumberText(value)
  return normalized ? Number(normalized) : Number.NaN
}

export function toPersianDigits(value: string): string {
  return value.replace(/[0-9٠-٩]/g, (digit) => {
    const index = /[0-9]/.test(digit) ? Number(digit) : '٠١٢٣٤٥٦٧٨٩'.indexOf(digit)
    return '۰۱۲۳۴۵۶۷۸۹'[index]!
  })
}
