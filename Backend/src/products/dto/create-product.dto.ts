import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateProductDto {
  @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @IsString() @IsNotEmpty() @MaxLength(100) sku!: string;
  @IsInt() @Min(1) categoryId!: number;
  @IsString() @IsNotEmpty() @MaxLength(50) unit!: string;
  @IsInt() @Min(0) buyPrice!: number;
  @IsInt() @Min(0) sellPrice!: number;
  @IsInt() @Min(0) minStock!: number;
  @IsOptional() @IsString() description?: string;
}
