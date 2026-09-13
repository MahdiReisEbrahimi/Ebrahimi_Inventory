import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BulkPriceUpdateDto } from './dto/bulk-price-update.dto.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { PriceHistoryQueryDto } from './dto/price-history-query.dto.js';
import { ProductQueryDto } from './dto/product-query.dto.js';
import { UpdateProductPriceDto } from './dto/update-product-price.dto.js';
import { UpdateProductStatusDto } from './dto/update-product-status.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ProductsService } from './products.service.js';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get() findAll(@Query() q: ProductQueryDto) {
    return this.products.findAll(q);
  }
  @Post('bulk-price-update/preview') preview(@Body() data: BulkPriceUpdateDto) {
    return this.products.previewBulkPriceUpdate(data);
  }
  @Post('bulk-price-update') bulk(@Body() data: BulkPriceUpdateDto) {
    return this.products.bulkPriceUpdate(data);
  }
  @Get(':id/price-history') history(
    @Param('id', ParseIntPipe) id: number,
    @Query() q: PriceHistoryQueryDto,
  ) {
    return this.products.priceHistory(id, q);
  }
  @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) {
    return this.products.findOne(id);
  }
  @Post() create(@Body() data: CreateProductDto) {
    return this.products.create(data);
  }
  @Patch(':id/status') status(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductStatusDto,
  ) {
    return this.products.updateStatus(id, data);
  }
  @Patch(':id/price') price(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductPriceDto,
  ) {
    return this.products.updatePrice(id, data);
  }
  @Patch(':id/prices') prices(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductPriceDto,
  ) {
    return this.products.updatePrice(id, data);
  }
  @Patch(':id') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateProductDto,
  ) {
    return this.products.update(id, data);
  }
  @Delete(':id') delete(@Param('id', ParseIntPipe) id: number) {
    return this.products.delete(id);
  }
}
