import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService, MAX_INVOICE_AMOUNT } from './inventory.service.js';

describe('Invoice amount limits and API amounts', () => {
  const record = {
    id: 9,
    number: '009',
    subtotal: new Prisma.Decimal(MAX_INVOICE_AMOUNT),
    discount: new Prisma.Decimal(10_000_000_000),
    total: new Prisma.Decimal(90_000_000_000),
    paidAmount: new Prisma.Decimal(40_000_000_000),
    items: [
      {
        productId: 1,
        quantity: 50,
        unitPrice: new Prisma.Decimal(2_000_000_000),
        total: new Prisma.Decimal(MAX_INVOICE_AMOUNT),
      },
    ],
  };
  const tx = {
    product: { findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    storeSettings: { findUnique: vi.fn() },
    invoice: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
    inventoryTransaction: {
      create: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    invoiceItem: { deleteMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(),
    invoice: { findMany: vi.fn(), findUnique: vi.fn() },
  };
  const service = new InventoryService(prisma as unknown as PrismaService);
  const data = {
    discount: 10_000_000_000,
    paidAmount: 40_000_000_000,
    items: [{ productId: 1, quantity: 50, unitPrice: 2_000_000_000 }],
  };

  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation(async (callback) => callback(tx));
    tx.product.findMany.mockResolvedValue([
      { id: 1, name: 'کالا', unit: 'عدد' },
    ]);
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.invoice.create.mockResolvedValue({ id: 9 });
    tx.invoice.update.mockResolvedValue(record);
    tx.invoice.findUnique.mockResolvedValue(record);
    tx.invoice.findUniqueOrThrow.mockResolvedValue(record);
    tx.inventoryTransaction.count.mockResolvedValue(0);
  });

  for (const editing of [false, true]) {
    it(`snapshots the account holder and bank on ${editing ? 'edit' : 'create'}`, async () => {
      tx.storeSettings.findUnique.mockResolvedValue({
        name: 'فروشگاه',
        iban: 'IR000000000000000000000000',
        ibanLabel: 'علی ابراهیمی ـ بانک ملت',
      });
      if (editing) await service.updateInvoice(9, data);
      else await service.createInvoice(data);
      const write = editing
        ? tx.invoice.update.mock.calls[1][0]
        : tx.invoice.create.mock.calls[0][0];
      expect(write.data).toMatchObject({
        sellerIban: 'IR000000000000000000000000',
        sellerIbanLabel: 'علی ابراهیمی ـ بانک ملت',
      });
    });

    it(`accepts exactly 100 billion rials on ${editing ? 'edit' : 'create'} and returns JSON numbers`, async () => {
      const result = editing
        ? await service.updateInvoice(9, data)
        : await service.createInvoice(data);
      const write = editing
        ? tx.invoice.update.mock.calls[1][0]
        : tx.invoice.create.mock.calls[0][0];
      expect(write.data).toMatchObject({
        subtotal: MAX_INVOICE_AMOUNT,
        total: 90_000_000_000,
        discount: 10_000_000_000,
        paidAmount: 40_000_000_000,
      });
      expect(write.data.items.create[0].total).toBe(MAX_INVOICE_AMOUNT);
      expect(JSON.parse(JSON.stringify(result))).toMatchObject({
        subtotal: MAX_INVOICE_AMOUNT,
        total: 90_000_000_000,
        discount: 10_000_000_000,
        paidAmount: 40_000_000_000,
        items: [{ total: MAX_INVOICE_AMOUNT }],
      });
    });
  }

  it('rejects unchanged edits before touching stock or invoice records', async () => {
    tx.invoice.findUnique.mockResolvedValue({
      ...record,
      customerId: 1,
      currency: 'IRR',
      issueDate: new Date('2026-10-28T00:00:00Z'),
      settlement: 'INSTALLMENT',
      notes: '',
    });
    await expect(service.updateInvoice(9, {
      ...data,
      customerId: 1,
      issueDate: '2026-10-28',
      settlement: 'INSTALLMENT',
      notes: '',
    })).rejects.toThrow('تغییری در فاکتور ایجاد نشده');
    expect(tx.invoice.update).not.toHaveBeenCalled();
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.inventoryTransaction.deleteMany).not.toHaveBeenCalled();
    expect(tx.invoiceItem.deleteMany).not.toHaveBeenCalled();
  });

  it('allows a single item at the cap and rejects a unit price above it', async () => {
    const single = {
      discount: 0,
      paidAmount: MAX_INVOICE_AMOUNT,
      items: [{ productId: 1, quantity: 1, unitPrice: MAX_INVOICE_AMOUNT }],
    };
    await service.createInvoice(single);
    expect(
      tx.invoice.create.mock.calls[0][0].data.items.create[0],
    ).toMatchObject({
      unitPrice: MAX_INVOICE_AMOUNT,
      total: MAX_INVOICE_AMOUNT,
    });
    await expect(
      service.createInvoice({
        ...single,
        items: [{ ...single.items[0], unitPrice: MAX_INVOICE_AMOUNT + 1 }],
      }),
    ).rejects.toThrow('اطلاعات اقلام');
  });

  it('rejects one rial above the cap before any database write, even with a discount', async () => {
    const overLimit = {
      ...data,
      items: [...data.items, { productId: 1, quantity: 1, unitPrice: 1 }],
    };
    await expect(service.createInvoice(overLimit)).rejects.toThrow(
      '۱۰۰ میلیارد ریال',
    );
    await expect(service.updateInvoice(9, overLimit)).rejects.toThrow(
      '۱۰۰ میلیارد ریال',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('keeps exact numeric amounts in archive and detail responses', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      { ...record, customer: { id: 1 } },
    ]);
    prisma.invoice.findUnique.mockResolvedValue(record);
    const archived = await service.invoices();
    const detail = await service.invoice(9);
    for (const invoice of [archived[0], detail]) {
      expect(invoice.total).toBe(90_000_000_000);
      expect(invoice.subtotal).toBe(MAX_INVOICE_AMOUNT);
      expect(invoice.items[0].total).toBe(MAX_INVOICE_AMOUNT);
      expect(invoice.items[0].unitPrice).toBe(2_000_000_000);
      expect(typeof JSON.parse(JSON.stringify(invoice)).total).toBe('number');
    }
    expect(archived[0].customer).toEqual({ id: 1 });
  });
});
