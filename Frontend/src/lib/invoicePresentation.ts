import type { Invoice } from '../types/index.ts'
import { number } from './format.ts'

export const rial = (value: number) => (Number.isFinite(value) ? `${number(value)} ریال` : '—')
export function invoiceInRials(invoice: Invoice): Invoice {
  const factor = invoice.currency === 'IRR' ? 1 : 10
  return {
    ...invoice,
    currency: 'IRR',
    subtotal: (invoice.subtotal ?? invoice.total) * factor,
    total: invoice.total * factor,
    discount: (invoice.discount ?? 0) * factor,
    paidAmount: (invoice.paidAmount ?? 0) * factor,
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice * factor,
      total: item.total * factor,
    })),
  }
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
