import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateProductPriceDto {
  @IsOptional() @IsInt() @Min(0) buyPrice?: number;
  @IsOptional() @IsInt() @Min(0) sellPrice?: number;
}
