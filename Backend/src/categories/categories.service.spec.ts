import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService category management', () => {
  const category = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const service = new CategoriesService({
    category,
  } as unknown as PrismaService);
  const emptyCategory = { id: 1, name: 'Empty', _count: { products: 0 } };
  const prismaError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('Database constraint error', {
      code,
      clientVersion: '7.10.0',
    });

  beforeEach(() => {
    vi.resetAllMocks();
    category.findUnique.mockResolvedValue(emptyCategory);
  });

  it('returns product counts for category cards', async () => {
    category.findMany.mockResolvedValue([emptyCategory]);
    await expect(service.getCategories()).resolves.toEqual([emptyCategory]);
    expect(category.findMany).toHaveBeenCalledWith({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  });

  it('rejects deletion of a category with products without attempting deletion', async () => {
    category.findUnique.mockResolvedValue({
      ...emptyCategory,
      _count: { products: 1 },
    });
    await expect(service.delete(1)).rejects.toBeInstanceOf(ConflictException);
    expect(category.delete).not.toHaveBeenCalled();
  });

  it('allows deletion of an empty category', async () => {
    category.delete.mockResolvedValue(emptyCategory);
    await expect(service.delete(1)).resolves.toEqual(emptyCategory);
    expect(category.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('returns a conflict if a product is added between the count check and deletion', async () => {
    category.delete.mockRejectedValue(prismaError('P2003'));
    await expect(service.delete(1)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns not found when deleting a missing category', async () => {
    category.findUnique.mockResolvedValue(null);
    await expect(service.delete(1)).rejects.toBeInstanceOf(NotFoundException);
    expect(category.delete).not.toHaveBeenCalled();
  });

  it('returns a conflict for a duplicate name during editing', async () => {
    category.update.mockRejectedValue(prismaError('P2002'));
    await expect(
      service.update(1, { name: 'Duplicate' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('trims an edited name and rejects whitespace-only names', async () => {
    category.update.mockResolvedValue(emptyCategory);
    await service.update(1, { name: ' Empty ' });
    expect(category.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: 'Empty' },
    });
    await expect(service.update(1, { name: '   ' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('preserves unexpected database errors', async () => {
    const error = new Error('Connection failed');
    category.delete.mockRejectedValue(error);
    await expect(service.delete(1)).rejects.toBe(error);
  });
});
