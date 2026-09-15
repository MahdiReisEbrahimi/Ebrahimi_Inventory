import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class BulkPriceUpdateDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) categoryId?: number;
  @IsIn(['PERCENTAGE', 'FIXED']) type!: 'PERCENTAGE' | 'FIXED';
  @Type(() => Number) @IsNumber() value!: number;
  @IsIn(['BUY', 'SELL']) priceType!: 'BUY' | 'SELL';
}
