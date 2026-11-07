import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';

type Tx = Prisma.TransactionClient;
type Document = Prisma.InvoiceGetPayload<{
  include: { items: true; transactions: true };
}>;
export const rial = (value: Prisma.Decimal | number, currency: string) =>
  new Prisma.Decimal(value).mul(currency === 'IRR' ? 1 : 10);
const zero = () => new Prisma.Decimal(0);
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export async function partyDocuments(tx: Tx, buyerId: number) {
  return tx.invoice.findMany({
    where: { customerId: buyerId },
    include: {
      items: { orderBy: { id: 'asc' } },
      transactions: { where: { type: 'RETURN' }, orderBy: { id: 'asc' } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
}

// Discount belongs to the original sale. Cumulative rounding ensures a complete
// return reverses exactly its net charge, including single-rial historical amounts.
export function documentCharges(documents: Document[]) {
  const charges = new Map<number, Prisma.Decimal>();
  const returned = new Map<number, Prisma.Decimal>();
  for (const doc of documents) {
    if (doc.kind === 'RETURN') continue;
    const total =
      doc.saleType === 'CREDIT' ? zero() : rial(doc.total, doc.currency);
    charges.set(doc.id, doc.kind === 'PURCHASE' ? total.neg() : total);
    const subtotal = rial(doc.subtotal, doc.currency);
    let cumulativeGross = zero(),
      previousNet = zero();
    const legacy = new Map<number, number>();
    for (const movement of doc.transactions ?? [])
      legacy.set(
        movement.productId,
        (legacy.get(movement.productId) ?? 0) + movement.quantity,
      );
    for (const line of doc.items) {
      const quantity = Math.min(line.quantity, legacy.get(line.productId) ?? 0);
      legacy.set(line.productId, (legacy.get(line.productId) ?? 0) - quantity);
      cumulativeGross = cumulativeGross.add(
        line.unitPrice == null
          ? 0
          : rial(line.unitPrice, doc.currency).mul(quantity),
      );
    }
    if (
      doc.kind === 'SALE' &&
      cumulativeGross.gt(0) &&
      subtotal.gt(0) &&
      doc.saleType !== 'CREDIT'
    ) {
      previousNet = Prisma.Decimal.min(
        total,
        cumulativeGross
          .mul(total)
          .div(subtotal)
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP),
      );
      charges.set(doc.id, total.sub(previousNet));
    }
    for (const ret of documents.filter(
      (d) => d.kind === 'RETURN' && d.sourceInvoiceId === doc.id,
    )) {
      const gross = ret.items.reduce((sum, line) => {
        const source = doc.items.find((item) => item.id === line.sourceItemId);
        return sum.add(
          source?.unitPrice == null
            ? 0
            : rial(source.unitPrice, doc.currency).mul(line.quantity),
        );
      }, zero());
      cumulativeGross = cumulativeGross.add(gross);
      const net =
        subtotal.gt(0) && doc.saleType !== 'CREDIT'
          ? Prisma.Decimal.min(
              total,
              cumulativeGross
                .mul(total)
                .div(subtotal)
                .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP),
            )
          : zero();
      charges.set(ret.id, net.sub(previousNet).neg());
      previousNet = net;
    }
    returned.set(doc.id, previousNet);
  }
  return { charges, returned };
}

export async function recordCash(
  tx: Tx,
  buyerId: number,
  amountRial: Prisma.Decimal | number,
  direction: 'IN' | 'OUT',
  options: {
    invoiceId?: number;
    action?: string;
    description?: string;
    requestKey?: string;
    historical?: boolean;
  } = {},
) {
  const amount = new Prisma.Decimal(amountRial);
  if (!amount.isInteger() || amount.lte(0))
    throw new BadRequestException('مبلغ پرداخت معتبر نیست.');
  return tx.partyLedgerEntry.create({
    data: {
      buyerId,
      invoiceId: options.invoiceId,
      action:
        options.action ?? (direction === 'IN' ? 'RECEIPT' : 'DISBURSEMENT'),
      description:
        options.description ??
        (direction === 'IN'
          ? 'دریافت وجه از طرف حساب'
          : 'پرداخت وجه به طرف حساب'),
      amountRial: direction === 'IN' ? amount.neg() : amount,
      cashDirection: direction,
      requestKey: options.requestKey,
      historical: options.historical ?? false,
    },
  });
}

// Lazy, transactional import: old cumulative receipts have no reliable payment
// timestamp. They are explicitly marked historical rather than backdated.
export async function prepareParty(tx: Tx, buyerId?: number | null) {
  if (!buyerId) return;
  if (!(await tx.buyer.findUnique({ where: { id: buyerId } })))
    throw new NotFoundException('طرف حساب پیدا نشد.');
  const documents = await partyDocuments(tx, buyerId);
  const { charges, returned } = documentCharges(documents);
  for (const doc of documents.filter((d) => d.accountChargeRial == null)) {
    const charge = charges.get(doc.id) ?? zero();
    await tx.partyLedgerEntry.create({
      data: {
        buyerId,
        invoiceId: doc.id,
        action: 'OPENING',
        historical: true,
        description: `انتقال سابقه فاکتور ${doc.number}`,
        amountRial: charge,
        details: json({ after: doc }),
      },
    });
    if (doc.kind !== 'RETURN' && doc.paidAmount.gt(0))
      await recordCash(
        tx,
        buyerId,
        rial(doc.paidAmount, doc.currency),
        doc.kind === 'PURCHASE' ? 'OUT' : 'IN',
        {
          invoiceId: doc.id,
          action: 'OPENING_PAYMENT',
          historical: true,
          description:
            'مجموع پرداخت‌های قبلی؛ زمان دقیق پرداخت‌ها در داده قدیمی موجود نیست',
        },
      );
    await tx.invoice.update({
      where: { id: doc.id },
      data: {
        accountChargeRial: charge,
        accountReturnedRial: returned.get(doc.id) ?? 0,
      },
    });
  }
}

export async function syncParty(
  tx: Tx,
  buyerId: number | null | undefined,
  focusId?: number,
  action = 'INVOICE_UPDATED',
  before?: unknown,
  allocate = true,
) {
  if (!buyerId) return;
  const documents = await partyDocuments(tx, buyerId);
  const { charges, returned } = documentCharges(documents);
  for (const doc of documents) {
    const charge = charges.get(doc.id) ?? zero();
    const delta = charge.sub(doc.accountChargeRial ?? 0);
    if (!delta.isZero() || doc.id === focusId || doc.accountChargeRial == null)
      await tx.partyLedgerEntry.create({
        data: {
          buyerId,
          invoiceId: doc.id,
          action: doc.id === focusId ? action : 'RETURN_REVALUED',
          description: `${
            doc.id === focusId
              ? ({
                  PARTY_ASSIGNED: 'اتصال به طرف حساب؛ فاکتور',
                  INVOICE_CREATED: 'ثبت فاکتور',
                  INVOICE_UPDATED: 'ویرایش فاکتور',
                  FINALIZED: 'نهایی‌کردن فاکتور',
                  RETURN_CREATED: 'ثبت مرجوعی',
                }[action] ?? 'تغییر فاکتور')
              : 'اصلاح ارزش مرجوعی'
          } ${doc.number}`,
          amountRial: delta,
          details: json({
            before: doc.id === focusId ? before : undefined,
            after: doc,
          }),
        },
      });
    await tx.invoice.update({
      where: { id: doc.id },
      data: {
        accountChargeRial: charge,
        accountReturnedRial: returned.get(doc.id) ?? 0,
      },
    });
  }
  if (allocate) await allocatePartyCash(tx, buyerId);
}

export async function allocatePartyCash(tx: Tx, buyerId: number) {
  const docs = await partyDocuments(tx, buyerId);
  const cash = await tx.partyLedgerEntry.aggregate({
    where: { buyerId, cashDirection: { not: null } },
    _sum: { amountRial: true },
  });
  const signedCash = cash._sum.amountRial ?? zero();
  // A party normally has a single role. Separate pools also preserve old mixed fixtures.
  let incoming = Prisma.Decimal.max(0, signedCash.neg());
  let outgoing = Prisma.Decimal.max(0, signedCash);
  for (const doc of [
    ...docs.filter((d) => d.kind !== 'RETURN' && d.saleType !== 'CREDIT'),
    ...docs.filter((d) => d.kind !== 'RETURN' && d.saleType === 'CREDIT'),
  ]) {
    const supplier = doc.kind === 'PURCHASE';
    const available = supplier ? outgoing : incoming;
    const charge = Prisma.Decimal.max(
      0,
      rial(doc.total, doc.currency).sub(doc.accountReturnedRial),
    );
    const amount = Prisma.Decimal.min(
      available,
      doc.saleType === 'CREDIT' ? 100_000_000_000 : charge,
    );
    if (supplier) outgoing = outgoing.sub(amount);
    else incoming = incoming.sub(amount);
    const factor = doc.currency === 'IRR' ? 1 : 10;
    if (!rial(doc.paidAmount, doc.currency).eq(amount)) {
      await tx.partyLedgerEntry.create({
        data: {
          buyerId,
          invoiceId: doc.id,
          action: 'ALLOCATION',
          description: `تخصیص پرداخت حساب به فاکتور ${doc.number}`,
          amountRial: 0,
          details: json({
            before: doc,
            after: { ...doc, paidAmount: amount.div(factor) },
          }),
        },
      });
    }
    if (factor === 10 && !amount.mod(10).isZero()) {
      // Convert the complete document, never round an allocated historical rial.
      for (const item of doc.items)
        await tx.invoiceItem.update({
          where: { id: item.id },
          data: {
            unitPrice: item.unitPrice?.mul(10),
            total: item.total?.mul(10),
          },
        });
      const movements = await tx.inventoryTransaction.findMany({
        where: { invoiceId: doc.id, currency: 'TOMAN' },
      });
      for (const movement of movements)
        await tx.inventoryTransaction.update({
          where: { id: movement.id },
          data: { currency: 'IRR', unitPrice: movement.unitPrice?.mul(10) },
        });
      await tx.invoice.update({
        where: { id: doc.id },
        data: {
          currency: 'IRR',
          total: doc.total.mul(10),
          subtotal: doc.subtotal.mul(10),
          discount: doc.discount.mul(10),
          paidAmount: amount,
        },
      });
    } else if (!doc.paidAmount.eq(amount.div(factor))) {
      await tx.invoice.update({
        where: { id: doc.id },
        data: { paidAmount: amount.div(factor) },
      });
    }
  }
}
