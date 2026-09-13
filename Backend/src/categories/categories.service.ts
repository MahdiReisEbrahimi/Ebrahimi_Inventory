import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  getCategories() {
    return this.prisma.category.findMany({
      orderBy: { name: 'asc' },
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
      throw new NotFoundException(`Category ${id} was not found.`);
    }

    return category;
  }

  create(category: CreateCategoryDto) {
    return this.prisma.category.create({ data: category });
  }

  async update(id: number, editData: UpdateCategoryDto) {
    await this.findCategory(id);
    return this.prisma.category.update({ where: { id }, data: editData });
  }

  async delete(id: number) {
    await this.findCategory(id);
    return this.prisma.category.delete({ where: { id } });
  }
}
