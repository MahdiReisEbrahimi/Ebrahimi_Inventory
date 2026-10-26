import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
            name: { contains: search, mode: 'insensitive' },
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
    data = { ...data, name: this.productName(data.name) };
    await this.ensureCategory(data.categoryId);
    try {
      return await this.prisma.product.create({
        data: {
          ...data,
          ...(data.stock
            ? {
                inventoryTransactions: {
                  create: {
                    type: 'ADJUSTMENT',
                    quantity: data.stock,
                    description: 'موجودی اولیه کالا',
                  },
                },
              }
            : {}),
        },
        include: productInclude,
      });
    } catch (error) {
      this.handleNameConflict(error);
    }
  }

  async update(id: number, data: UpdateProductDto) {
    if (data.name !== undefined)
      data = { ...data, name: this.productName(data.name) };
    const current = await this.findOne(id);
    if (data.categoryId !== undefined)
      await this.ensureCategory(data.categoryId);
    const priceChanged =
      (data.buyPrice !== undefined && data.buyPrice !== current.buyPrice) ||
      (data.sellPrice !== undefined && data.sellPrice !== current.sellPrice);
    try {
      return priceChanged ||
        (data.stock !== undefined && data.stock !== current.stock)
        ? await this.updatePrices(id, data, PriceChangeType.SINGLE)
        : await this.prisma.product.update({
            where: { id },
            data,
            include: productInclude,
          });
    } catch (error) {
      this.handleNameConflict(error);
    }
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
    try {
      return await this.prisma.product.delete({ where: { id } });
    } catch (error) {
      // Historical records retain their product reference; removing a product
      // with any history archives it instead of failing a foreign-key check.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      )
        return this.updateStatus(id, { isActive: false });
      throw error;
    }
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
      items: products.map((p) => ({
        id: p.id,
        name: p.name,
        oldPrice: data.priceType === 'BUY' ? p.buyPrice : p.sellPrice,
        newPrice: this.calculatePrice(
          data.priceType === 'BUY' ? p.buyPrice : p.sellPrice,
          data,
        ),
        oldBuyPrice: p.buyPrice,
        newBuyPrice:
          data.priceType === 'SELL'
            ? p.buyPrice
            : this.calculatePrice(p.buyPrice, data),
        oldSellPrice: p.sellPrice,
        newSellPrice:
          data.priceType === 'BUY'
            ? p.sellPrice
            : this.calculatePrice(p.sellPrice, data),
      })),
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
        const newBuyPrice =
          data.priceType === 'SELL'
            ? p.buyPrice
            : this.calculatePrice(p.buyPrice, data);
        const newSellPrice =
          data.priceType === 'BUY'
            ? p.sellPrice
            : this.calculatePrice(p.sellPrice, data);
        await tx.product.update({
          where: { id: p.id },
          data: {
            ...(data.priceType !== 'SELL' ? { buyPrice: newBuyPrice } : {}),
            ...(data.priceType !== 'BUY' ? { sellPrice: newSellPrice } : {}),
          },
        });
        await tx.priceHistory.create({
          data: {
            productId: p.id,
            oldBuyPrice: data.priceType !== 'SELL' ? p.buyPrice : undefined,
            newBuyPrice: data.priceType !== 'SELL' ? newBuyPrice : undefined,
            oldSellPrice: data.priceType !== 'BUY' ? p.sellPrice : undefined,
            newSellPrice: data.priceType !== 'BUY' ? newSellPrice : undefined,
            changePercent: data.type === 'PERCENTAGE' ? data.value : null,
            type: PriceChangeType.BULK,
          },
        });
        await tx.auditLog.create({
          data: {
            productId: p.id,
            action: 'BULK_PRICE_UPDATED',
            details: {
              priceType: data.priceType,
              oldBuyPrice: p.buyPrice,
              newBuyPrice,
              oldSellPrice: p.sellPrice,
              newSellPrice,
            },
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
      if (
        newBuyPrice !== current.buyPrice ||
        newSellPrice !== current.sellPrice
      )
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
      if (
        newBuyPrice !== current.buyPrice ||
        newSellPrice !== current.sellPrice
      )
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
      if (data.stock !== undefined && data.stock !== current.stock) {
        await tx.inventoryTransaction.create({
          data: {
            productId: id,
            type: 'ADJUSTMENT',
            quantity: data.stock - current.stock,
            description: 'اصلاح موجودی از فرم ویرایش کالا',
          },
        });
        await tx.auditLog.create({
          data: {
            productId: id,
            action: 'STOCK_ADJUSTED',
            details: { oldStock: current.stock, stock: data.stock },
          },
        });
      }
      return product;
    });
  }

  private productName(value: unknown) {
    if (typeof value !== 'string')
      throw new BadRequestException('نام کالا را وارد کنید.');
    const name = value.trim();
    if (!name) throw new BadRequestException('نام کالا را وارد کنید.');
    return name;
  }

  private handleNameConflict(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'کالایی با این نام قبلاً ثبت شده است. نام کالا باید یکتا باشد.',
      );
    }
    throw error;
  }

  private async ensureCategory(id: number) {
    if (!(await this.prisma.category.findUnique({ where: { id } })))
      throw new NotFoundException(`Category ${id} was not found.`);
  }
  private calculatePrice(oldPrice: number, data: BulkPriceUpdateDto) {
    const price =
      data.type === 'PERCENTAGE'
        ? Math.round(oldPrice * (1 + data.value / 100))
        : Math.round(data.value);
    if (
      !Number.isFinite(data.value) ||
      data.value < 0 ||
      !Number.isSafeInteger(price) ||
      price < 0 ||
      price > 2147483647
    )
      throw new BadRequestException('مقدار قیمت جدید معتبر نیست.');
    return price;
  }
}
