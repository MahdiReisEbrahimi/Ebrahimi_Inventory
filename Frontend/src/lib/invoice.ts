type InvoiceLine = { productId: number; quantity: number; unitPrice: number }
export interface InvoiceEdit {
  saleType?: 'REGULAR' | 'CREDIT'
  paidAmount?: number
  customerId?: number
  issueDate: string
  discount: number
  settlement: string
  notes: string
  items: InvoiceLine[]
}

export function invoiceEditKey(invoice: InvoiceEdit): string {
  return JSON.stringify({
    saleType: invoice.saleType ?? 'REGULAR',
    paidAmount: invoice.paidAmount ?? 0,
    customerId: invoice.customerId ?? null,
    issueDate: invoice.issueDate,
    discount: invoice.discount,
    settlement: invoice.settlement,
    notes: invoice.notes,
    items: invoice.items.map(({ productId, quantity, unitPrice }) => ({
      productId,
      quantity,
      unitPrice,
    })),
  })
}
export const MAX_INVOICE_AMOUNT = 10_000_000_000
// One decimal toman preserves integer-rial amounts on historical invoices exactly.
export const isInvoiceAmount = (value: number) =>
  Number.isFinite(value) &&
  value === Number(value.toFixed(1)) &&
  Number.isSafeInteger(Math.round(value * 10))
export const roundToman = (value: number) => Math.round(value * 10) / 10

/** Validate the draft before a request. The API remains the authority on stock. */
export function validateInvoiceLines(
  lines: InvoiceLine[],
  stockOf: (id: number) => number,
): string {
  if (!lines.length) return 'حداقل یک کالا به فاکتور اضافه کنید.'
  const quantities = new Map<number, number>()
  let total = 0
  for (const line of lines) {
    if (
      !Number.isInteger(line.productId) ||
      line.productId <= 0 ||
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    ) {
      return 'کالا و تعداد صحیح و بیشتر از صفر را برای هر ردیف وارد کنید.'
    }
    const quantity = (quantities.get(line.productId) || 0) + line.quantity
    if (quantity > stockOf(line.productId)) return 'تعداد کالا از موجودی قابل فروش بیشتر است.'
    quantities.set(line.productId, quantity)
    if (!isInvoiceAmount(line.unitPrice) || line.unitPrice < 0) {
      return 'قیمت هر کالا باید مبلغ غیرمنفی با حداکثر یک رقم اعشار تومان باشد.'
    }
    total += line.quantity * Math.round(line.unitPrice * 10)
    if (!Number.isSafeInteger(total) || total > MAX_INVOICE_AMOUNT * 10) {
      return 'مبلغ فاکتور نباید بیشتر از ۱۰ میلیارد تومان باشد.'
    }
  }
  return ''
}
