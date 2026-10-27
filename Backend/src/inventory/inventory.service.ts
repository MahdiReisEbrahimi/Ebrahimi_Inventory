import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  BuyerDto,
  CreateInvoiceDto,
  CreateMovementDto,
  InvoiceQueryDto,
  UpdateStoreSettingsDto,
} from './inventory.dto.js';

export const MAX_INVOICE_AMOUNT = 100_000_000_000;

type InvoiceWithItems = Prisma.InvoiceGetPayload<{ include: { items: true } }>;

// Invoice amounts use exact database decimals; the API keeps numeric rial values.
function invoiceResponse<T extends InvoiceWithItems>(invoice: T) {
  return {
    ...invoice,
    subtotal: invoice.subtotal.toNumber(),
    discount: invoice.discount.toNumber(),
    total: invoice.total.toNumber(),
    paidAmount: invoice.paidAmount.toNumber(),
    items: invoice.items.map((item) => ({
      ...item,
      unitPrice: item.unitPrice.toNumber(),
      total: item.total.toNumber(),
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
    for (const item of data.items)
      if (
        !Number.isInteger(item.productId) ||
        item.productId < 1 ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0 ||
        item.quantity > 2_147_483_647 ||
        !Number.isInteger(item.unitPrice) ||
        item.unitPrice < 0 ||
        item.unitPrice > MAX_INVOICE_AMOUNT
      )
        throw new BadRequestException('اطلاعات اقلام فاکتور معتبر نیست.');
    const subtotal = data.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    );
    if (subtotal > MAX_INVOICE_AMOUNT)
      throw new BadRequestException(
        'مبلغ فاکتور نباید بیشتر از ۱۰۰ میلیارد ریال باشد.',
      );
    const discount = data.discount ?? 0;
    const total = subtotal - discount;
    const paidAmount =
      data.paidAmount ?? (data.settlement === 'INSTALLMENT' ? 0 : total);
    if (
      !Number.isSafeInteger(subtotal) ||
      !Number.isInteger(discount) ||
      discount < 0 ||
      discount > subtotal ||
      !Number.isInteger(paidAmount) ||
      paidAmount < 0 ||
      paidAmount > total
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
              total: item.quantity * item.unitPrice,
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
            subtotal,
            discount,
            total,
            paidAmount,
            settlement: data.settlement ?? 'CASH',
            currency: 'IRR',
            sellerName: store?.name ?? 'فروشگاه',
            sellerAddress: store?.address,
            sellerPhone: store?.phone,
            sellerLogoUrl: store?.logoUrl,
            sellerIban: store?.iban,
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
                currency: 'IRR',
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
      take: 500,
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
