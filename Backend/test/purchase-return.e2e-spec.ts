import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InventoryService } from '../src/inventory/inventory.service.js';

describe.skipIf(process.env.RUN_INVOICE_DB_TESTS !== '1')(
  'Purchase, linked return and negative stock invoices',
  () => {
    let prisma: PrismaService;
    let service: InventoryService;
    let categoryId: number;
    let productId: number;
    let buyerId: number;
    let saleId: number;
    let sourceItemId: number;
    let purchaseId: number;
    const tag = `purchase-return-test-${randomUUID()}`;
    beforeAll(async () => {
      config({ path: '../.env', quiet: true });
      prisma = new PrismaService();
      await prisma.$connect();
      service = new InventoryService(prisma);
      categoryId = (await prisma.category.create({ data: { name: tag } })).id;
      productId = (
        await prisma.product.create({
          data: {
            name: tag,
            categoryId,
            unit: 'عدد',
            stock: 0,
            buyPrice: 50,
            sellPrice: 100,
          },
        })
      ).id;
      buyerId = (
        await prisma.buyer.create({ data: { firstName: 'تست', lastName: tag } })
      ).id;
    });
    afterAll(async () => {
      if (!prisma) return;
      if (buyerId) {
        const invoices = await prisma.invoice.findMany({
          where: { customerId: buyerId },
          select: { id: true },
        });
        await prisma.inventoryTransaction.deleteMany({
          where: { invoiceId: { in: invoices.map((i) => i.id) } },
        });
        await prisma.invoice.deleteMany({
          where: { customerId: buyerId, kind: 'RETURN' },
        });
        await prisma.invoice.deleteMany({ where: { customerId: buyerId } });
        await prisma.buyer.delete({ where: { id: buyerId } });
      }
      if (productId) {
        await prisma.priceHistory.deleteMany({ where: { productId } });
        await prisma.auditLog.deleteMany({ where: { productId } });
        await prisma.product.delete({ where: { id: productId } });
      }
      if (categoryId)
        await prisma.category.delete({ where: { id: categoryId } });
      await prisma.$disconnect();
    });
    const stock = async () =>
      (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
        .stock;

    it('allows sales and edits to take inventory below zero', async () => {
      const sale = await service.createInvoice({
        currency: 'TOMAN',
        customerId: buyerId,
        paidAmount: 0,
        items: [{ productId, quantity: 3, unitPrice: 100 }],
      });
      saleId = sale.id;
      expect(await stock()).toBe(-3);
      const edited = await service.updateInvoice(saleId, {
        currency: 'TOMAN',
        customerId: buyerId,
        paidAmount: 0,
        items: [{ productId, quantity: 5, unitPrice: 100 }],
      });
      sourceItemId = edited.items[0].id;
      expect(await stock()).toBe(-5);
      expect(
        await prisma.inventoryTransaction.count({
          where: { invoiceId: saleId, type: 'SALE' },
        }),
      ).toBe(1);
    });
    it('records a purchase invoice, increases stock and updates only the purchase price with history', async () => {
      const invoice = await service.createInvoice({
        kind: 'PURCHASE',
        currency: 'TOMAN',
        customerId: buyerId,
        paidAmount: 0,
        items: [{ productId, quantity: 3, unitPrice: 80 }],
      });
      purchaseId = invoice.id;
      expect(invoice.kind).toBe('PURCHASE');
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ stock: -2, buyPrice: 80, sellPrice: 100 });
      expect(
        await prisma.priceHistory.findFirstOrThrow({ where: { productId } }),
      ).toMatchObject({ oldBuyPrice: 50, newBuyPrice: 80 });
      expect(
        await prisma.inventoryTransaction.findFirstOrThrow({
          where: { invoiceId: purchaseId },
        }),
      ).toMatchObject({ type: 'PURCHASE', quantity: 3 });
      expect(
        (
          await service.invoices({ openOnly: 'true', customerId: buyerId })
        ).some((i) => i.id === purchaseId),
      ).toBe(false);
    });
    it('returns at the source snapshot price and name, ignoring current or submitted prices', async () => {
      await prisma.product.update({
        where: { id: productId },
        data: { name: tag + '-renamed', sellPrice: 999 },
      });
      const invoice = await service.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: saleId,
        items: [{ productId, sourceItemId, quantity: 2, unitPrice: 9999 }],
      });
      expect(invoice).toMatchObject({
        kind: 'RETURN',
        sourceInvoiceId: saleId,
        total: 200,
      });
      expect(invoice.items[0]).toMatchObject({
        name: tag,
        unitPrice: 100,
        sourceItemId,
        quantity: 2,
      });
      expect(await stock()).toBe(0);
      const source = await service.returnableInvoice(saleId);
      expect(source.items[0].returnableQuantity).toBe(3);
      await expect(
        service.createInvoice({
          kind: 'RETURN',
          sourceInvoiceId: saleId,
          items: [{ productId, sourceItemId, quantity: 4 }],
        }),
      ).rejects.toThrow('مرجوعی');
      expect(await stock()).toBe(0);
      await expect(
        service.updateInvoice(saleId, {
          currency: 'TOMAN',
          items: [{ productId, quantity: 6, unitPrice: 100 }],
        }),
      ).rejects.toThrow('مرجوعی');
    });
    it('serializes competing returns without exceeding the delivered quantity', async () => {
      const data = {
        kind: 'RETURN' as const,
        sourceInvoiceId: saleId,
        items: [{ productId, sourceItemId, quantity: 2 }],
      };
      const results = await Promise.allSettled([
        service.createInvoice(data),
        service.createInvoice(data),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        (await service.returnableInvoice(saleId)).items[0].returnableQuantity,
      ).toBe(1);
      expect(await stock()).toBe(2);
    });
    it('rejects missing, purchase and mismatched source lines', async () => {
      await expect(
        service.createInvoice({
          kind: 'RETURN',
          items: [{ productId, quantity: 1 }],
        }),
      ).rejects.toThrow('فاکتور مبنا');
      await expect(
        service.createInvoice({
          kind: 'RETURN',
          sourceInvoiceId: purchaseId,
          items: [{ productId, sourceItemId, quantity: 1 }],
        }),
      ).rejects.toThrow('فروش عادی یا نسیه');
      await expect(
        service.createInvoice({
          kind: 'RETURN',
          sourceInvoiceId: saleId,
          items: [{ productId, sourceItemId: 2147483647, quantity: 1 }],
        }),
      ).rejects.toThrow('ردیف مبنا');
      await expect(
        service.createMovement({ type: 'RETURN', productId, quantity: 1 }),
      ).rejects.toThrow('فاکتور مبنا');
    });
    it('keeps unpriced credit returns unpriced even if the source is later finalized', async () => {
      const credit = await service.createInvoice({
        currency: 'TOMAN',
        saleType: 'CREDIT',
        customerId: buyerId,
        items: [{ productId, quantity: 3 }],
      });
      const returned = await service.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: credit.id,
        items: [{ productId, sourceItemId: credit.items[0].id, quantity: 1 }],
      });
      expect(returned.total).toBe(0);
      expect(returned.items[0].unitPrice).toBeNull();
      const quote = await service.invoiceFinalizationPreview(credit.id);
      await service.finalizeInvoice(credit.id, {
        token: quote.token,
        currency: 'TOMAN',
        paymentAmount: 0,
      });
      expect(
        (await service.invoice(returned.id)).items[0].unitPrice,
      ).toBeNull();
      const open = await service.invoices({
        openOnly: 'true',
        customerId: buyerId,
      });
      expect(open.every((i) => i.kind === 'SALE')).toBe(true);
    });
    it('tracks separate source lines for the same product and different prices', async () => {
      const source = await service.createInvoice({
        currency: 'TOMAN',
        customerId: buyerId,
        items: [
          { productId, quantity: 1, unitPrice: 100 },
          { productId, quantity: 1, unitPrice: 200 },
        ],
      });
      const first = await service.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: source.id,
        items: [{ productId, sourceItemId: source.items[0].id, quantity: 1 }],
      });
      expect(first.total).toBe(100);
      await expect(
        service.createInvoice({
          kind: 'RETURN',
          sourceInvoiceId: source.id,
          items: [{ productId, sourceItemId: source.items[0].id, quantity: 1 }],
        }),
      ).rejects.toThrow('مرجوعی');
      const second = await service.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: source.id,
        items: [{ productId, sourceItemId: source.items[1].id, quantity: 1 }],
      });
      expect(second.total).toBe(200);
    });
    it('rolls back the invoice and prices if a purchase has fractional tomans', async () => {
      const before = await stock();
      const count = await prisma.invoice.count({
        where: { customerId: buyerId },
      });
      await expect(
        service.createInvoice({
          kind: 'PURCHASE',
          customerId: buyerId,
          currency: 'TOMAN',
          items: [{ productId, quantity: 1, unitPrice: 80.1 }],
        }),
      ).rejects.toThrow('قیمت خرید');
      expect(await stock()).toBe(before);
      expect(
        await prisma.invoice.count({ where: { customerId: buyerId } }),
      ).toBe(count);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .buyPrice,
      ).toBe(80);
    });
  },
);
