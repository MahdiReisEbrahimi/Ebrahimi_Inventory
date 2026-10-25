export const number = (value: number) =>
  Number.isFinite(value) ? new Intl.NumberFormat('fa-IR').format(value) : '—'
export const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? '—' : `${number(value)} تومان`
export const date = (value: string) => new Date(value).toLocaleDateString('fa-IR')
export function parseNumber(value: string | number): number {
  const normalized = String(value)
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[,٬\s]/g, '')
  return normalized ? Number(normalized) : Number.NaN
}
