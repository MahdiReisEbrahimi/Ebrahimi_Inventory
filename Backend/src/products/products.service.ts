import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, PriceChangeType } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BulkPriceUpdateDto } from './dto/bulk-price-update.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { UpdateProductPriceDto } from './dto/update-product-price.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';

const productInclude = {
  category: { select: { id: true, name: true } },
} as const;

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(q: ProductQueryDto) {
    const {
      page,
      limit,
      search,
      categoryId,
      isActive,
      lowStock,
      minPrice,
      maxPrice,
      sortBy,
      sortOrder,
    } = q;
    const where: Prisma.ProductWhereInput = {
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { sku: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(isActive === undefined ? {} : { isActive }),
      ...(minPrice !== undefined || maxPrice !== undefined
        ? {
            sellPrice: {
              ...(minPrice !== undefined ? { gte: minPrice } : {}),
              ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
            },
          }
        : {}),
    };
    const products = await this.prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: { [sortBy]: sortOrder },
    });
    const filtered = lowStock
      ? products.filter((p) => p.stock <= p.minStock)
      : products;
    const total = filtered.length;
    return {
      data: filtered.slice((page - 1) * limit, page * limit),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException(`Product ${id} was not found.`);
    return product;
  }

  async create(data: CreateProductDto) {
    await this.ensureCategory(data.categoryId);
    return this.prisma.product.create({ data, include: productInclude });
  }

  async update(id: number, data: UpdateProductDto) {
    const current = await this.findOne(id);
    if (data.categoryId !== undefined)
      await this.ensureCategory(data.categoryId);
    const priceChanged =
      (data.buyPrice !== undefined && data.buyPrice !== current.buyPrice) ||
      (data.sellPrice !== undefined && data.sellPrice !== current.sellPrice);
    return priceChanged
      ? this.updatePrices(id, data, PriceChangeType.SINGLE)
      : this.prisma.product.update({
          where: { id },
          data,
          include: productInclude,
        });
  }

  async updateStatus(id: number, { isActive }: UpdateProductStatusDto) {
    await this.findOne(id);
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: { isActive },
        include: productInclude,
      });
      await tx.auditLog.create({
        data: {
          productId: id,
          action: 'PRODUCT_STATUS_CHANGED',
          details: { isActive },
        },
      });
      return product;
    });
  }

  async delete(id: number) {
    await this.findOne(id);
    if (await this.prisma.priceHistory.count({ where: { productId: id } }))
      return this.updateStatus(id, { isActive: false });
    return this.prisma.product.delete({ where: { id } });
  }

  updatePrice(id: number, data: UpdateProductPriceDto) {
    return this.updatePrices(id, data, PriceChangeType.SINGLE);
  }

  async previewBulkPriceUpdate(data: BulkPriceUpdateDto) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      },
      select: { id: true, name: true, buyPrice: true, sellPrice: true },
    });
    return {
      affectedProducts: products.length,
      items: products.map((p) => {
        const oldPrice = data.priceType === 'SELL' ? p.sellPrice : p.buyPrice;
        return {
          id: p.id,
          name: p.name,
          oldPrice,
          newPrice: this.calculatePrice(oldPrice, data),
        };
      }),
    };
  }

  async bulkPriceUpdate(data: BulkPriceUpdateDto) {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
      },
      select: { id: true, buyPrice: true, sellPrice: true },
    });
    await this.prisma.$transaction(async (tx) => {
      for (const p of products) {
        const oldPrice = data.priceType === 'SELL' ? p.sellPrice : p.buyPrice,
          newPrice = this.calculatePrice(oldPrice, data);
        await tx.product.update({
          where: { id: p.id },
          data:
            data.priceType === 'SELL'
              ? { sellPrice: newPrice }
              : { buyPrice: newPrice },
        });
        await tx.priceHistory.create({
          data: {
            productId: p.id,
            oldBuyPrice: data.priceType === 'BUY' ? oldPrice : undefined,
            newBuyPrice: data.priceType === 'BUY' ? newPrice : undefined,
            oldSellPrice: data.priceType === 'SELL' ? oldPrice : undefined,
            newSellPrice: data.priceType === 'SELL' ? newPrice : undefined,
            changePercent: data.type === 'PERCENTAGE' ? data.value : null,
            type: PriceChangeType.BULK,
          },
        });
        await tx.auditLog.create({
          data: {
            productId: p.id,
            action: 'BULK_PRICE_UPDATED',
            details: { priceType: data.priceType, oldPrice, newPrice },
          },
        });
      }
    });
    return { affectedProducts: products.length };
  }

  async priceHistory(id: number, q: PriceHistoryQueryDto) {
    await this.findOne(id);
    const where: Prisma.PriceHistoryWhereInput = {
      productId: id,
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(`${q.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.priceHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.priceHistory.count({ where }),
    ]);
    return {
      data: data.map((item) => ({
        ...item,
        // `oldPrice`/`newPrice` keep the response convenient for a single-price UI;
        // the explicit buy/sell values preserve a simultaneous price update exactly.
        oldPrice: item.oldSellPrice ?? item.oldBuyPrice,
        newPrice: item.newSellPrice ?? item.newBuyPrice,
        changedBy:
          item.changedById === null
            ? null
            : { id: item.changedById, name: item.changedByName },
      })),
      meta: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    };
  }

  private async updatePrices(
    id: number,
    data: UpdateProductPriceDto & UpdateProductDto,
    type: PriceChangeType,
  ) {
    const current = await this.findOne(id),
      newBuyPrice = data.buyPrice ?? current.buyPrice,
      newSellPrice = data.sellPrice ?? current.sellPrice;
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data,
        include: productInclude,
      });
      await tx.priceHistory.create({
        data: {
          productId: id,
          oldBuyPrice: current.buyPrice,
          newBuyPrice,
          oldSellPrice: current.sellPrice,
          newSellPrice,
          type,
        },
      });
      await tx.auditLog.create({
        data: {
          productId: id,
          action: 'PRICE_UPDATED',
          details: {
            oldBuyPrice: current.buyPrice,
            newBuyPrice,
            oldSellPrice: current.sellPrice,
            newSellPrice,
          },
        },
      });
      return product;
    });
  }

  private async ensureCategory(id: number) {
    if (!(await this.prisma.category.findUnique({ where: { id } })))
      throw new NotFoundException(`Category ${id} was not found.`);
  }
  private calculatePrice(oldPrice: number, data: BulkPriceUpdateDto) {
    return data.type === 'PERCENTAGE'
      ? Math.round(oldPrice * (1 + data.value / 100))
      : Math.round(data.value);
  }
}
