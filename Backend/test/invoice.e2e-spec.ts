import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { AccountsService } from '../src/accounts/accounts.service.js';
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
    const buyerIds: number[] = [];
    async function freshBuyer() {
      buyerId = (
        await prisma.buyer.create({
          data: { firstName: 'تست', lastName: `${tag}-${buyerIds.length}` },
        })
      ).id;
      buyerIds.push(buyerId);
    }
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
      buyerIds.push(buyerId);
    });

    afterAll(async () => {
      if (!prisma) return;
      if (buyerId) {
        const ids = (
          await prisma.invoice.findMany({
            where: { customerId: { in: buyerIds } },
            select: { id: true },
          })
        ).map((invoice) => invoice.id);
        await prisma.inventoryTransaction.deleteMany({
          where: { invoiceId: { in: ids } },
        });
        await prisma.invoice.deleteMany({
          where: { customerId: { in: buyerIds }, kind: 'RETURN' },
        });
        await prisma.invoice.deleteMany({
          where: { customerId: { in: buyerIds } },
        });
        await prisma.buyer.deleteMany({ where: { id: { in: buyerIds } } });
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
      expect(movement.unitPrice?.toNumber()).toBe(1000);
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

    it('rolls back the invoice, lines and stock when an edit contains an unknown product', async () => {
      await expect(
        service.updateInvoice(invoiceId, {
          customerId: buyerId,
          items: [
            { productId, quantity: 99, unitPrice: 1000 },
            { productId: 2147483647, quantity: 1, unitPrice: 1000 },
          ],
        }),
      ).rejects.toThrow('پیدا نشد');
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
        if (attempt === 0) {
          const invoice = await service.updateInvoice(invoiceId, data);
          expect(invoice.total).toBe(1000);
        } else {
          await expect(service.updateInvoice(invoiceId, data)).rejects.toThrow(
            'تغییری در فاکتور',
          );
        }
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
    it('requires a source invoice for returns and preserves purchase prices', async () => {
      await expect(
        service.createMovement({ type: 'RETURN', productId, quantity: 2 }),
      ).rejects.toThrow('فاکتور مبنا');
      const movement = await service.createMovement({
        type: 'RETURN',
        productId,
        quantity: 2,
        invoiceId,
      });
      expect((await service.invoice(movement.invoiceId!)).sourceInvoiceId).toBe(
        invoiceId,
      );
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

    it('persists and edits invoices at the 100 billion rial boundary', async () => {
      // Each financial scenario has its own party now that payments are shared.
      await freshBuyer();
      const largeProduct = await prisma.product.create({
        data: {
          name: `${tag}-large-invoice`,
          categoryId,
          unit: 'عدد',
          stock: 100,
          buyPrice: 100,
          sellPrice: 100,
        },
      });
      let largeInvoiceId: number | undefined;
      try {
        const data = {
          customerId: buyerId,
          discount: 10_000_000_000,
          paidAmount: 40_000_000_000,
          items: [
            {
              productId: largeProduct.id,
              quantity: 50,
              unitPrice: 2_000_000_000,
            },
          ],
        };
        const created = await service.createInvoice(data);
        largeInvoiceId = created.id;
        expect(created.subtotal).toBe(100_000_000_000);
        expect(created.total).toBe(90_000_000_000);
        expect(created.items[0].total).toBe(100_000_000_000);
        expect((await service.invoice(created.id)).paidAmount).toBe(
          40_000_000_000,
        );
        expect(
          (await service.invoices({ customerId: buyerId })).find(
            (i) => i.id === created.id,
          )?.subtotal,
        ).toBe(100_000_000_000);
        const edited = await service.updateInvoice(created.id, {
          ...data,
          discount: 0,
          paidAmount: 100_000_000_000,
          items: [
            {
              productId: largeProduct.id,
              quantity: 1,
              unitPrice: 100_000_000_000,
            },
          ],
        });
        expect(edited.total).toBe(100_000_000_000);
        expect(edited.items[0].unitPrice).toBe(100_000_000_000);
        expect(
          (await service.movements()).find((m) => m.invoiceId === created.id)
            ?.unitPrice,
        ).toBe(100_000_000_000);
        expect(edited.paidAmount).toBe(100_000_000_000);
        await expect(
          service.updateInvoice(created.id, {
            ...data,
            items: [
              ...data.items,
              { productId: largeProduct.id, quantity: 1, unitPrice: 1 },
            ],
          }),
        ).rejects.toThrow('۱۰ میلیارد تومان');
        expect((await service.invoice(created.id)).total).toBe(100_000_000_000);
        expect(
          (
            await prisma.product.findUniqueOrThrow({
              where: { id: largeProduct.id },
            })
          ).stock,
        ).toBe(99);
      } finally {
        if (largeInvoiceId) {
          await prisma.inventoryTransaction.deleteMany({
            where: { invoiceId: largeInvoiceId },
          });
          await prisma.invoice.delete({ where: { id: largeInvoiceId } });
        }
        await prisma.product.delete({ where: { id: largeProduct.id } });
      }
    });

    it('keeps credit invoices open with null prices, then closes a priced invoice after payment', async () => {
      // Each financial scenario has its own party now that payments are shared.
      await freshBuyer();
      const before = await prisma.product.findUniqueOrThrow({
        where: { id: secondProductId },
      });
      const credit = await service.createInvoice({
        customerId: buyerId,
        saleType: 'CREDIT',
        paidAmount: 500,
        issueDate: '2020-01-01',
        items: [{ productId: secondProductId, quantity: 2 }],
      });
      expect(credit.items[0]).toMatchObject({
        unitPrice: null,
        total: null,
        quantity: 2,
      });
      expect(credit.paidAmount).toBe(500);
      expect(
        (
          await prisma.inventoryTransaction.findFirstOrThrow({
            where: { invoiceId: credit.id },
          })
        ).unitPrice,
      ).toBeNull();
      const open = () =>
        service.invoices({ customerId: buyerId, openOnly: 'true' });
      expect((await open()).some((i) => i.id === credit.id)).toBe(true);
      await service.updateInvoicePayment(credit.id, 100);
      await service.updateInvoicePayment(credit.id, 100);
      expect((await open()).find((i) => i.id === credit.id)?.paidAmount).toBe(
        700,
      );
      const priced = await service.updateInvoice(credit.id, {
        customerId: buyerId,
        saleType: 'REGULAR',
        paidAmount: 700,
        discount: 100,
        items: [{ productId: secondProductId, quantity: 2, unitPrice: 1000 }],
      });
      expect(priced.total).toBe(1900);
      expect((await open()).some((i) => i.id === credit.id)).toBe(true);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: secondProductId },
          })
        ).stock,
      ).toBe(before.stock - 2);
      await expect(
        service.updateInvoicePayment(credit.id, 1201),
      ).rejects.toThrow('بیشتر');
      await service.updateInvoicePayment(credit.id, 500);
      expect((await service.invoice(credit.id)).paidAmount).toBe(1200);
      await service.updateInvoicePayment(credit.id, 700);
      expect((await open()).some((i) => i.id === credit.id)).toBe(false);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: secondProductId },
          })
        ).stock,
      ).toBe(before.stock - 2);
      await expect(service.updateInvoicePayment(credit.id, 0)).rejects.toThrow(
        'بیشتر از صفر',
      );
      expect((await service.invoice(credit.id)).paidAmount).toBe(1900);
    });

    it('finalizes at current prices without moving stock, rejects stale quotes, and retains unpaid balances', async () => {
      // Each financial scenario has its own party now that payments are shared.
      await freshBuyer();
      const before = await prisma.product.findUniqueOrThrow({
        where: { id: secondProductId },
      });
      const credit = await service.createInvoice({
        customerId: buyerId,
        saleType: 'CREDIT',
        paidAmount: 100,
        items: [{ productId: secondProductId, quantity: 1 }],
      });
      const firstQuote = await service.invoiceFinalizationPreview(credit.id);
      expect(firstQuote.invoice.total).toBe(before.sellPrice * 10);
      expect((await service.invoice(credit.id)).saleType).toBe('CREDIT');
      await prisma.product.update({
        where: { id: secondProductId },
        data: { sellPrice: before.sellPrice + 7 },
      });
      await expect(
        service.finalizeInvoice(credit.id, {
          token: firstQuote.token,
          paymentAmount: 0,
        }),
      ).rejects.toThrow('پیش‌نمایش');
      expect((await service.invoice(credit.id)).items[0].unitPrice).toBeNull();
      const quote = await service.invoiceFinalizationPreview(credit.id);
      const priced = await service.finalizeInvoice(credit.id, {
        token: quote.token,
        paymentAmount: 0,
      });
      expect(priced).toMatchObject({
        saleType: 'REGULAR',
        settlement: 'INSTALLMENT',
        total: (before.sellPrice + 7) * 10,
        paidAmount: 100,
      });
      expect(
        (
          await service.invoices({ openOnly: 'true', customerId: buyerId })
        ).some((i) => i.id === credit.id),
      ).toBe(true);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: secondProductId },
          })
        ).stock,
      ).toBe(before.stock - 1);
      const sales = await prisma.inventoryTransaction.findMany({
        where: { invoiceId: credit.id, type: 'SALE' },
      });
      expect(sales).toHaveLength(1);
      expect(sales[0].unitPrice?.toNumber()).toBe(priced.total);
      await prisma.product.update({
        where: { id: secondProductId },
        data: { sellPrice: before.sellPrice + 20 },
      });
      const regularQuote = await service.invoiceFinalizationPreview(credit.id);
      expect(regularQuote.invoice.total).toBe(priced.total);
      await expect(
        service.finalizeInvoice(credit.id, {
          token: regularQuote.token,
          paymentAmount: priced.total,
        }),
      ).rejects.toThrow('مانده');
      const closed = await service.finalizeInvoice(credit.id, {
        token: regularQuote.token,
        paymentAmount: priced.total - 100,
      });
      expect(closed.paidAmount).toBe(closed.total);
      expect(
        (
          await service.invoices({ openOnly: 'true', customerId: buyerId })
        ).some((i) => i.id === credit.id),
      ).toBe(false);
      await expect(
        service.finalizeInvoice(credit.id, {
          token: regularQuote.token,
          paymentAmount: priced.total - 100,
        }),
      ).rejects.toThrow('پیش‌نمایش');
      expect((await service.invoice(credit.id)).paidAmount).toBe(closed.total);
      expect(
        (
          await prisma.product.findUniqueOrThrow({
            where: { id: secondProductId },
          })
        ).stock,
      ).toBe(before.stock - 1);
    });

    it('closes credit invoices covered by deposits and preserves surplus payments', async () => {
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: secondProductId },
      });
      for (const surplus of [0, 50]) {
        await freshBuyer();
        const invoice = await service.createInvoice({
          customerId: buyerId,
          saleType: 'CREDIT',
          paidAmount: product.sellPrice * 10 + surplus,
          items: [{ productId: secondProductId, quantity: 1 }],
        });
        const preview = await service.invoiceFinalizationPreview(invoice.id);
        const result = await service.finalizeInvoice(invoice.id, {
          token: preview.token,
          paymentAmount: 0,
        });
        expect(result.saleType).toBe('REGULAR');
        expect(result.settlement).toBe('CASH');
        expect(result.paidAmount).toBe(result.total);
        expect(
          (await new AccountsService(prisma).detail(buyerId)).balance,
        ).toBe(surplus ? -surplus / 10 : 0);
        expect(
          (
            await service.invoices({ openOnly: 'true', customerId: buyerId })
          ).some((i) => i.id === invoice.id),
        ).toBe(false);
      }
    });

    it('finalizes legacy toman invoices in rials and keeps their recorded discount and prices', async () => {
      // Each financial scenario has its own party now that payments are shared.
      await freshBuyer();
      const created = await service.createInvoice({
        customerId: buyerId,
        discount: 100,
        paidAmount: 200,
        items: [{ productId: secondProductId, quantity: 1, unitPrice: 1000 }],
      });
      await prisma.invoice.update({
        where: { id: created.id },
        data: {
          currency: 'TOMAN',
          subtotal: 100,
          discount: 10,
          total: 90,
          paidAmount: 20,
        },
      });
      await prisma.invoiceItem.updateMany({
        where: { invoiceId: created.id },
        data: { unitPrice: 100, total: 100 },
      });
      await expect(
        service.updateInvoicePayment(created.id, 11),
      ).rejects.toThrow('مضربی');
      await service.updateInvoicePayment(created.id, 100);
      expect((await service.invoice(created.id)).paidAmount).toBe(30);
      const preview = await service.invoiceFinalizationPreview(created.id);
      expect(preview.invoice).toMatchObject({
        currency: 'IRR',
        subtotal: 1000,
        discount: 100,
        total: 900,
        paidAmount: 300,
      });
      const result = await service.finalizeInvoice(created.id, {
        token: preview.token,
        paymentAmount: 600,
      });
      expect(result).toMatchObject({
        currency: 'IRR',
        total: 900,
        paidAmount: 900,
      });
      expect(result.items[0].unitPrice).toBe(1000);
    });

    it('allows discounts only at credit finalization and prefills persisted discounts for later changes', async () => {
      // Each financial scenario has its own party now that payments are shared.
      await freshBuyer();
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: secondProductId },
      });
      await expect(
        service.createInvoice({
          customerId: buyerId,
          saleType: 'CREDIT',
          discount: 1,
          items: [{ productId: secondProductId, quantity: 1 }],
        }),
      ).rejects.toThrow('قیمت و تخفیف');
      const created = await service.createInvoice({
        customerId: buyerId,
        saleType: 'CREDIT',
        paidAmount: 100,
        items: [{ productId: secondProductId, quantity: 1 }],
      });
      const quote = await service.invoiceFinalizationPreview(created.id);
      expect(quote.invoice.discount).toBe(0);
      for (const discount of [-1, 0.5, quote.invoice.subtotal + 1]) {
        await expect(
          service.finalizeInvoice(created.id, {
            token: quote.token,
            paymentAmount: 0,
            discount,
          }),
        ).rejects.toThrow('تخفیف');
      }
      expect((await service.invoice(created.id)).saleType).toBe('CREDIT');
      const first = await service.finalizeInvoice(created.id, {
        token: quote.token,
        paymentAmount: 100,
        discount: 200,
      });
      expect(first).toMatchObject({
        discount: 200,
        total: product.sellPrice * 10 - 200,
        paidAmount: 200,
      });
      const secondQuote = await service.invoiceFinalizationPreview(created.id);
      expect(secondQuote.invoice.discount).toBe(200);
      const changed = await service.finalizeInvoice(created.id, {
        token: secondQuote.token,
        paymentAmount: 0,
        discount: 50,
      });
      expect(changed.total).toBe(product.sellPrice * 10 - 50);
      expect(changed.discount).toBe(50);
      const lastQuote = await service.invoiceFinalizationPreview(created.id);
      const closed = await service.finalizeInvoice(created.id, {
        token: lastQuote.token,
        paymentAmount: 0,
        discount: lastQuote.invoice.subtotal - 200,
      });
      expect(closed.total).toBe(200);
      expect(closed.paidAmount).toBe(200);
      expect(
        (
          await service.invoices({ openOnly: 'true', customerId: buyerId })
        ).some((i) => i.id === created.id),
      ).toBe(false);
      const unchangedStock = await prisma.product.findUniqueOrThrow({
        where: { id: secondProductId },
      });
      expect(unchangedStock.stock).toBe(product.stock - 1);
    });

    it('uses tomans for new invoices, payments and final discounts without multiplying stored values', async () => {
      // Each financial scenario has its own party now that payments are shared.
      await freshBuyer();
      await service.createMovement({
        type: 'PURCHASE',
        productId: secondProductId,
        quantity: 4,
      });
      const created = await service.createInvoice({
        currency: 'TOMAN',
        customerId: buyerId,
        discount: 100,
        paidAmount: 500,
        items: [{ productId: secondProductId, quantity: 2, unitPrice: 1250 }],
      });
      expect(created).toMatchObject({
        currency: 'TOMAN',
        subtotal: 2500,
        discount: 100,
        total: 2400,
        paidAmount: 500,
      });
      const movement = await prisma.inventoryTransaction.findFirstOrThrow({
        where: { invoiceId: created.id, type: 'SALE' },
      });
      expect(movement.currency).toBe('TOMAN');
      expect(movement.unitPrice?.toNumber()).toBe(1250);
      await service.updateInvoicePayment(created.id, 200, 'TOMAN');
      expect((await service.invoice(created.id)).paidAmount).toBe(700);
      const quote = await service.invoiceFinalizationPreview(created.id);
      expect(quote.invoice.total).toBe(24000);
      const result = await service.finalizeInvoice(created.id, {
        currency: 'TOMAN',
        token: quote.token,
        discount: 200,
        paymentAmount: 1600,
      });
      expect(result).toMatchObject({
        currency: 'TOMAN',
        subtotal: 2500,
        discount: 200,
        total: 2300,
        paidAmount: 2300,
      });
      const product = await prisma.product.findUniqueOrThrow({
        where: { id: secondProductId },
      });
      const credit = await service.createInvoice({
        currency: 'TOMAN',
        customerId: buyerId,
        saleType: 'CREDIT',
        paidAmount: 100,
        items: [{ productId: secondProductId, quantity: 1 }],
      });
      const creditQuote = await service.invoiceFinalizationPreview(credit.id);
      const finalCredit = await service.finalizeInvoice(credit.id, {
        currency: 'TOMAN',
        token: creditQuote.token,
        discount: 10,
        paymentAmount: product.sellPrice - 110,
      });
      expect(finalCredit).toMatchObject({
        currency: 'TOMAN',
        total: product.sellPrice - 10,
        paidAmount: product.sellPrice - 10,
      });
      expect(finalCredit.items[0].unitPrice).toBe(product.sellPrice);
    });

    it('preserves odd legacy rial amounts when edited or paid through toman inputs', async () => {
      // Each financial scenario has its own party now that payments are shared.
      await freshBuyer();
      const created = await service.createInvoice({
        currency: 'IRR',
        customerId: buyerId,
        discount: 1,
        paidAmount: 101,
        items: [{ productId: secondProductId, quantity: 1, unitPrice: 1251 }],
      });
      const edited = await service.updateInvoice(created.id, {
        currency: 'TOMAN',
        customerId: buyerId,
        discount: 0.1,
        paidAmount: 10.1,
        notes: 'تغییر توضیح بدون تغییر مبلغ',
        items: [{ productId: secondProductId, quantity: 1, unitPrice: 125.1 }],
      });
      expect(edited).toMatchObject({
        currency: 'IRR',
        total: 1250,
        paidAmount: 101,
        discount: 1,
      });
      await service.updateInvoicePayment(created.id, 10, 'TOMAN');
      const quote = await service.invoiceFinalizationPreview(created.id);
      const result = await service.finalizeInvoice(created.id, {
        currency: 'TOMAN',
        token: quote.token,
        discount: 0.1,
        paymentAmount: 104.9,
      });
      expect(result).toMatchObject({
        currency: 'IRR',
        total: 1250,
        paidAmount: 1250,
        discount: 1,
      });
      expect(result.items[0].unitPrice).toBe(1251);
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
