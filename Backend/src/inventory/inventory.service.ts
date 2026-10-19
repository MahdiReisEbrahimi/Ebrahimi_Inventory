import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BuyerDto, CreateInvoiceDto, CreateMovementDto, InvoiceQueryDto, UpdateStoreSettingsDto } from './inventory.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  movements() {
    return this.prisma.inventoryTransaction.findMany({
      include: { product: { select: { id: true, name: true, sku: true, unit: true } }, invoice: { select: { number: true } } },
      orderBy: { createdAt: 'desc' }, take: 500,
    });
  }

  async createMovement(data: CreateMovementDto) {
    if (data.type === 'ADJUSTMENT') throw new BadRequestException('اصلاح موجودی از این فرم پشتیبانی نمی‌شود.');
    if (data.type === 'RETURN' && !data.invoiceId) throw new BadRequestException('برای ثبت مرجوعی، فاکتور فروش را انتخاب کنید.');
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: data.productId } });
      if (!product) throw new NotFoundException('محصول پیدا نشد.');
      if (data.type === 'RETURN') {
        const sold = await tx.invoiceItem.aggregate({ where: { invoiceId: data.invoiceId, productId: product.id }, _sum: { quantity: true } });
        const returned = await tx.inventoryTransaction.aggregate({ where: { invoiceId: data.invoiceId, productId: product.id, type: 'RETURN' }, _sum: { quantity: true } });
        if (!sold._sum.quantity || sold._sum.quantity - (returned._sum.quantity ?? 0) < data.quantity) throw new BadRequestException('مقدار مرجوعی از تعداد فروش‌رفته بیشتر است.');
      }
      const updated = await tx.product.update({ where: { id: product.id }, data: { stock: { increment: data.quantity }, ...(data.unitPrice !== undefined ? { buyPrice: data.unitPrice } : {}) } });
      const movement = await tx.inventoryTransaction.create({ data: { productId: product.id, type: data.type, quantity: data.quantity, unitPrice: data.unitPrice, description: data.description, invoiceId: data.invoiceId, createdAt: data.date ? new Date(data.date) : undefined }, include: { product: true, invoice: { select: { number: true } } } });
      if (data.unitPrice !== undefined && data.unitPrice !== product.buyPrice) await tx.priceHistory.create({ data: { productId: product.id, oldBuyPrice: product.buyPrice, newBuyPrice: data.unitPrice, oldSellPrice: product.sellPrice, newSellPrice: product.sellPrice, type: 'SINGLE' } });
      await tx.auditLog.create({ data: { productId: product.id, action: 'STOCK_RECEIVED', details: { quantity: data.quantity, stock: updated.stock } } });
      return movement;
    });
  }

  buyers() { return this.prisma.buyer.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }); }
  async buyer(id: number) {
    const buyer = await this.prisma.buyer.findUnique({ where: { id } });
    if (!buyer) throw new NotFoundException('خریدار پیدا نشد.');
    return buyer;
  }
  async createBuyer(data: BuyerDto) {
    try { return await this.prisma.buyer.create({ data: this.buyerData(data) }); }
    catch (error) { this.handleBuyerConflict(error); }
  }
  async updateBuyer(id: number, data: BuyerDto) {
    await this.buyer(id);
    try { return await this.prisma.buyer.update({ where: { id }, data: this.buyerData(data) }); }
    catch (error) { this.handleBuyerConflict(error); }
  }
  async deleteBuyer(id: number) { await this.buyer(id); await this.prisma.buyer.delete({ where: { id } }); return { deleted: true }; }

  async createInvoice(data: CreateInvoiceDto) {
    if (!Array.isArray(data.items) || data.items.length === 0) throw new BadRequestException('حداقل یک کالا به فاکتور اضافه کنید.');
    for (const item of data.items) if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.unitPrice) || item.unitPrice < 0) throw new BadRequestException('اطلاعات اقلام فاکتور معتبر نیست.');
    const number = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const customer = data.customerId ? await tx.buyer.findUnique({ where: { id: data.customerId } }) : null;
      if (data.customerId && !customer) throw new NotFoundException('خریدار انتخاب‌شده پیدا نشد.');
      const products = new Map((await tx.product.findMany({ where: { id: { in: data.items.map((i) => i.productId) }, isActive: true } })).map((p) => [p.id, p]));
      const items = data.items.map((item) => {
        const p = products.get(item.productId);
        if (!p) throw new NotFoundException(`محصول ${item.productId} پیدا نشد.`);
        return { ...item, name: p.name, unit: p.unit, total: item.quantity * item.unitPrice };
      });
      const invoice = await tx.invoice.create({ data: { number, customerId: customer?.id, buyerFirstName: customer?.firstName ?? data.buyerFirstName, buyerLastName: customer?.lastName ?? data.buyerLastName, buyerNationalId: customer ? customer.nationalId : data.buyerNationalId, buyerAddress: customer ? customer.address : data.buyerAddress, notes: data.notes ?? customer?.notes, total: items.reduce((sum, i) => sum + i.total, 0), items: { create: items } } });
      for (const item of items) {
        const changed = await tx.product.updateMany({ where: { id: item.productId, isActive: true, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (!changed.count) throw new BadRequestException(`موجودی «${item.name}» برای این فروش کافی نیست.`);
        await tx.inventoryTransaction.create({ data: { productId: item.productId, type: 'SALE', quantity: item.quantity, unitPrice: item.unitPrice, invoiceId: invoice.id, description: `فاکتور ${number}` } });
      }
      return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { items: true } });
    });
  }

  async invoices(query: InvoiceQueryDto = {}) {
    const buyerText = query.buyer?.trim();
    const date = query.from || query.to ? { createdAt: { ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}), ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {}) } } : {};
    const buyerFilters: Prisma.InvoiceWhereInput[] = [];
    if (query.customerId) {
      const selectedBuyer = await this.prisma.buyer.findUnique({ where: { id: query.customerId } });
      buyerFilters.push(selectedBuyer ? { OR: [
        { customerId: selectedBuyer.id },
        { buyerFirstName: selectedBuyer.firstName, buyerLastName: selectedBuyer.lastName, ...(selectedBuyer.nationalId ? { buyerNationalId: selectedBuyer.nationalId } : {}) },
      ] } : { customerId: query.customerId });
    }
    if (buyerText) buyerFilters.push({ OR: [
      { buyerFirstName: { contains: buyerText, mode: 'insensitive' } },
      { buyerLastName: { contains: buyerText, mode: 'insensitive' } },
      { buyerNationalId: { contains: buyerText, mode: 'insensitive' } },
      { customer: { is: { OR: [{ firstName: { contains: buyerText, mode: 'insensitive' } }, { lastName: { contains: buyerText, mode: 'insensitive' } }, { nationalId: { contains: buyerText, mode: 'insensitive' } }] } } },
    ] });
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
            { product: { sku: { contains: productText, mode: 'insensitive' } } },
          ],
        },
      };
    }
    return this.prisma.invoice.findMany({
      where,
      include: { items: true, customer: true }, orderBy: { createdAt: 'desc' }, take: 500,
    });
  }
  invoice(id: number) { return this.prisma.invoice.findUnique({ where: { id }, include: { items: true } }).then((v) => { if (!v) throw new NotFoundException('فاکتور پیدا نشد.'); return v; }); }
  async storeSettings() { return (await this.prisma.storeSettings.findUnique({ where: { id: 1 } })) ?? this.prisma.storeSettings.create({ data: { id: 1, name: 'فروشگاه' } }); }
  async updateStoreSettings(data: UpdateStoreSettingsDto) { return this.prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }); }

  private handleBuyerConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('کد ملی واردشده برای خریدار دیگری ثبت شده است.');
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
