type InvoiceLine = { productId: number; quantity: number; unitPrice: number }
export const MAX_INVOICE_AMOUNT = 100_000_000_000

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
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      return 'قیمت هر کالا باید عدد صحیح و غیرمنفی باشد.'
    }
    total += line.quantity * line.unitPrice
    if (!Number.isSafeInteger(total) || total > MAX_INVOICE_AMOUNT) {
      return 'مبلغ فاکتور نباید بیشتر از ۱۰۰ میلیارد ریال باشد.'
    }
  }
  return ''
}
