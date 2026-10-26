import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { ProductsService } from '../src/products/products.service.js';

// Explicit opt-in: creates isolated, tagged test records and removes only those records.
describe.skipIf(process.env.RUN_INVOICE_DB_TESTS !== '1')(
  'Invoice persistence and stock',
  () => {
    let prisma: PrismaService;
    let service: InventoryService;
    let categoryId: number;
    let productId: number;
    let secondProductId: number;
    let buyerId: number;
    let invoiceId: number;
    const tag = `invoice-test-${randomUUID()}`;

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
            stock: 20,
            buyPrice: 50,
            sellPrice: 100,
          },
        })
      ).id;
      secondProductId = (
        await prisma.product.create({
          data: {
            name: `${tag}-second`,
            categoryId,
            unit: 'عدد',
            stock: 7,
            buyPrice: 30,
            sellPrice: 70,
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
        const ids = (
          await prisma.invoice.findMany({
            where: { customerId: buyerId },
            select: { id: true },
          })
        ).map((invoice) => invoice.id);
        await prisma.inventoryTransaction.deleteMany({
          where: { invoiceId: { in: ids } },
        });
        await prisma.invoice.deleteMany({ where: { customerId: buyerId } });
        await prisma.buyer.delete({ where: { id: buyerId } });
      }
      for (const id of [productId, secondProductId].filter(Boolean)) {
        await prisma.inventoryTransaction.deleteMany({
          where: { productId: id },
        });
        await prisma.auditLog.deleteMany({ where: { productId: id } });
        await prisma.priceHistory.deleteMany({ where: { productId: id } });
        await prisma.product.delete({ where: { id } });
      }
      if (categoryId)
        await prisma.category.delete({ where: { id: categoryId } });
      await prisma.$disconnect();
    });

    it('persists issue date, rial amounts, snapshots and readable number atomically', async () => {
      const invoice = await service.createInvoice({
        customerId: buyerId,
        issueDate: '2026-10-25',
        discount: 100,
        paidAmount: 500,
        settlement: 'INSTALLMENT',
        notes: 'توضیح مخصوص فاکتور',
        items: [{ productId, quantity: 2, unitPrice: 1000 }],
      });
      invoiceId = invoice.id;
      expect(invoice.number).toMatch(/^\d{3,}$/);
      expect(invoice.issueDate.toISOString().slice(0, 10)).toBe('2026-10-25');
      expect(invoice.currency).toBe('IRR');
      expect(invoice.subtotal).toBe(2000);
      expect(invoice.total).toBe(1900);
      expect(invoice.paidAmount).toBe(500);
      expect(invoice.notes).toBe('توضیح مخصوص فاکتور');
      expect(invoice.sellerName).toBeTruthy();
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(18);
      const movement = await prisma.inventoryTransaction.findFirstOrThrow({
        where: { invoiceId },
      });
      expect(movement.currency).toBe('IRR');
      expect(movement.unitPrice).toBe(1000);
    });

    it('edits an invoice without double-decrementing stock or duplicating sale movements', async () => {
      const invoice = await service.updateInvoice(invoiceId, {
        customerId: buyerId,
        issueDate: '2026-10-26',
        items: [{ productId, quantity: 3, unitPrice: 1000 }],
      });
      expect(invoice.total).toBe(3000);
      expect(invoice.paidAmount).toBe(3000);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(17);
      expect(
        await prisma.inventoryTransaction.count({
          where: { invoiceId, type: 'SALE' },
        }),
      ).toBe(1);
      expect(invoice.items).toHaveLength(1);
    });

    it('rolls back the invoice, lines and stock when an edit oversells', async () => {
      await expect(
        service.updateInvoice(invoiceId, {
          customerId: buyerId,
          items: [{ productId, quantity: 99, unitPrice: 1000 }],
        }),
      ).rejects.toThrow('کافی نیست');
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(17);
      expect((await service.invoice(invoiceId)).items[0]?.quantity).toBe(3);
      expect(
        await prisma.inventoryTransaction.count({
          where: { invoiceId, type: 'SALE' },
        }),
      ).toBe(1);
    });

    it('restores stock when quantities decrease and repeated edits are idempotent', async () => {
      const data = {
        customerId: buyerId,
        items: [{ productId, quantity: 1, unitPrice: 1000 }],
      };
      for (let attempt = 0; attempt < 2; attempt++) {
        const invoice = await service.updateInvoice(invoiceId, data);
        expect(invoice.total).toBe(1000);
        expect(
          (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
            .stock,
        ).toBe(19);
        const sales = await prisma.inventoryTransaction.findMany({
          where: { invoiceId, type: 'SALE' },
        });
        expect(sales).toHaveLength(1);
        expect(sales[0].quantity).toBe(1);
      }
      await service.updateInvoice(invoiceId, {
        ...data,
        items: [{ productId, quantity: 3, unitPrice: 1000 }],
      });
    });

    it('restores the entire quantity of a removed invoice line', async () => {
      const data = {
        customerId: buyerId,
        items: [{ productId, quantity: 3, unitPrice: 1000 }],
      };
      await service.updateInvoice(invoiceId, {
        ...data,
        items: [
          ...data.items,
          { productId: secondProductId, quantity: 2, unitPrice: 700 },
        ],
      });
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: secondProductId },
          })
        ).stock,
      ).toBe(5);
      await service.updateInvoice(invoiceId, data);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: secondProductId },
          })
        ).stock,
      ).toBe(7);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(17);
      expect(
        await prisma.inventoryTransaction.count({
          where: { invoiceId, productId: secondProductId },
        }),
      ).toBe(0);
    });

    it('rejects invalid discounts, overpayments and invalid calendar dates', async () => {
      const base = {
        customerId: buyerId,
        items: [{ productId, quantity: 1, unitPrice: 1000 }],
      };
      await expect(
        service.createInvoice({ ...base, discount: 1001 }),
      ).rejects.toThrow('معتبر نیست');
      await expect(
        service.createInvoice({ ...base, paidAmount: 1001 }),
      ).rejects.toThrow('معتبر نیست');
      await expect(
        service.createInvoice({ ...base, issueDate: '2026-02-30' }),
      ).rejects.toThrow('معتبر نیست');
      expect(
        await prisma.invoice.count({ where: { customerId: buyerId } }),
      ).toBe(1);
    });

    it('protects invoices with returns from editing', async () => {
      await service.createMovement({
        type: 'RETURN',
        productId,
        quantity: 1,
        invoiceId,
      });
      await expect(
        service.updateInvoice(invoiceId, {
          customerId: buyerId,
          items: [{ productId, quantity: 1, unitPrice: 1000 }],
        }),
      ).rejects.toThrow('مرجوعی');
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(18);
    });
    it('registers a return using only quantity without an invoice or price change', async () => {
      const movement = await service.createMovement({
        type: 'RETURN',
        productId,
        quantity: 2,
      });
      expect(movement.invoiceId).toBeNull();
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(20);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .buyPrice,
      ).toBe(50);
    });

    it('updates both purchase prices atomically and preserves them for an unchanged-price purchase', async () => {
      await service.createMovement({
        type: 'PURCHASE',
        productId,
        quantity: 3,
        unitPrice: 60,
        sellPrice: 120,
      });
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ stock: 23, buyPrice: 60, sellPrice: 120 });
      expect(
        await prisma.priceHistory.findFirstOrThrow({
          where: { productId },
          orderBy: { id: 'desc' },
        }),
      ).toMatchObject({
        oldBuyPrice: 50,
        newBuyPrice: 60,
        oldSellPrice: 100,
        newSellPrice: 120,
      });
      const count = await prisma.priceHistory.count({ where: { productId } });
      await service.createMovement({
        type: 'PURCHASE',
        productId,
        quantity: 1,
      });
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ stock: 24, buyPrice: 60, sellPrice: 120 });
      expect(await prisma.priceHistory.count({ where: { productId } })).toBe(
        count,
      );
    });

    it('previews and applies a bulk increase to both prices with a complete history', async () => {
      const products = new ProductsService(prisma);
      const data = {
        categoryId,
        priceType: 'BOTH' as const,
        type: 'PERCENTAGE' as const,
        value: 10,
      };
      const preview = await products.previewBulkPriceUpdate(data);
      expect(preview.affectedProducts).toBe(2);
      expect(preview.items.find((item) => item.id === productId)).toMatchObject(
        {
          oldBuyPrice: 60,
          newBuyPrice: 66,
          oldSellPrice: 120,
          newSellPrice: 132,
        },
      );
      await products.bulkPriceUpdate(data);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ buyPrice: 66, sellPrice: 132 });
      expect(
        await prisma.priceHistory.findFirstOrThrow({
          where: { productId },
          orderBy: { id: 'desc' },
        }),
      ).toMatchObject({
        type: 'BULK',
        oldBuyPrice: 60,
        newBuyPrice: 66,
        oldSellPrice: 120,
        newSellPrice: 132,
      });
      await products.bulkPriceUpdate({ ...data, type: 'FIXED', value: 99 });
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ buyPrice: 99, sellPrice: 99 });
      await products.bulkPriceUpdate({
        ...data,
        priceType: 'SELL',
        type: 'FIXED',
        value: 150,
      });
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ buyPrice: 99, sellPrice: 150 });
    });

    it('archives invoiced products while preserving their invoice and stock', async () => {
      await new ProductsService(prisma).delete(productId);
      expect(
        await prisma.product.findUniqueOrThrow({ where: { id: productId } }),
      ).toMatchObject({ isActive: false, stock: 24 });
      expect((await service.invoice(invoiceId)).items[0]?.productId).toBe(
        productId,
      );
    });
  },
);
