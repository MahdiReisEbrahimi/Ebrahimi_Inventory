import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { AccountsService } from '../src/accounts/accounts.service.js';

describe.skipIf(process.env.RUN_INVOICE_DB_TESTS !== '1')(
  'Party ledger and statements',
  () => {
    let prisma: PrismaService,
      inventory: InventoryService,
      accounts: AccountsService;
    let categoryId: number, productId: number;
    const buyerIds: number[] = [],
      tag = `party-ledger-test-${randomUUID()}`;
    beforeAll(async () => {
      config({ path: '../.env', quiet: true });
      prisma = new PrismaService();
      await prisma.$connect();
      inventory = new InventoryService(prisma);
      accounts = new AccountsService(prisma);
      categoryId = (await prisma.category.create({ data: { name: tag } })).id;
      productId = (
        await prisma.product.create({
          data: {
            name: tag,
            categoryId,
            unit: 'عدد',
            buyPrice: 50,
            sellPrice: 100,
            stock: 0,
          },
        })
      ).id;
    });
    afterAll(async () => {
      if (!prisma) return;
      const ids = (
        await prisma.invoice.findMany({
          where: { customerId: { in: buyerIds } },
          select: { id: true },
        })
      ).map((i) => i.id);
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
      await prisma.priceHistory.deleteMany({ where: { productId } });
      await prisma.auditLog.deleteMany({ where: { productId } });
      await prisma.product.delete({ where: { id: productId } });
      await prisma.category.delete({ where: { id: categoryId } });
      await prisma.$disconnect();
    });
    async function buyer() {
      const b = await prisma.buyer.create({
        data: { firstName: 'تست', lastName: `${tag}-${buyerIds.length}` },
      });
      buyerIds.push(b.id);
      return b.id;
    }
    const sale = (customerId: number, total = 100) =>
      inventory.createInvoice({
        customerId,
        currency: 'TOMAN',
        paidAmount: 0,
        items: [{ productId, quantity: 1, unitPrice: total }],
      });
    const cash = (
      id: number,
      amount: number,
      kind: 'PAYMENT' | 'REFUND' = 'PAYMENT',
      requestKey = randomUUID(),
    ) => accounts.cash(id, { amount, kind, requestKey });

    it('allocates one 20-million receipt across three invoices and records it once on retry', async () => {
      const id = await buyer();
      for (let i = 0; i < 3; i++) await sale(id, 10_000_000);
      const key = randomUUID();
      const result = await cash(id, 20_000_000, 'PAYMENT', key);
      expect(result).toMatchObject({
        balance: 10_000_000,
        paid: 20_000_000,
        invoiceCount: 3,
      });
      expect(result.invoices?.map((i) => i.paidAmount)).toEqual([
        10_000_000, 10_000_000, 0,
      ]);
      const retry = await cash(id, 20_000_000, 'PAYMENT', key);
      expect(retry.paid).toBe(20_000_000);
      expect(retry.entries?.filter((e) => e.action === 'PAYMENT')).toHaveLength(
        1,
      );
      await expect(cash(id, 1, 'PAYMENT', key)).rejects.toThrow('شناسه پرداخت');
    });
    it('returns discounted goods, preserves surplus and prevents excessive or repeated refunds', async () => {
      const id = await buyer();
      const source = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        discount: 100,
        paidAmount: 900,
        items: [{ productId, quantity: 10, unitPrice: 100 }],
      });
      await inventory.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: source.id,
        items: [{ productId, sourceItemId: source.items[0].id, quantity: 3 }],
      });
      const credit = await accounts.detail(id);
      expect(credit).toMatchObject({
        balance: -270,
        paid: 900,
        total: 630,
        isOpen: true,
      });
      expect(credit.invoices?.find((i) => i.id === source.id)).toMatchObject({
        paidAmount: 630,
        returnedAmount: 270,
      });
      expect((await cash(id, 270, 'REFUND')).balance).toBe(0);
      await expect(cash(id, 1, 'REFUND')).rejects.toThrow('بستانکاری');
      const statement = await accounts.detail(id);
      expect(statement.entries?.at(-1)?.balance).toBe(0);
      expect(
        statement.entries?.some(
          (e) => e.action === 'RETURN_CREATED' && e.amount === -270,
        ),
      ).toBe(true);
    });
    it('prices pending returned goods on finalization and consumes the deposit once without changing stock', async () => {
      const id = await buyer();
      const source = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 50,
        items: [{ productId, quantity: 3 }],
      });
      await inventory.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: source.id,
        items: [{ productId, sourceItemId: source.items[0].id, quantity: 1 }],
      });
      await expect(cash(id, 1, 'REFUND')).rejects.toThrow('قیمت‌گذاری');
      const stock = (
        await prisma.product.findUniqueOrThrow({ where: { id: productId } })
      ).stock;
      const quote = await inventory.invoiceFinalizationPreview(source.id);
      expect(quote.invoice.returnedAmount).toBe(1000); // quote currency IRR
      await inventory.finalizeInvoice(source.id, {
        token: quote.token,
        currency: 'TOMAN',
        discount: 0,
        paymentAmount: 150,
      });
      expect(await accounts.detail(id)).toMatchObject({
        balance: 0,
        paid: 200,
        total: 200,
        pendingCount: 0,
        isOpen: false,
      });
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(stock);
      const finalizedEntry = (await accounts.detail(id)).entries?.find(
        (entry) => entry.action === 'FINALIZED',
      );
      expect(finalizedEntry?.details).toMatchObject({
        before: { saleType: 'CREDIT', items: [{ unitPrice: null }] },
      });
    });
    it('keeps overpayment from a discount as credit until money is actually refunded', async () => {
      const id = await buyer();
      const source = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        paidAmount: 100,
        items: [{ productId, quantity: 1, unitPrice: 100 }],
      });
      const quote = await inventory.invoiceFinalizationPreview(source.id);
      await inventory.finalizeInvoice(source.id, {
        token: quote.token,
        currency: 'TOMAN',
        discount: 20,
        paymentAmount: 0,
      });
      const result = await accounts.detail(id);
      expect(result).toMatchObject({ balance: -20, paid: 100, total: 80 });
      expect(
        result.entries?.some(
          (e) => e.action === 'FINALIZED' && e.amount === -20,
        ),
      ).toBe(true);
      expect((await cash(id, 20, 'REFUND')).balance).toBe(0);
    });
    it('supports supplier invoices, payments and recovery of excess payment', async () => {
      const id = await buyer();
      await inventory.createInvoice({
        customerId: id,
        kind: 'PURCHASE',
        currency: 'TOMAN',
        paidAmount: 0,
        items: [{ productId, quantity: 1, unitPrice: 50 }],
      });
      expect(await accounts.detail(id)).toMatchObject({
        role: 'SUPPLIER',
        balance: -50,
        total: 50,
      });
      expect(await cash(id, 60)).toMatchObject({ balance: 10, paid: 60 });
      expect(await cash(id, 10, 'REFUND')).toMatchObject({
        balance: 0,
        paid: 50,
      });
    });
    it('preserves single-rial amounts and rounds cumulative return discounts exactly', async () => {
      const id = await buyer();
      const source = await inventory.createInvoice({
        customerId: id,
        currency: 'IRR',
        paidAmount: 0,
        discount: 1,
        items: [{ productId, quantity: 3, unitPrice: 11 }],
      });
      await cash(id, 3.2);
      for (let i = 0; i < 3; i++)
        await inventory.createInvoice({
          kind: 'RETURN',
          sourceInvoiceId: source.id,
          items: [{ productId, sourceItemId: source.items[0].id, quantity: 1 }],
        });
      expect(await accounts.detail(id)).toMatchObject({
        total: 0,
        balance: -3.2,
        paid: 3.2,
      });
      expect((await cash(id, 3.2, 'REFUND')).balance).toBe(0);
    });
    it('imports historical aggregate payments once, clearly marked with unknown original time', async () => {
      const id = await buyer();
      await prisma.invoice.create({
        data: {
          customerId: id,
          total: 101,
          subtotal: 101,
          paidAmount: 11,
          currency: 'IRR',
        },
      });
      const first = await accounts.detail(id),
        second = await accounts.detail(id);
      expect(first).toMatchObject({ balance: 9, paid: 1.1 });
      expect(second.entries).toHaveLength(first.entries!.length);
      expect(
        first.entries?.filter((e) => e.action === 'OPENING_PAYMENT'),
      ).toMatchObject([{ historical: true, amount: -1.1 }]);
    });
    it('serializes concurrent payments without losing money and refunds cannot spend the same surplus twice', async () => {
      const id = await buyer();
      await sale(id, 100);
      await Promise.all([cash(id, 70), cash(id, 70)]);
      expect(await accounts.detail(id)).toMatchObject({
        balance: -40,
        paid: 140,
      });
      const results = await Promise.allSettled([
        cash(id, 30, 'REFUND'),
        cash(id, 30, 'REFUND'),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect((await accounts.detail(id)).balance).toBe(-10);
    });
    it('attaches an old unassigned invoice with its returns without touching inventory or duplicating old payments', async () => {
      const id = await buyer();
      const source = await inventory.createInvoice({
        currency: 'TOMAN',
        paidAmount: 50,
        items: [{ productId, quantity: 2, unitPrice: 100 }],
      });
      const ret = await inventory.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: source.id,
        items: [{ productId, sourceItemId: source.items[0].id, quantity: 1 }],
      });
      const stock = (
        await prisma.product.findUniqueOrThrow({ where: { id: productId } })
      ).stock;
      await inventory.assignInvoiceParty(ret.id, id);
      expect(await accounts.detail(id)).toMatchObject({
        balance: 50,
        paid: 50,
        total: 100,
      });
      expect((await inventory.invoice(source.id)).customerId).toBe(id);
      expect((await inventory.invoice(ret.id)).customerId).toBe(id);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(stock);
      await expect(inventory.assignInvoiceParty(source.id, id)).rejects.toThrow(
        'قبلاً',
      );
      expect((await accounts.detail(id)).paid).toBe(50);
    });

    it('uses shared deposits for a newly finalized invoice and marks its actual settlement correctly', async () => {
      const id = await buyer();
      await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 50,
        items: [{ productId, quantity: 1 }],
      });
      const second = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 50,
        items: [{ productId, quantity: 1 }],
      });
      const quote = await inventory.invoiceFinalizationPreview(second.id);
      const result = await inventory.finalizeInvoice(second.id, {
        token: quote.token,
        currency: 'TOMAN',
        discount: 0,
        paymentAmount: 0,
      });
      expect(result).toMatchObject({
        paidAmount: 100,
        total: 100,
        settlement: 'CASH',
      });
      expect(await accounts.detail(id)).toMatchObject({
        paid: 100,
        balance: 0,
        pendingCount: 1,
        isOpen: true,
      });
    });

    it('rounds a half-rial return correctly when the final discount changes', async () => {
      const id = await buyer();
      const source = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 0,
        items: [{ productId, quantity: 6 }],
      });
      await inventory.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: source.id,
        items: [{ productId, sourceItemId: source.items[0].id, quantity: 1 }],
      });
      const quote = await inventory.invoiceFinalizationPreview(source.id);
      const discount = quote.invoice.subtotal - 3; // three rials net, one sixth returned
      await inventory.finalizeInvoice(source.id, {
        token: quote.token,
        discount,
        paymentAmount: 2,
      });
      expect(await accounts.detail(id)).toMatchObject({
        balance: 0,
        paid: 0.2,
        total: 0.2,
      });
      const returned = (await accounts.detail(id)).invoices!.find(
        (doc) => doc.kind === 'RETURN',
      )!;
      expect(returned.saleType).toBe('CREDIT');
      expect(returned.items[0].unitPrice).toBeNull();
    });

    it('logs invoice edits and party changes and prevents deleting a financial history', async () => {
      const id = await buyer();
      const doc = await sale(id);
      await inventory.updateInvoice(doc.id, {
        customerId: id,
        currency: 'TOMAN',
        paidAmount: 0,
        notes: 'یادداشت جدید',
        items: [{ productId, quantity: 2, unitPrice: 100 }],
      });
      await inventory.updateBuyer(id, { firstName: 'نام جدید', lastName: tag });
      const result = await accounts.detail(id);
      expect(result.balance).toBe(200);
      expect(
        result.entries?.some(
          (e) => e.action === 'INVOICE_UPDATED' && e.amount === 100,
        ),
      ).toBe(true);
      expect(result.entries?.some((e) => e.action === 'PARTY_UPDATED')).toBe(
        true,
      );
      await expect(inventory.deleteBuyer(id)).rejects.toThrow('سابقه مالی');
    });
    it('returns goods against the complete account across several historical deliveries once', async () => {
      const id = await buyer(),
        other = await buyer();
      const first = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        discount: 20,
        paidAmount: 0,
        items: [{ productId, quantity: 2, unitPrice: 100 }],
      });
      const second = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        discount: 60,
        paidAmount: 0,
        items: [{ productId, quantity: 3, unitPrice: 200 }],
      });
      await sale(other, 1000);
      await cash(id, 300);
      await prisma.product.update({
        where: { id: productId },
        data: { sellPrice: 999 },
      });
      const beforeStock = (
        await prisma.product.findUniqueOrThrow({ where: { id: productId } })
      ).stock;
      const available = await accounts.returnable(id);
      expect(available.products[0]).toMatchObject({
        quantity: 5,
        lots: [{ unitPrice: 100 }, { unitPrice: 200 }],
      });
      const request = {
        requestKey: randomUUID(),
        items: [{ productId, quantity: 4 }],
        notes: 'مرجوعی تجمیعی',
      };
      const result = await accounts.returnGoods(id, request);
      expect(result).toMatchObject({ total: 180, paid: 300, balance: -120 });
      const returns = result.invoices!.filter(
        (invoice) => invoice.kind === 'RETURN',
      );
      expect(
        returns.map((invoice) => [
          invoice.sourceInvoiceId,
          invoice.items[0].quantity,
          invoice.items[0].unitPrice,
        ]),
      ).toEqual([
        [first.id, 2, 100],
        [second.id, 2, 200],
      ]);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(beforeStock + 4);
      await accounts.returnGoods(id, request);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(beforeStock + 4);
      expect((await accounts.returnable(id)).products[0].quantity).toBe(1);
      await expect(
        accounts.returnGoods(id, {
          ...request,
          requestKey: randomUUID(),
          items: [{ productId, quantity: 2 }],
        }),
      ).rejects.toThrow('مجموع کالای تحویل');
      await expect(
        accounts.returnGoods(id, {
          ...request,
          items: [{ productId, quantity: 1 }],
        }),
      ).rejects.toThrow('شناسه');
    });

    it('finalizes all open invoices with one discount and one payment, preserving settled invoices and printing the aggregate', async () => {
      const id = await buyer();
      await prisma.product.update({
        where: { id: productId },
        data: { sellPrice: 250 },
      });
      const settled = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        discount: 10,
        paidAmount: 90,
        items: [{ productId, quantity: 1, unitPrice: 100 }],
      });
      const credit = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 50,
        items: [{ productId, quantity: 2 }],
      });
      const returnedCredit = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 0,
        items: [{ productId, quantity: 1 }],
      });
      await inventory.createInvoice({
        kind: 'RETURN',
        sourceInvoiceId: returnedCredit.id,
        items: [
          { productId, sourceItemId: returnedCredit.items[0].id, quantity: 1 },
        ],
      });
      await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        discount: 20,
        paidAmount: 20,
        items: [{ productId, quantity: 2, unitPrice: 100 }],
      });
      const stock = (
        await prisma.product.findUniqueOrThrow({ where: { id: productId } })
      ).stock;
      const initial = await accounts.finalizationPreview(id);
      expect(initial.previousDiscount).toBe(20);
      expect(initial.invoices).toHaveLength(3);
      expect(
        initial.invoices.some((invoice) => invoice.id === settled.id),
      ).toBe(false);
      const quote = await accounts.finalizationPreview(id, 40);
      const request = {
        token: quote.token,
        discount: quote.discount,
        paymentAmount: quote.balance,
        requestKey: randomUUID(),
      };
      const result = await accounts.finalize(id, request);
      expect(result.account).toMatchObject({
        balance: 0,
        pendingCount: 0,
        isOpen: false,
      });
      expect(await inventory.invoice(settled.id)).toMatchObject({
        total: 90,
        discount: 10,
        paidAmount: 90,
      });
      const priced = await inventory.invoice(credit.id);
      expect(
        priced.items[0].unitPrice! * (priced.currency === 'IRR' ? 1 : 10),
      ).toBe(2500);
      expect(
        (await prisma.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(stock);
      expect(result.statement).toMatchObject({
        documentTitle: 'صورت‌حساب طرف حساب',
        currency: 'IRR',
        total: result.account.total * 10,
        paidAmount: result.account.paid * 10,
      });
      const statement = result.statement as {
        id: number;
        items: { quantity: number }[];
      };
      expect(
        statement.items.reduce((sum, line) => sum + line.quantity, 0),
      ).toBe(5);
      const retried = await accounts.finalize(id, request);
      expect(retried.account.paid).toBe(result.account.paid);
      expect(retried.statement).toMatchObject({ id: statement.id });
      expect(
        retried.account.entries?.filter(
          (entry) => entry.action === 'ACCOUNT_FINALIZED',
        ),
      ).toHaveLength(1);
      expect(
        retried.account.entries?.filter(
          (entry) => entry.description === 'پرداخت هنگام نهایی‌کردن صورت‌حساب',
        ),
      ).toHaveLength(1);
    });

    it('rejects stale aggregate quotes when a price or independent payment changes', async () => {
      const id = await buyer();
      const source = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 0,
        items: [{ productId, quantity: 1 }],
      });
      const quote = await accounts.finalizationPreview(id);
      await prisma.product.update({
        where: { id: productId },
        data: { sellPrice: 300 },
      });
      await expect(
        accounts.finalize(id, {
          token: quote.token,
          discount: quote.discount,
          paymentAmount: 0,
          requestKey: randomUUID(),
        }),
      ).rejects.toThrow('دوباره');
      const updated = await accounts.finalizationPreview(id);
      await cash(id, 10);
      await expect(
        accounts.finalize(id, {
          token: updated.token,
          discount: updated.discount,
          paymentAmount: 0,
          requestKey: randomUUID(),
        }),
      ).rejects.toThrow('دوباره');
      expect((await inventory.invoice(source.id)).saleType).toBe('CREDIT');
    });

    it('rolls the whole account back if any invoice fails while finalizing', async () => {
      const id = await buyer();
      const first = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 0,
        items: [{ productId, quantity: 1 }],
      });
      const second = await inventory.createInvoice({
        customerId: id,
        currency: 'TOMAN',
        saleType: 'CREDIT',
        paidAmount: 0,
        items: [{ productId, quantity: 1 }],
      });
      const faulty = new InventoryService(prisma),
        original = faulty.finalizeInvoice.bind(faulty);
      faulty.finalizeInvoice = async (documentId, data, tx) => {
        if (documentId === second.id) throw new Error('خطای ساختگی فاکتور دوم');
        return original(documentId, data, tx);
      };
      const failing = new AccountsService(prisma, faulty);
      const quote = await failing.finalizationPreview(id);
      const before = await accounts.detail(id);
      await expect(
        failing.finalize(id, {
          token: quote.token,
          discount: quote.discount,
          paymentAmount: 0,
          requestKey: randomUUID(),
        }),
      ).rejects.toThrow('فاکتور دوم');
      expect((await inventory.invoice(first.id)).saleType).toBe('CREDIT');
      expect(
        (await inventory.invoice(second.id)).items[0].unitPrice,
      ).toBeNull();
      expect((await accounts.detail(id)).entries).toHaveLength(
        before.entries!.length,
      );
    });
  },
);
