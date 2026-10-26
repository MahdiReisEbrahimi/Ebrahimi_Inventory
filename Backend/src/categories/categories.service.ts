import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async findCategoryProducts(id: number) {
    const products = await this.prisma.product.findMany({
      where: { categoryId: id },
    });

    return products;
  }

  async findCategory(id: number) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true } } },
    });

    if (!category) {
      throw new NotFoundException('دسته‌بندی پیدا نشد.');
    }

    return category;
  }

  async create(category: CreateCategoryDto) {
    const name = category.name.trim();
    if (!name) {
      throw new BadRequestException('نام دسته‌بندی نمی‌تواند خالی باشد.');
    }

    try {
      return await this.prisma.category.create({ data: { name } });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('این دسته‌بندی قبلاً ثبت شده است.');
      }
      throw error;
    }
  }

  async update(id: number, editData: UpdateCategoryDto) {
    await this.findCategory(id);
    const name = editData.name?.trim();
    if (name === '') {
      throw new BadRequestException('نام دسته‌بندی نمی‌تواند خالی باشد.');
    }
    try {
      return await this.prisma.category.update({
        where: { id },
        data: { name },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('این دسته‌بندی قبلاً ثبت شده است.');
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('دسته‌بندی پیدا نشد.');
        }
      }
      throw error;
    }
  }

  async delete(id: number) {
    const category = await this.findCategory(id);
    if (category._count.products > 0) {
      throw new ConflictException('حذف دسته‌بندی دارای کالا امکان‌پذیر نیست.');
    }
    try {
      return await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // The foreign key also protects against a product being added after the count check.
        if (error.code === 'P2003') {
          throw new ConflictException(
            'حذف دسته‌بندی دارای کالا امکان‌پذیر نیست.',
          );
        }
        if (error.code === 'P2025') {
          throw new NotFoundException('دسته‌بندی پیدا نشد.');
        }
      }
      throw error;
    }
  }
}
