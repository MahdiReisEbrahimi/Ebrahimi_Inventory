import type { Invoice } from '../types/index.ts'
import { number } from './format.ts'

/** Credit sales have no price; payment terms subdivide regular sales only. */
export function invoiceSaleLabel(
  invoice: Pick<Invoice, 'saleType' | 'settlement' | 'kind'>,
): string {
  if (invoice.kind === 'PURCHASE') return 'فاکتور خرید'
  if (invoice.kind === 'RETURN') return 'فاکتور مرجوعی فروش'
  if (invoice.saleType === 'CREDIT') return 'فروش نسیه'
  return invoice.settlement === 'INSTALLMENT' ? 'فروش عادی · اقساطی' : 'فروش عادی · نقدی'
}

export const rial = (value: number) => (Number.isFinite(value) ? `${number(value)} ریال` : '—')
function invoiceInCurrency(invoice: Invoice, currency: 'IRR' | 'TOMAN'): Invoice {
  const sourceFactor = invoice.currency === 'IRR' ? 1 : 10
  const targetFactor = currency === 'IRR' ? 1 : 10
  const convert = (value: number) => (value * sourceFactor) / targetFactor
  return {
    ...invoice,
    currency,
    subtotal: convert(invoice.subtotal ?? invoice.total),
    total: convert(invoice.total),
    discount: convert(invoice.discount ?? 0),
    paidAmount: convert(invoice.paidAmount ?? 0),
    ...(invoice.accountValueAmount == null
      ? {}
      : { accountValueAmount: convert(invoice.accountValueAmount) }),
    ...(invoice.returnedAmount == null ? {} : { returnedAmount: convert(invoice.returnedAmount) }),
    ...(invoice.returnGrossAmount == null
      ? {}
      : { returnGrossAmount: convert(invoice.returnGrossAmount) }),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice == null ? null : convert(item.unitPrice),
      total: item.total == null ? null : convert(item.total),
    })),
  }
}
export const invoiceInRials = (invoice: Invoice): Invoice => invoiceInCurrency(invoice, 'IRR')
export const invoiceInTomans = (invoice: Invoice): Invoice => invoiceInCurrency(invoice, 'TOMAN')
export function amountInTomansWords(value: number): string {
  return Number.isSafeInteger(value)
    ? amountInWords(value).replace(/ریال$/, 'تومان')
    : `${number(value)} تومان`
}
const ones = [
  '',
  'یک',
  'دو',
  'سه',
  'چهار',
  'پنج',
  'شش',
  'هفت',
  'هشت',
  'نه',
  'ده',
  'یازده',
  'دوازده',
  'سیزده',
  'چهارده',
  'پانزده',
  'شانزده',
  'هفده',
  'هجده',
  'نوزده',
]
const tens = ['', '', 'بیست', 'سی', 'چهل', 'پنجاه', 'شصت', 'هفتاد', 'هشتاد', 'نود']
const hundreds = ['', 'صد', 'دویست', 'سیصد', 'چهارصد', 'پانصد', 'ششصد', 'هفتصد', 'هشتصد', 'نهصد']
export function amountInWords(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) return '—'
  if (!value) return 'صفر ریال'
  const groups: string[] = []
  const scales = ['', 'هزار', 'میلیون', 'میلیارد', 'تریلیون', 'هزار تریلیون']
  let remaining = value
  let scale = 0
  while (remaining) {
    const group = remaining % 1000
    if (group) {
      const words: string[] = []
      if (group >= 100) words.push(hundreds[Math.floor(group / 100)]!)
      const rest = group % 100
      if (rest < 20) {
        if (rest) words.push(ones[rest]!)
      } else {
        words.push(tens[Math.floor(rest / 10)]!)
        if (rest % 10) words.push(ones[rest % 10]!)
      }
      groups.unshift(`${words.join(' و ')}${scales[scale] ? ' ' + scales[scale] : ''}`)
    }
    remaining = Math.floor(remaining / 1000)
    scale++
  }
  return groups.join(' و ') + ' ریال'
}
export interface InvoicePageCapacities {
  single: number
  first: number
  middle: number
  last: number
}

// Measured in Chrome with the A5 landscape template, Vazirmatn and ordinary rows.
// Initial render only; InvoicePaper measures actual rows to fill each page.
export const invoicePageCapacities: Readonly<InvoicePageCapacities> = {
  single: 12,
  first: 16,
  middle: 19,
  last: 15,
}

export function invoicePages<T>(
  items: T[],
  capacities: InvoicePageCapacities = invoicePageCapacities,
) {
  if (items.length <= capacities.single) return [{ items: items.slice(), offset: 0 }]
  const middlePages = Math.max(
    0,
    Math.ceil((items.length - capacities.first - capacities.last) / capacities.middle),
  )
  const limits = [
    capacities.first,
    ...Array<number>(middlePages).fill(capacities.middle),
    capacities.last,
  ]
  // Fill pages in order. The final totals may need their own sheet.
  let remaining = items.length
  let offset = 0
  return limits.map((limit, index) => {
    const count = index === limits.length - 1 ? remaining : Math.min(limit, remaining)
    const page = { items: items.slice(offset, offset + count), offset }
    offset += count
    remaining -= count
    return page
  })
}
