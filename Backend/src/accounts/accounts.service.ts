import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { InventoryService } from '../inventory/inventory.service.js';
import { splitAccountDiscount } from './account-discounts.js';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  allocatePartyCash,
  partyDocuments,
  prepareParty,
  recordCash,
  rial,
} from './party-ledger.js';

const fingerprint = (value: unknown) =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );

export function toman(value: Prisma.Decimal | number) {
  const amount = new Prisma.Decimal(value).toNumber();
  if (!Number.isSafeInteger(amount))
    throw new BadRequestException('مجموع حساب از محدوده نمایش دقیق بیشتر است.');
  return amount / 10;
}
@Injectable()
export class AccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService = new InventoryService(prisma),
  ) {}
  private async transaction<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: 'Serializable',
          timeout: 60000,
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          if (attempt < 2) continue;
          throw new ConflictException(
            'حساب هم‌زمان تغییر کرده است؛ دوباره دریافت کنید.',
          );
        }
        throw error;
      }
    }
  }
  private async read(
    tx: Prisma.TransactionClient,
    id: number,
    withHistory: boolean,
  ) {
    const buyer = await tx.buyer.findUnique({ where: { id } });
    if (!buyer) throw new NotFoundException('طرف حساب پیدا نشد.');
    await prepareParty(tx, id);
    await allocatePartyCash(tx, id);
    const docs = await partyDocuments(tx, id);
    const entries = await tx.partyLedgerEntry.findMany({
      where: { buyerId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      include: { invoice: { select: { number: true } } },
    });
    let balance = new Prisma.Decimal(0),
      incoming = new Prisma.Decimal(0),
      outgoing = new Prisma.Decimal(0);
    const history = entries.map((entry) => {
      balance = balance.add(entry.amountRial);
      if (entry.cashDirection === 'IN')
        incoming = incoming.sub(entry.amountRial);
      if (entry.cashDirection === 'OUT')
        outgoing = outgoing.add(entry.amountRial);
      return {
        ...entry,
        amountRial: undefined,
        amount: toman(entry.amountRial),
        debit: toman(Prisma.Decimal.max(0, entry.amountRial)),
        credit: toman(Prisma.Decimal.max(0, entry.amountRial.neg())),
        balance: toman(balance),
        invoiceNumber: entry.invoice?.number,
      };
    });
    const supplier =
      docs.some((d) => d.kind === 'PURCHASE') &&
      !docs.some((d) => d.kind === 'SALE');
    const pending = docs.filter(
      (d) => d.kind === 'SALE' && d.saleType === 'CREDIT',
    ).length;
    const documents = docs.map((doc) => ({
      ...doc,
      accountChargeRial: undefined,
      accountReturnedRial: undefined,
      subtotal: Number(doc.subtotal),
      discount: Number(doc.discount),
      total: Number(doc.total),
      paidAmount: Number(doc.paidAmount),
      accountValueAmount:
        Number(doc.accountChargeRial?.abs() ?? 0) /
        (doc.currency === 'IRR' ? 1 : 10),
      returnedAmount:
        Number(doc.accountReturnedRial) / (doc.currency === 'IRR' ? 1 : 10),
      items: doc.items.map((line) => ({
        ...line,
        unitPrice: line.unitPrice == null ? null : Number(line.unitPrice),
        total: line.total == null ? null : Number(line.total),
      })),
    }));
    const charge = balance.add(incoming).sub(outgoing);
    return {
      buyer,
      role: supplier ? 'SUPPLIER' : 'CUSTOMER',
      balance: toman(balance),
      incoming: toman(incoming),
      outgoing: toman(outgoing),
      total: toman(supplier ? charge.neg() : charge),
      paid: toman(supplier ? outgoing.sub(incoming) : incoming.sub(outgoing)),
      pendingCount: pending,
      invoiceCount: docs.filter((d) => d.kind !== 'RETURN').length,
      isOpen: !balance.isZero() || pending > 0,
      invoices: withHistory ? documents : undefined,
      entries: withHistory ? history : undefined,
    };
  }
  async list(all = false) {
    const buyers = await this.prisma.buyer.findMany({
      where: {
        OR: [{ invoices: { some: {} } }, { ledgerEntries: { some: {} } }],
      },
      select: { id: true },
      orderBy: [{ lastName: 'asc' }, { id: 'asc' }],
    });
    const result: Awaited<ReturnType<AccountsService['read']>>[] = [];
    for (const buyer of buyers) {
      const account = await this.transaction((tx) =>
        this.read(tx, buyer.id, false),
      );
      if (all || account.isOpen) result.push(account);
    }
    // Unassigned invoices are not merged by a potentially ambiguous buyer name.
    const unassigned = await this.prisma.invoice.count({
      where: { customerId: null },
    });
    return { accounts: result, unassignedCount: unassigned };
  }
  detail(id: number) {
    return this.transaction((tx) => this.read(tx, id, true));
  }
  async cash(
    id: number,
    data: {
      amount: number;
      kind: 'PAYMENT' | 'REFUND';
      requestKey: string;
      description?: string;
    },
  ) {
    const amount = new Prisma.Decimal(data.amount).mul(10);
    if (!amount.isInteger() || amount.lte(0) || amount.gt(100_000_000_000))
      throw new BadRequestException(
        'مبلغ باید بیشتر از صفر و حداکثر ۱۰ میلیارد تومان با یک اعشار باشد.',
      );
    return this.transaction(async (tx) => {
      const previous = await tx.partyLedgerEntry.findUnique({
        where: { requestKey: data.requestKey },
      });
      if (previous) {
        if (
          previous.buyerId !== id ||
          !previous.amountRial.abs().eq(amount) ||
          previous.action !== data.kind
        )
          throw new ConflictException(
            'شناسه پرداخت قبلاً برای عملیات دیگری استفاده شده است.',
          );
        return this.read(tx, id, true);
      }
      const account = await this.read(tx, id, true);
      const supplier = account.role === 'SUPPLIER';
      const refund = data.kind === 'REFUND';
      const surplus = supplier
        ? Math.max(0, account.balance)
        : Math.max(0, -account.balance);
      if (
        refund &&
        (account.pendingCount > 0 ||
          amount.gt(new Prisma.Decimal(surplus).mul(10)))
      )
        throw new BadRequestException(
          account.pendingCount > 0
            ? 'برای برگشت وجه، ابتدا فاکتورهای نسیه قیمت‌گذاری شوند.'
            : 'برگشت وجه نمی‌تواند بیشتر از بستانکاری طرف حساب باشد.',
        );
      const direction = supplier !== refund ? 'OUT' : 'IN';
      await recordCash(tx, id, amount, direction, {
        action: data.kind,
        requestKey: data.requestKey,
        description:
          data.description?.trim() ||
          (refund
            ? supplier
              ? 'دریافت برگشت وجه از تأمین‌کننده'
              : 'برگشت وجه به مشتری'
            : supplier
              ? 'پرداخت به تأمین‌کننده'
              : 'دریافت پرداخت مشتری'),
      });
      return this.read(tx, id, true);
    });
  }
  private async returnableInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
  ) {
    if (!(await tx.buyer.findUnique({ where: { id } })))
      throw new NotFoundException('طرف حساب پیدا نشد.');
    const sources = await tx.invoice.findMany({
      where: { customerId: id, kind: 'SALE' },
      select: { id: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    type Lot = {
      sourceInvoiceId: number;
      sourceItemId: number;
      quantity: number;
      unitPrice: number | null;
      createdAt: Date;
    };
    const products = new Map<
      number,
      {
        productId: number;
        name: string;
        unit: string;
        quantity: number;
        lots: Lot[];
      }
    >();
    for (const document of sources) {
      const source = await this.inventory.returnableSnapshot(tx, document.id);
      for (const line of source.items) {
        if (!line.returnableQuantity) continue;
        const product = products.get(line.productId) ?? {
          productId: line.productId,
          name: line.name,
          unit: line.unit,
          quantity: 0,
          lots: [],
        };
        product.quantity += line.returnableQuantity;
        product.lots.push({
          sourceInvoiceId: source.id,
          sourceItemId: line.id,
          quantity: line.returnableQuantity,
          unitPrice:
            line.unitPrice == null
              ? null
              : toman(rial(line.unitPrice, source.currency)),
          createdAt: source.createdAt,
        });
        products.set(line.productId, product);
      }
    }
    return { products: [...products.values()] };
  }
  returnable(id: number) {
    return this.transaction((tx) => this.returnableInTransaction(tx, id));
  }

  async returnGoods(
    id: number,
    data: {
      items: { productId: number; quantity: number }[];
      notes?: string;
      requestKey: string;
    },
  ) {
    if (
      !data.items?.length ||
      data.items.some(
        (line) =>
          !Number.isSafeInteger(line.productId) ||
          line.productId <= 0 ||
          !Number.isSafeInteger(line.quantity) ||
          line.quantity <= 0,
      ) ||
      new Set(data.items.map((line) => line.productId)).size !==
        data.items.length
    )
      throw new BadRequestException('کالا و تعداد مرجوعی معتبر نیست.');
    const request = {
      items: [...data.items].sort((a, b) => a.productId - b.productId),
      notes: data.notes ?? '',
    };
    return this.transaction(async (tx) => {
      const previous = await tx.partyLedgerEntry.findUnique({
        where: { requestKey: data.requestKey },
      });
      if (previous) {
        const details = previous.details as { request?: unknown } | null;
        if (
          previous.buyerId !== id ||
          previous.action !== 'ACCOUNT_RETURNED' ||
          fingerprint(details?.request) !== fingerprint(request)
        )
          throw new ConflictException('شناسه درخواست قبلاً استفاده شده است.');
        return this.read(tx, id, true);
      }
      await prepareParty(tx, id);
      const available = await this.returnableInTransaction(tx, id);
      const groups = new Map<
        number,
        { productId: number; sourceItemId: number; quantity: number }[]
      >();
      for (const requested of data.items) {
        const product = available.products.find(
          (item) => item.productId === requested.productId,
        );
        if (!product || requested.quantity > product.quantity)
          throw new BadRequestException(
            'تعداد مرجوعی از مجموع کالای تحویل‌شده و مرجوع‌نشده این طرف حساب بیشتر است.',
          );
        let remaining = requested.quantity;
        for (const lot of product.lots) {
          const quantity = Math.min(remaining, lot.quantity);
          if (!quantity) continue;
          const items = groups.get(lot.sourceInvoiceId) ?? [];
          items.push({
            productId: requested.productId,
            sourceItemId: lot.sourceItemId,
            quantity,
          });
          groups.set(lot.sourceInvoiceId, items);
          remaining -= quantity;
        }
      }
      const documentIds: number[] = [];
      for (const [sourceInvoiceId, items] of groups) {
        const returned = await this.inventory.createReturnInvoice(
          { kind: 'RETURN', sourceInvoiceId, items, notes: data.notes },
          tx,
        );
        documentIds.push(returned.id);
      }
      await tx.partyLedgerEntry.create({
        data: {
          buyerId: id,
          action: 'ACCOUNT_RETURNED',
          description: 'ثبت مرجوعی صورت‌حساب',
          amountRial: 0,
          requestKey: data.requestKey,
          details: { request, documentIds },
        },
      });
      return this.read(tx, id, true);
    });
  }

  private async finalizationInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
    desiredDiscount?: number,
  ) {
    const account = await this.read(tx, id, true);
    const documents = await partyDocuments(tx, id);
    const candidates = documents.filter(
      (doc) =>
        doc.kind === 'SALE' &&
        (doc.saleType === 'CREDIT' ||
          rial(doc.total, doc.currency)
            .sub(doc.accountReturnedRial)
            .gt(rial(doc.paidAmount, doc.currency))),
    );
    const quotes: Awaited<ReturnType<InventoryService['finalizationQuote']>>[] =
      [];
    for (const document of candidates)
      quotes.push(await this.inventory.finalizationQuote(tx, document.id));
    const subtotal = quotes.reduce(
      (sum, quote) => sum.add(quote.invoice.subtotal),
      new Prisma.Decimal(0),
    );
    const originalDiscount = quotes.reduce(
      (sum, quote) => sum.add(quote.invoice.discount),
      new Prisma.Decimal(0),
    );
    const discount =
      desiredDiscount == null
        ? originalDiscount
        : new Prisma.Decimal(desiredDiscount).mul(10);
    const discounts = splitAccountDiscount(
      quotes.map((quote) => quote.invoice),
      discount,
    );
    let replaced = new Prisma.Decimal(0),
      newNet = new Prisma.Decimal(0),
      returns = new Prisma.Decimal(0);
    const invoices = quotes.map((quote) => {
      const before = quote.originalInvoice,
        invoice = quote.invoice;
      replaced = replaced.add(
        before.saleType === 'CREDIT'
          ? 0
          : rial(before.total, before.currency).sub(before.accountReturnedRial),
      );
      const chosen = discounts.get(invoice.id)!;
      const total = invoice.subtotal.sub(chosen);
      const returned = invoice.subtotal.gt(0)
        ? Prisma.Decimal.min(
            total,
            total
              .mul(invoice.returnGrossAmount)
              .div(invoice.subtotal)
              .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP),
          )
        : new Prisma.Decimal(0);
      newNet = newNet.add(total.sub(returned));
      returns = returns.add(returned);
      return {
        ...invoice,
        wasCredit: quote.wasCredit,
        subtotal: toman(invoice.subtotal),
        discount: toman(chosen),
        total: toman(total),
        paidAmount: toman(invoice.paidAmount),
        returnedAmount: toman(returned),
        currency: 'TOMAN',
        accountChargeRial: undefined,
        accountReturnedRial: undefined,
        returnGrossAmount: toman(invoice.returnGrossAmount),
        items: invoice.items.map((line) => ({
          ...line,
          unitPrice: toman(line.unitPrice),
          total: toman(line.total),
        })),
      };
    });
    const total = new Prisma.Decimal(account.total)
      .mul(10)
      .sub(replaced)
      .add(newNet);
    const sign = account.role === 'SUPPLIER' ? -1 : 1;
    const balance = total
      .sub(new Prisma.Decimal(account.paid).mul(10))
      .mul(sign);
    const token = createHash('sha256')
      .update(
        JSON.stringify({
          id,
          documents,
          quotes: quotes.map((quote) => quote.token),
          lastEntryId: account.entries?.at(-1)?.id,
          discount: discount.toString(),
          balance: balance.toString(),
        }),
      )
      .digest('hex');
    return {
      token,
      buyer: account.buyer,
      role: account.role,
      invoices,
      subtotal: toman(subtotal),
      discount: toman(discount),
      previousDiscount: toman(originalDiscount),
      returnedAmount: toman(returns),
      total: toman(total),
      paid: account.paid,
      balance: toman(balance),
      pendingCount: account.pendingCount,
      discounts,
    };
  }
  finalizationPreview(id: number, discount?: number) {
    return this.transaction(async (tx) => {
      const { discounts, ...quote } = await this.finalizationInTransaction(
        tx,
        id,
        discount,
      );
      void discounts;
      return quote;
    });
  }
  async finalize(
    id: number,
    data: {
      token: string;
      discount: number;
      paymentAmount: number;
      requestKey: string;
    },
  ) {
    const payment = new Prisma.Decimal(data.paymentAmount).mul(10);
    if (!payment.isInteger() || payment.lt(0) || payment.gt(100_000_000_000))
      throw new BadRequestException('مبلغ پرداخت جدید معتبر نیست.');
    const request = {
      discount: data.discount,
      paymentAmount: data.paymentAmount,
    };
    return this.transaction(async (tx) => {
      const previous = await tx.partyLedgerEntry.findUnique({
        where: { requestKey: data.requestKey },
      });
      if (previous) {
        const details = previous.details as {
          request?: unknown;
          statement?: unknown;
        } | null;
        if (
          previous.buyerId !== id ||
          previous.action !== 'ACCOUNT_FINALIZED' ||
          fingerprint(details?.request) !== fingerprint(request)
        )
          throw new ConflictException('شناسه درخواست قبلاً استفاده شده است.');
        return {
          account: await this.read(tx, id, true),
          statement: details?.statement,
        };
      }
      const quote = await this.finalizationInTransaction(tx, id, data.discount);
      if (quote.token !== data.token)
        throw new ConflictException(
          'صورت‌حساب یا قیمت کالا تغییر کرده است؛ محاسبه را دوباره دریافت کنید.',
        );
      const remaining = new Prisma.Decimal(quote.balance).mul(
        quote.role === 'SUPPLIER' ? -10 : 10,
      );
      if (payment.gt(Prisma.Decimal.max(0, remaining)))
        throw new BadRequestException(
          'پرداخت جدید از مانده صورت‌حساب بیشتر است.',
        );
      for (const document of quote.invoices) {
        const fresh = await this.inventory.finalizationQuote(tx, document.id);
        await this.inventory.finalizeInvoice(
          document.id,
          {
            currency: 'TOMAN',
            token: fresh.token,
            discount: toman(quote.discounts.get(document.id)!),
            paymentAmount: 0,
          },
          tx,
        );
      }
      if (payment.gt(0))
        await recordCash(
          tx,
          id,
          payment,
          quote.role === 'SUPPLIER' ? 'OUT' : 'IN',
          { description: 'پرداخت هنگام نهایی‌کردن صورت‌حساب' },
        );
      await allocatePartyCash(tx, id);
      for (const document of quote.invoices.filter(
        (invoice) => invoice.wasCredit,
      )) {
        const invoice = await tx.invoice.findUniqueOrThrow({
          where: { id: document.id },
        });
        const covered = rial(invoice.paidAmount, invoice.currency)
          .add(invoice.accountReturnedRial)
          .gte(rial(invoice.total, invoice.currency));
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { settlement: covered ? 'CASH' : 'INSTALLMENT' },
        });
      }
      const account = await this.read(tx, id, true);
      const entry = await tx.partyLedgerEntry.create({
        data: {
          buyerId: id,
          action: 'ACCOUNT_FINALIZED',
          description: 'نهایی‌کردن صورت‌حساب',
          amountRial: 0,
          requestKey: data.requestKey,
        },
      });
      const statement = await this.statementInTransaction(
        tx,
        id,
        account,
        entry.id,
      );
      await tx.partyLedgerEntry.update({
        where: { id: entry.id },
        data: {
          details: JSON.parse(
            JSON.stringify({ request, statement }),
          ) as Prisma.InputJsonValue,
        },
      });
      return { account: await this.read(tx, id, true), statement };
    });
  }
  private async statementInTransaction(
    tx: Prisma.TransactionClient,
    id: number,
    account: Awaited<ReturnType<AccountsService['read']>>,
    entryId: number,
  ) {
    const documents = await partyDocuments(tx, id);
    const kind = account.role === 'SUPPLIER' ? 'PURCHASE' : 'SALE';
    const items: {
      id: number;
      productId: number;
      name: string;
      unit: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }[] = [];
    let subtotal = new Prisma.Decimal(0);
    for (const document of documents.filter((doc) => doc.kind === kind)) {
      const source =
        kind === 'SALE'
          ? await this.inventory.returnableSnapshot(tx, document.id)
          : {
              ...document,
              items: document.items.map((line) => ({
                ...line,
                returnableQuantity: line.quantity,
              })),
            };
      for (const line of source.items) {
        if (!line.returnableQuantity || line.unitPrice == null) continue;
        const unitPrice = rial(line.unitPrice, source.currency),
          total = unitPrice.mul(line.returnableQuantity);
        subtotal = subtotal.add(total);
        items.push({
          id: line.id,
          productId: line.productId,
          name: line.name,
          unit: line.unit,
          quantity: line.returnableQuantity,
          unitPrice: unitPrice.toNumber(),
          total: total.toNumber(),
        });
      }
    }
    const store = await tx.storeSettings.findUnique({ where: { id: 1 } });
    const total = new Prisma.Decimal(account.total).mul(10);
    return {
      id: -entryId,
      documentTitle: 'صورت‌حساب طرف حساب',
      kind,
      number: `حساب ${id} / ${entryId}`,
      customerId: id,
      buyerFirstName: account.buyer.firstName,
      buyerLastName: account.buyer.lastName,
      buyerNationalId: account.buyer.nationalId,
      buyerAddress: account.buyer.address,
      buyerPhone: account.buyer.phone,
      sellerName: store?.name ?? 'فروشگاه',
      sellerAddress: store?.address,
      sellerPhone: store?.phone,
      sellerLogoUrl: store?.logoUrl,
      sellerIban: store?.iban,
      sellerIbanLabel: store?.ibanLabel,
      currency: 'IRR',
      saleType: 'REGULAR',
      settlement: account.balance === 0 ? 'CASH' : 'INSTALLMENT',
      subtotal: subtotal.toNumber(),
      discount: subtotal.sub(total).toNumber(),
      total: total.toNumber(),
      paidAmount: new Prisma.Decimal(account.paid).mul(10).toNumber(),
      returnedAmount: 0,
      notes: 'صورت‌حساب تجمیعی پس از کسر مرجوعی‌ها و تخفیف‌ها',
      issueDate: new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tehran',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date()),
      createdAt: new Date().toISOString(),
      items,
    };
  }
}
