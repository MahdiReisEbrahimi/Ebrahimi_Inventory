import 'reflect-metadata';
import { config } from 'dotenv';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { ProductsService } from '../src/products/products.service.js';

// Creates and cleans up only records belonging to this test run.
describe.skipIf(process.env.RUN_PRODUCT_DB_TESTS !== '1')(
  'Unique product names in PostgreSQL',
  () => {
    let prisma: PrismaService;
    let service: ProductsService;
    let categoryId: number;
    let productId: number;
    const tag = `product-name-test-${randomUUID()}`;

    beforeAll(async () => {
      config({ path: '../.env', quiet: true });
      prisma = new PrismaService();
      await prisma.$connect();
      service = new ProductsService(prisma);
      categoryId = (await prisma.category.create({ data: { name: tag } })).id;
    });

    afterAll(async () => {
      if (!prisma) return;
      if (categoryId) {
        const ids = (
          await prisma.product.findMany({
            where: { categoryId },
            select: { id: true },
          })
        ).map((p) => p.id);
        await prisma.inventoryTransaction.deleteMany({
          where: { productId: { in: ids } },
        });
        await prisma.priceHistory.deleteMany({
          where: { productId: { in: ids } },
        });
        await prisma.auditLog.deleteMany({ where: { productId: { in: ids } } });
        await prisma.product.deleteMany({ where: { categoryId } });
        await prisma.category.delete({ where: { id: categoryId } });
      }
      await prisma.$disconnect();
    });

    const productData = (name: string) => ({
      name,
      categoryId,
      unit: 'piece',
      buyPrice: 10,
      sellPrice: 20,
      minStock: 0,
    });

    it('creates without a product code and rejects duplicate names at the database level', async () => {
      const product = await service.create(productData(` ${tag} `));
      productId = product!.id;
      expect(product!.name).toBe(tag);
      expect(product).not.toHaveProperty('sku');
      await expect(
        prisma.product.create({ data: productData(tag) }),
      ).rejects.toMatchObject({ code: 'P2002' });
      await expect(service.create(productData(tag))).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(
        service.create(productData(` ${tag} `)),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('allows keeping a name but rejects renaming another product to an existing name', async () => {
      await expect(
        service.update(productId, { name: ` ${tag} ` }),
      ).resolves.toMatchObject({ name: tag });
      const other = await service.create(productData(`${tag}-other`));
      await expect(
        service.update(other!.id, { name: tag, sellPrice: 30 }),
      ).rejects.toBeInstanceOf(ConflictException);
      await expect(
        prisma.product.findUniqueOrThrow({ where: { id: other!.id } }),
      ).resolves.toMatchObject({
        name: `${tag}-other`,
        sellPrice: 20,
      });
      expect(
        await prisma.priceHistory.count({ where: { productId: other!.id } }),
      ).toBe(0);
    });
    it('saves initial stock and subsequent stock corrections with inventory history', async () => {
      const product = await service.create({
        ...productData(`${tag}-stock`),
        stock: 12,
      });
      expect(product?.stock).toBe(12);
      const id = product!.id;
      expect(
        await prisma.inventoryTransaction.findFirstOrThrow({
          where: { productId: id },
        }),
      ).toMatchObject({ type: 'ADJUSTMENT', quantity: 12 });
      await service.update(id, { stock: 5 });
      expect((await service.findOne(id)).stock).toBe(5);
      expect(
        await prisma.inventoryTransaction.findFirstOrThrow({
          where: { productId: id },
          orderBy: { id: 'desc' },
        }),
      ).toMatchObject({ type: 'ADJUSTMENT', quantity: -7 });
      expect(
        await prisma.priceHistory.count({ where: { productId: id } }),
      ).toBe(0);
      await service.update(id, { stock: 8, buyPrice: 15, sellPrice: 25 });
      expect(await service.findOne(id)).toMatchObject({
        stock: 8,
        buyPrice: 15,
        sellPrice: 25,
      });
      expect(
        await prisma.priceHistory.count({ where: { productId: id } }),
      ).toBe(1);
    });

    it('hard-deletes products without history and archives products with inventory or audit history', async () => {
      const plain = await service.create(productData(`${tag}-plain-delete`));
      await service.delete(plain!.id);
      expect(
        await prisma.product.findUnique({ where: { id: plain!.id } }),
      ).toBeNull();
      const stocked = await service.create({
        ...productData(`${tag}-stock-delete`),
        stock: 2,
      });
      await service.delete(stocked!.id);
      expect(await service.findOne(stocked!.id)).toMatchObject({
        isActive: false,
        stock: 2,
      });
      await service.updateStatus(productId, { isActive: false });
      await service.delete(productId);
      expect(await service.findOne(productId)).toMatchObject({
        isActive: false,
      });
    });
  },
);
