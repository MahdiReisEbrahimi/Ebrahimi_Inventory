import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InventoryService } from '../src/inventory/inventory.service.js';

// Explicit opt-in: creates isolated, tagged test records and removes only those records.
describe.skipIf(process.env.RUN_INVOICE_DB_TESTS !== '1')(
  'Invoice persistence and stock',
  () => {
    let prisma: PrismaService;
    let service: InventoryService;
    let categoryId: number;
    let productId: number;
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
      if (productId) {
        await prisma.auditLog.deleteMany({ where: { productId } });
        await prisma.priceHistory.deleteMany({ where: { productId } });
        await prisma.product.delete({ where: { id: productId } });
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
  },
);
