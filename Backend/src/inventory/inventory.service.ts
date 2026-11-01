import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BuyerDto,
  CreateInvoiceDto,
  CreateMovementDto,
  InvoiceQueryDto,
  FinalizeInvoiceDto,
  UpdateStoreSettingsDto,
} from './inventory.dto.js';

export const MAX_INVOICE_AMOUNT = 100_000_000_000;

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true } }>;

// Invoice amounts use exact database decimals; API amounts carry their stored currency.
function invoiceResponse<T extends InvoiceWithItems>(invoice: T) {
  return {
    ...invoice,
    subtotal: invoice.subtotal.toNumber(),
    discount: invoice.discount.toNumber(),
    total: invoice.total.toNumber(),
    paidAmount: invoice.paidAmount.toNumber(),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice?.toNumber() ?? null,
      total: item.total?.toNumber() ?? null,
    })),
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async movements() {
    const movements = await this.prisma.inventoryTransaction.findMany({
      include: {
        product: { select: { id: true, name: true, unit: true } },
        invoice: { select: { number: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    return movements.map((movement) => ({
      ...movement,
      unitPrice: movement.unitPrice?.toNumber() ?? null,
    }));
  }

  async createMovement(data: CreateMovementDto) {
    if (data.type === 'ADJUSTMENT')
      throw new BadRequestException(
        'اصلاح موجودی از این فرم پشتیبانی نمی‌شود.',
      );
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: data.productId },
      });
      if (!product) throw new NotFoundException('محصول پیدا نشد.');
      if (data.type === 'RETURN' && data.invoiceId) {
        const invoice = await tx.invoice.findUnique({
          where: { id: data.invoiceId },
        });
        if (!invoice) throw new NotFoundException('فاکتور پیدا نشد.');
        // Serialize returns and edits on the same invoice before reading sold quantities.
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { number: invoice.number },
        });
        const sold = await tx.invoiceItem.aggregate({
          where: { invoiceId: data.invoiceId, productId: product.id },
          _sum: { quantity: true },
        });
        const returned = await tx.inventoryTransaction.aggregate({
          where: {
            invoiceId: data.invoiceId,
            productId: product.id,
            type: 'RETURN',
          },
          _sum: { quantity: true },
        });
        if (
          !sold._sum.quantity ||
          sold._sum.quantity - (returned._sum.quantity ?? 0) < data.quantity
        )
          throw new BadRequestException(
            'مقدار مرجوعی از تعداد فروش‌رفته بیشتر است.',
          );
      }
      const updated = await tx.product.update({
        where: { id: product.id },
        data: {
          stock: { increment: data.quantity },
          ...(data.type === 'PURCHASE' && data.unitPrice !== undefined
            ? { buyPrice: data.unitPrice }
            : {}),
          ...(data.type === 'PURCHASE' && data.sellPrice !== undefined
            ? { sellPrice: data.sellPrice }
            : {}),
        },
      });
      const movement = await tx.inventoryTransaction.create({
        data: {
          productId: product.id,
          type: data.type,
          quantity: data.quantity,
          unitPrice: data.unitPrice,
          description: data.description,
          invoiceId: data.invoiceId,
          createdAt: data.date ? new Date(data.date) : undefined,
        },
        include: { product: true, invoice: { select: { number: true } } },
      });
      if (
        data.type === 'PURCHASE' &&
        ((data.unitPrice !== undefined &&
          data.unitPrice !== product.buyPrice) ||
          (data.sellPrice !== undefined &&
            data.sellPrice !== product.sellPrice))
      )
        await tx.priceHistory.create({
          data: {
            productId: product.id,
            oldBuyPrice: product.buyPrice,
            newBuyPrice: data.unitPrice ?? product.buyPrice,
            oldSellPrice: product.sellPrice,
            newSellPrice: data.sellPrice ?? product.sellPrice,
            type: 'SINGLE',
          },
        });
      await tx.auditLog.create({
        data: {
          productId: product.id,
          action: 'STOCK_RECEIVED',
          details: { quantity: data.quantity, stock: updated.stock },
        },
      });
      return { ...movement, unitPrice: movement.unitPrice?.toNumber() ?? null };
    });
  }

  buyers() {
    return this.prisma.buyer.findMany({
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
  }
  async buyer(id: number) {
    const buyer = await this.prisma.buyer.findUnique({ where: { id } });
    if (!buyer) throw new NotFoundException('خریدار پیدا نشد.');
    return buyer;
  }
  async createBuyer(data: BuyerDto) {
    try {
      return await this.prisma.buyer.create({ data: this.buyerData(data) });
    } catch (error) {
      this.handleBuyerConflict(error);
    }
  }
  async updateBuyer(id: number, data: BuyerDto) {
    await this.buyer(id);
    try {
      return await this.prisma.buyer.update({
        where: { id },
        data: this.buyerData(data),
      });
    } catch (error) {
      this.handleBuyerConflict(error);
    }
  }
  async deleteBuyer(id: number) {
    await this.buyer(id);
    await this.prisma.buyer.delete({ where: { id } });
    return { deleted: true };
  }

  async createInvoice(data: CreateInvoiceDto) {
    return this.writeInvoice(data);
  }

  async updateInvoice(id: number, data: CreateInvoiceDto) {
    return this.writeInvoice(data, id);
  }

  private async writeInvoice(data: CreateInvoiceDto, id?: number) {
    if (!Array.isArray(data.items) || data.items.length === 0)
      throw new BadRequestException('حداقل یک کالا به فاکتور اضافه کنید.');
    const inputCurrency = data.currency ?? 'IRR';
    const amounts = [
      data.discount,
      data.paidAmount,
      ...data.items.map((item) => item.unitPrice),
    ].filter((amount): amount is number => amount != null);
    if (
      !['IRR', 'TOMAN'].includes(inputCurrency) ||
      amounts.some(
        (amount) =>
          !Number.isFinite(amount) ||
          (inputCurrency === 'IRR'
            ? !Number.isSafeInteger(amount)
            : !new Prisma.Decimal(amount).mul(10).isInteger()),
      )
    )
      throw new BadRequestException('مبالغ فاکتور معتبر نیستند.');
    // New whole-toman invoices are stored in tomans. Keep fractional legacy tomans as exact integer rials.
    const currency =
      inputCurrency === 'TOMAN' && amounts.every(Number.isInteger)
        ? 'TOMAN'
        : 'IRR';
    const inputFactor =
      inputCurrency === 'TOMAN' && currency === 'IRR' ? 10 : 1;
    if (inputFactor !== 1)
      data = {
        ...data,
        discount:
          data.discount == null
            ? undefined
            : new Prisma.Decimal(data.discount).mul(inputFactor).toNumber(),
        paidAmount:
          data.paidAmount == null
            ? undefined
            : new Prisma.Decimal(data.paidAmount).mul(inputFactor).toNumber(),
        items: data.items.map((item) => ({
          ...item,
          unitPrice:
            item.unitPrice == null
              ? undefined
              : new Prisma.Decimal(item.unitPrice).mul(inputFactor).toNumber(),
        })),
      };
    const maxAmount =
      currency === 'TOMAN' ? MAX_INVOICE_AMOUNT / 10 : MAX_INVOICE_AMOUNT;
    const saleType = data.saleType ?? 'REGULAR';
    const credit = saleType === 'CREDIT';
    if (!['REGULAR', 'CREDIT'].includes(saleType))
      throw new BadRequestException('نوع فروش معتبر نیست.');
    if (
      credit &&
      ((data.discount ?? 0) !== 0 ||
        data.items.some((item) => item.unitPrice != null))
    )
      throw new BadRequestException('در فروش نسیه قیمت و تخفیف ثبت نمی‌شود.');
    for (const item of data.items)
      if (
        !Number.isInteger(item.productId) ||
        item.productId < 1 ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 2_147_483_647 ||
        (!credit &&
          (!Number.isInteger(item.unitPrice) ||
            item.unitPrice! < 0 ||
            item.unitPrice! > maxAmount))
      )
        throw new BadRequestException('اطلاعات اقلام فاکتور معتبر نیست.');
    const subtotal = data.items.reduce(
      (sum, item) => sum + (credit ? 0 : item.quantity * item.unitPrice!),
      0,
    );
    if (subtotal > maxAmount)
      throw new BadRequestException(
        'مبلغ فاکتور نباید بیشتر از ۱۰ میلیارد تومان باشد.',
      );
    const discount = data.discount ?? 0;
    const total = subtotal - discount;
    const paidAmount =
      data.paidAmount ??
      (credit || data.settlement === 'INSTALLMENT' ? 0 : total);
    if (
      !Number.isSafeInteger(subtotal) ||
      !Number.isInteger(discount) ||
      discount < 0 ||
      discount > subtotal ||
      !Number.isInteger(paidAmount) ||
      paidAmount < 0 ||
      paidAmount > maxAmount ||
      (!credit && paidAmount > total)
    ) {
      throw new BadRequestException(
        'جمع، تخفیف یا مبلغ پرداختی فاکتور معتبر نیست.',
      );
    }
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    const dateText = data.issueDate ?? today;
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateText) ||
      !Number.isFinite(new Date(dateText).getTime()) ||
      new Date(dateText).toISOString().slice(0, 10) !== dateText
    ) {
      throw new BadRequestException('تاریخ صدور معتبر نیست.');
    }
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const previous = id
            ? await tx.invoice.findUnique({
                where: { id },
                include: { items: true },
              })
            : null;
          if (id && !previous) throw new NotFoundException('فاکتور پیدا نشد.');
          if (previous) {
            const factor =
              (previous.currency === 'IRR' ? 1 : 10) /
              (currency === 'IRR' ? 1 : 10);
            const unchanged =
              saleType === (previous.saleType ?? 'REGULAR') &&
              (data.customerId ?? null) === (previous.customerId ?? null) &&
              dateText === previous.issueDate?.toISOString().slice(0, 10) &&
              discount === previous.discount.toNumber() * factor &&
              paidAmount === previous.paidAmount.toNumber() * factor &&
              (data.settlement ?? 'CASH') === previous.settlement &&
              (data.notes ?? previous.notes ?? '') === (previous.notes ?? '') &&
              (data.customerId != null ||
                ((data.buyerFirstName ?? '') ===
                  (previous.buyerFirstName ?? '') &&
                  (data.buyerLastName ?? '') ===
                    (previous.buyerLastName ?? '') &&
                  (data.buyerNationalId ?? '') ===
                    (previous.buyerNationalId ?? '') &&
                  (data.buyerAddress ?? '') ===
                    (previous.buyerAddress ?? ''))) &&
              data.items.length === previous.items.length &&
              data.items.every((item, index) => {
                const saved = previous.items[index]!;
                return (
                  item.productId === saved.productId &&
                  item.quantity === saved.quantity &&
                  (credit ||
                    item.unitPrice ===
                      (saved.unitPrice?.toNumber() ?? 0) * factor)
                );
              });
            if (unchanged)
              throw new BadRequestException('تغییری در فاکتور ایجاد نشده است.');
            await tx.invoice.update({
              where: { id: previous.id },
              data: { number: previous.number },
            });
            if (
              await tx.inventoryTransaction.count({
                where: { invoiceId: id, type: 'RETURN' },
              })
            ) {
              throw new ConflictException(
                'فاکتور دارای مرجوعی قابل ویرایش نیست.',
              );
            }
            for (const item of previous.items) {
              await tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
              });
            }
            await tx.inventoryTransaction.deleteMany({
              where: { invoiceId: id, type: 'SALE' },
            });
            await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
          }
          const customer = data.customerId
            ? await tx.buyer.findUnique({ where: { id: data.customerId } })
            : null;
          if (data.customerId && !customer)
            throw new NotFoundException('خریدار انتخاب‌شده پیدا نشد.');
          const products = new Map(
            (
              await tx.product.findMany({
                where: {
                  id: { in: data.items.map((i) => i.productId) },
                  isActive: true,
                },
              })
            ).map((p) => [p.id, p]),
          );
          const items = data.items.map((item) => {
            const p = products.get(item.productId);
            if (!p)
              throw new NotFoundException(`محصول ${item.productId} پیدا نشد.`);
            return {
              ...item,
              name: p.name,
              unit: p.unit,
              unitPrice: credit ? null : item.unitPrice!,
              total: credit ? null : item.quantity * item.unitPrice!,
            };
          });
          const store = await tx.storeSettings.findUnique({ where: { id: 1 } });
          const invoiceData = {
            customerId: customer?.id ?? null,
            buyerFirstName: customer?.firstName ?? data.buyerFirstName,
            buyerLastName: customer?.lastName ?? data.buyerLastName,
            buyerNationalId: customer
              ? customer.nationalId
              : data.buyerNationalId,
            buyerAddress: customer ? customer.address : data.buyerAddress,
            buyerPhone: customer?.phone,
            notes: data.notes ?? store?.defaultInvoiceNotes ?? '',
            issueDate: new Date(`${dateText}T00:00:00.000Z`),
            saleType,
            subtotal,
            discount,
            total,
            paidAmount,
            settlement: credit ? 'INSTALLMENT' : (data.settlement ?? 'CASH'),
            currency,
            sellerName: store?.name ?? 'فروشگاه',
            sellerAddress: store?.address,
            sellerPhone: store?.phone,
            sellerLogoUrl: store?.logoUrl,
            sellerIban: store?.iban,
            sellerIbanLabel: store?.ibanLabel,
            items: { create: items },
          };
          const invoice = previous
            ? await tx.invoice.update({ where: { id }, data: invoiceData })
            : await tx.invoice.create({ data: invoiceData });
          const number = String(invoice.id).padStart(3, '0');
          await tx.invoice.update({
            where: { id: invoice.id },
            data: { number },
          });
          for (const item of items) {
            const changed = await tx.product.updateMany({
              where: {
                id: item.productId,
                isActive: true,
                stock: { gte: item.quantity },
              },
              data: { stock: { decrement: item.quantity } },
            });
            if (!changed.count)
              throw new BadRequestException(
                `موجودی «${item.name}» برای این فروش کافی نیست.`,
              );
            await tx.inventoryTransaction.create({
              data: {
                productId: item.productId,
                type: 'SALE',
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                currency,
                invoiceId: invoice.id,
                description: `فاکتور ${number}`,
              },
            });
          }
          return invoiceResponse(
            await tx.invoice.findUniqueOrThrow({
              where: { id: invoice.id },
              include: { items: true },
            }),
          );
        },
        { isolationLevel: 'Serializable', timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'اطلاعات موجودی هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.',
        );
      throw error;
    }
  }

  async invoices(query: InvoiceQueryDto = {}) {
    const buyerText = query.buyer?.trim();
    const date =
      query.from || query.to
        ? {
            issueDate: {
              ...(query.from
                ? { gte: new Date(`${query.from}T00:00:00.000Z`) }
                : {}),
              ...(query.to
                ? { lte: new Date(`${query.to}T23:59:59.999Z`) }
                : {}),
            },
          }
        : {};
    const buyerFilters: Prisma.InvoiceWhereInput[] = [];
    if (query.customerId) {
      const selectedBuyer = await this.prisma.buyer.findUnique({
        where: { id: query.customerId },
      });
      buyerFilters.push(
        selectedBuyer
          ? {
              OR: [
                { customerId: selectedBuyer.id },
                {
                  buyerFirstName: selectedBuyer.firstName,
                  buyerLastName: selectedBuyer.lastName,
                  ...(selectedBuyer.nationalId
                    ? { buyerNationalId: selectedBuyer.nationalId }
                    : {}),
                },
              ],
            }
          : { customerId: query.customerId },
      );
    }
    if (buyerText)
      buyerFilters.push({
        OR: [
          { buyerFirstName: { contains: buyerText, mode: 'insensitive' } },
          { buyerLastName: { contains: buyerText, mode: 'insensitive' } },
          { buyerNationalId: { contains: buyerText, mode: 'insensitive' } },
          {
            customer: {
              is: {
                OR: [
                  { firstName: { contains: buyerText, mode: 'insensitive' } },
                  { lastName: { contains: buyerText, mode: 'insensitive' } },
                  { nationalId: { contains: buyerText, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    const where: Prisma.InvoiceWhereInput = {
      ...date,
      ...(query.openOnly === 'true'
        ? {
            OR: [
              { saleType: 'CREDIT' },
              {
                saleType: 'REGULAR',
                paidAmount: { lt: this.prisma.invoice.fields.total },
              },
            ],
          }
        : {}),
      ...(buyerFilters.length ? { AND: buyerFilters } : {}),
    };
    const productText = query.product?.trim();
    if (productText) {
      where.items = {
        some: {
          OR: [
            { name: { contains: productText, mode: 'insensitive' } },
            {
              product: { name: { contains: productText, mode: 'insensitive' } },
            },
          ],
        },
      };
    }
    const invoices = await this.prisma.invoice.findMany({
      where,
      include: { items: true, customer: true },
      orderBy: [{ issueDate: 'desc' }, { id: 'desc' }],
      take: query.openOnly === 'true' ? undefined : 500,
    });
    return invoices.map(invoiceResponse);
  }
  invoice(id: number) {
    return this.prisma.invoice
      .findUnique({ where: { id }, include: { items: true } })
      .then((v) => {
        if (!v) throw new NotFoundException('فاکتور پیدا نشد.');
        return invoiceResponse(v);
      });
  }
  // The app sends tomans; legacy callers may explicitly send rials. Accumulate in the invoice currency.
  async updateInvoicePayment(
    id: number,
    paymentAmount: number,
    currency: 'IRR' | 'TOMAN' = 'IRR',
  ) {
    if (currency === 'TOMAN' && Number.isFinite(paymentAmount))
      paymentAmount = new Prisma.Decimal(paymentAmount).mul(10).toNumber();
    if (
      !Number.isSafeInteger(paymentAmount) ||
      paymentAmount <= 0 ||
      paymentAmount > MAX_INVOICE_AMOUNT
    )
      throw new BadRequestException(
        'مبلغ پرداخت جدید باید عدد صحیح و بیشتر از صفر باشد.',
      );
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const invoice = await tx.invoice.findUnique({ where: { id } });
          if (!invoice) throw new NotFoundException('فاکتور پیدا نشد.');
          const factor = invoice.currency === 'IRR' ? 1 : 10;
          if (paymentAmount % factor)
            throw new BadRequestException(
              'برای فاکتور تومانی، مبلغ باید مضربی از یک تومان باشد.',
            );
          const increment = paymentAmount / factor;
          const paidAmount = invoice.paidAmount.toNumber() + increment;
          if (paidAmount * factor > MAX_INVOICE_AMOUNT)
            throw new BadRequestException(
              'مجموع پرداختی از محدوده مجاز بیشتر است.',
            );
          if (
            invoice.saleType !== 'CREDIT' &&
            paidAmount > invoice.total.toNumber()
          )
            throw new BadRequestException(
              'پرداخت جدید از مانده فاکتور بیشتر است.',
            );
          return invoiceResponse(
            await tx.invoice.update({
              where: { id },
              data: { paidAmount: { increment } },
              include: { items: true },
            }),
          );
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'پرداخت یا اطلاعات فاکتور هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.',
        );
      throw error;
    }
  }

  // Read and finalize against the same quote; concurrent price/payment edits require a fresh preview.
  private async finalizationQuote(tx: Prisma.TransactionClient, id: number) {
    const invoice = await tx.invoice.findUnique({
      where: { id },
      include: { items: { orderBy: { id: 'asc' } } },
    });
    if (!invoice) throw new NotFoundException('فاکتور پیدا نشد.');
    const credit = invoice.saleType === 'CREDIT';
    const factor = invoice.currency === 'IRR' ? 1 : 10;
    const prices = credit
      ? await tx.product.findMany({
          where: { id: { in: invoice.items.map((item) => item.productId) } },
          select: { id: true, sellPrice: true },
          orderBy: { id: 'asc' },
        })
      : [];
    const priceOf = new Map(
      prices.map((product) => [product.id, product.sellPrice * 10]),
    );
    const items = invoice.items.map((item) => {
      const unitPrice = credit
        ? priceOf.get(item.productId)
        : item.unitPrice?.toNumber();
      const price = credit
        ? unitPrice
        : unitPrice == null
          ? undefined
          : unitPrice * factor;
      if (price == null || !Number.isSafeInteger(price) || price < 0)
        throw new BadRequestException('قیمت روز یکی از کالاها معتبر نیست.');
      return {
        ...item,
        unitPrice: new Prisma.Decimal(price),
        total: new Prisma.Decimal(price * item.quantity),
      };
    });
    const subtotal = credit
      ? items.reduce((sum, item) => sum + item.total.toNumber(), 0)
      : invoice.subtotal.toNumber() * factor;
    const discount = invoice.discount.toNumber() * factor;
    const total = credit
      ? subtotal - discount
      : invoice.total.toNumber() * factor;
    const paidAmount = invoice.paidAmount.toNumber() * factor;
    if (
      ![subtotal, discount, total, paidAmount].every(
        (amount) =>
          Number.isSafeInteger(amount) &&
          amount >= 0 &&
          amount <= MAX_INVOICE_AMOUNT,
      )
    )
      throw new BadRequestException(
        'مبلغ فاکتور یا پرداختی از محدوده مجاز بیشتر است.',
      );
    const token = createHash('sha256')
      .update(JSON.stringify({ invoice, prices }))
      .digest('hex');
    return {
      token,
      wasCredit: credit,
      invoice: {
        ...invoice,
        saleType: 'REGULAR',
        currency: 'IRR',
        subtotal: new Prisma.Decimal(subtotal),
        discount: new Prisma.Decimal(discount),
        total: new Prisma.Decimal(total),
        paidAmount: new Prisma.Decimal(paidAmount),
        items,
      },
    };
  }

  async invoiceFinalizationPreview(id: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const quote = await this.finalizationQuote(tx, id);
        return { token: quote.token, invoice: invoiceResponse(quote.invoice) };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  async finalizeInvoice(id: number, data: FinalizeInvoiceDto) {
    const requestedCurrency = data.currency ?? 'IRR';
    if (requestedCurrency === 'TOMAN')
      data = {
        ...data,
        paymentAmount: Number.isFinite(data.paymentAmount)
          ? new Prisma.Decimal(data.paymentAmount).mul(10).toNumber()
          : data.paymentAmount,
        discount:
          data.discount == null
            ? undefined
            : Number.isFinite(data.discount)
              ? new Prisma.Decimal(data.discount).mul(10).toNumber()
              : data.discount,
      };
    if (
      !Number.isSafeInteger(data.paymentAmount) ||
      data.paymentAmount < 0 ||
      data.paymentAmount > MAX_INVOICE_AMOUNT
    )
      throw new BadRequestException('پرداخت جدید معتبر نیست.');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const quote = await this.finalizationQuote(tx, id);
          if (quote.token !== data.token)
            throw new ConflictException(
              'قیمت کالا یا اطلاعات فاکتور تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.',
            );
          const invoice = quote.invoice;
          const discount = data.discount ?? invoice.discount.toNumber();
          if (
            !Number.isSafeInteger(discount) ||
            discount < 0 ||
            discount > invoice.subtotal.toNumber()
          )
            throw new BadRequestException(
              'تخفیف باید بین صفر و جمع اقلام فاکتور باشد.',
            );
          const total = invoice.subtotal.toNumber() - discount;
          const previousPaid = invoice.paidAmount.toNumber();
          if (
            data.paymentAmount > Math.max(0, total - previousPaid) ||
            previousPaid + data.paymentAmount > MAX_INVOICE_AMOUNT
          )
            throw new BadRequestException(
              'پرداخت جدید از مانده فاکتور بیشتر است.',
            );
          const paidAmount = previousPaid + data.paymentAmount;
          const currency =
            requestedCurrency === 'TOMAN' &&
            [
              invoice.subtotal.toNumber(),
              discount,
              total,
              paidAmount,
              ...invoice.items.flatMap((item) => [
                item.unitPrice.toNumber(),
                item.total.toNumber(),
              ]),
            ].every((amount) => amount % 10 === 0)
              ? 'TOMAN'
              : 'IRR';
          const factor = currency === 'TOMAN' ? 10 : 1;
          // Keep sold quantities and snapshots intact, even for archived products or invoices with returns.
          for (const item of invoice.items) {
            await tx.invoiceItem.update({
              where: { id: item.id },
              data: {
                unitPrice: item.unitPrice.div(factor),
                total: item.total.div(factor),
              },
            });
            if (quote.wasCredit)
              await tx.inventoryTransaction.updateMany({
                where: {
                  invoiceId: id,
                  productId: item.productId,
                  type: 'SALE',
                },
                data: { unitPrice: item.unitPrice.div(factor), currency },
              });
          }
          return invoiceResponse(
            await tx.invoice.update({
              where: { id },
              data: {
                saleType: 'REGULAR',
                currency,
                subtotal: invoice.subtotal.div(factor),
                discount: discount / factor,
                total: total / factor,
                paidAmount: paidAmount / factor,
                settlement: quote.wasCredit
                  ? paidAmount >= total
                    ? 'CASH'
                    : 'INSTALLMENT'
                  : invoice.settlement,
              },
              include: { items: true },
            }),
          );
        },
        { isolationLevel: 'Serializable', timeout: 15000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'اطلاعات فاکتور هم‌زمان تغییر کرده است؛ پیش‌نمایش را دوباره دریافت کنید.',
        );
      throw error;
    }
  }

  async storeSettings() {
    return (
      (await this.prisma.storeSettings.findUnique({ where: { id: 1 } })) ??
      this.prisma.storeSettings.create({ data: { id: 1, name: 'فروشگاه' } })
    );
  }
  async updateStoreSettings(data: UpdateStoreSettingsDto) {
    return this.prisma.storeSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
  }

  private handleBuyerConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    )
      throw new ConflictException(
        'کد ملی واردشده برای خریدار دیگری ثبت شده است.',
      );
    throw error;
  }

  private buyerData(data: BuyerDto) {
    return {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      nationalId: data.nationalId?.trim() || null,
      phone: data.phone?.trim() || null,
      address: data.address?.trim() || null,
      notes: data.notes?.trim() || null,
    };
  }
}
