import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ProductsService } from './products.service.js';

describe('ProductsService unique product names', () => {
  const product = { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() };
  const category = { findUnique: vi.fn() };
  const priceHistory = { create: vi.fn() };
  const auditLog = { create: vi.fn() };
  const transaction = vi.fn();
  const service = new ProductsService({
    product,
    category,
    priceHistory,
    auditLog,
    $transaction: transaction,
  } as unknown as PrismaService);
  const data = {
    name: 'Unique product',
    categoryId: 1,
    unit: 'piece',
    buyPrice: 10,
    sellPrice: 20,
    minStock: 0,
  };
  const duplicate = () =>
    new Prisma.PrismaClientKnownRequestError('Duplicate name', {
      code: 'P2002',
      clientVersion: '7.10.0',
      meta: { target: ['name'] },
    });

  beforeEach(() => {
    vi.resetAllMocks();
    category.findUnique.mockResolvedValue({ id: 1 });
    product.findUnique.mockResolvedValue({ id: 1, ...data });
    product.create.mockResolvedValue({ id: 1, ...data });
    product.update.mockResolvedValue({ id: 1, ...data });
    transaction.mockImplementation((callback) =>
      callback({ product, priceHistory, auditLog }),
    );
  });

  it('creates a product using a trimmed name without requiring a product code', async () => {
    await expect(
      service.create({ ...data, name: ' Unique product ' }),
    ).resolves.toMatchObject({ id: 1 });
    expect(product.create.mock.calls[0][0].data).toEqual(data);
  });

  it('returns a conflict when the database rejects a duplicate product name', async () => {
    product.create.mockRejectedValue(duplicate());
    await expect(service.create(data)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('rejects duplicate names during both ordinary and price-changing edits', async () => {
    product.update.mockRejectedValue(duplicate());
    await expect(
      service.update(1, { name: 'Duplicate' }),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.update(1, { name: 'Duplicate', sellPrice: 30 }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(priceHistory.create).not.toHaveBeenCalled();
    expect(auditLog.create).not.toHaveBeenCalled();
  });

  it('allows keeping the current name while trimming surrounding spaces', async () => {
    await service.update(1, { name: ' Unique product ' });
    expect(product.update.mock.calls[0][0].data).toEqual({
      name: 'Unique product',
    });
  });

  it('rejects whitespace-only product names on creation and editing', async () => {
    await expect(
      service.create({ ...data, name: '   ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.update(1, { name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(product.create).not.toHaveBeenCalled();
    expect(product.update).not.toHaveBeenCalled();
  });

  it('preserves unexpected database errors', async () => {
    const error = new Error('Connection failed');
    product.create.mockRejectedValue(error);
    product.update.mockRejectedValue(error);
    await expect(service.create(data)).rejects.toBe(error);
    await expect(service.update(1, { name: 'Another' })).rejects.toBe(error);
  });
});
