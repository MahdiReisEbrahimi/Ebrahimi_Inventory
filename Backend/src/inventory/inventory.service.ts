import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvoiceDto, CreateMovementDto, UpdateStoreSettingsDto } from './inventory.dto.js';

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

  async createInvoice(data: CreateInvoiceDto) {
    if (!Array.isArray(data.items) || data.items.length === 0) throw new BadRequestException('حداقل یک کالا به فاکتور اضافه کنید.');
    for (const item of data.items) if (!Number.isInteger(item.productId) || !Number.isInteger(item.quantity) || item.quantity <= 0 || !Number.isInteger(item.unitPrice) || item.unitPrice < 0) throw new BadRequestException('اطلاعات اقلام فاکتور معتبر نیست.');
    const number = `INV-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const products = new Map((await tx.product.findMany({ where: { id: { in: data.items.map((i) => i.productId) }, isActive: true } })).map((p) => [p.id, p]));
      const items = data.items.map((item) => {
        const p = products.get(item.productId);
        if (!p) throw new NotFoundException(`محصول ${item.productId} پیدا نشد.`);
        return { ...item, name: p.name, unit: p.unit, total: item.quantity * item.unitPrice };
      });
      const invoice = await tx.invoice.create({ data: { number, buyerFirstName: data.buyerFirstName, buyerLastName: data.buyerLastName, buyerNationalId: data.buyerNationalId, buyerAddress: data.buyerAddress, notes: data.notes, total: items.reduce((sum, i) => sum + i.total, 0), items: { create: items } } });
      for (const item of items) {
        const changed = await tx.product.updateMany({ where: { id: item.productId, isActive: true, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } });
        if (!changed.count) throw new BadRequestException(`موجودی «${item.name}» برای این فروش کافی نیست.`);
        await tx.inventoryTransaction.create({ data: { productId: item.productId, type: 'SALE', quantity: item.quantity, unitPrice: item.unitPrice, invoiceId: invoice.id, description: `فاکتور ${number}` } });
      }
      return tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, include: { items: true } });
    });
  }

  invoices() { return this.prisma.invoice.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' }, take: 200 }); }
  invoice(id: number) { return this.prisma.invoice.findUnique({ where: { id }, include: { items: true } }).then((v) => { if (!v) throw new NotFoundException('فاکتور پیدا نشد.'); return v; }); }
  async storeSettings() { return (await this.prisma.storeSettings.findUnique({ where: { id: 1 } })) ?? this.prisma.storeSettings.create({ data: { id: 1, name: 'فروشگاه' } }); }
  async updateStoreSettings(data: UpdateStoreSettingsDto) { return this.prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1, ...data }, update: data }); }
}
