import { IsArray, IsDateString, IsInt, IsIn, IsOptional, IsString, Min, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMovementDto {
  @IsInt() @Min(1) productId!: number;
  @IsInt() @Min(1) quantity!: number;
  @IsIn(['PURCHASE', 'RETURN', 'ADJUSTMENT']) type!: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT';
  @IsOptional() @IsInt() @Min(0) unitPrice?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) invoiceId?: number;
  @IsOptional() @IsDateString() date?: string;
}

export class InvoiceLineDto {
  @IsInt() @Min(1) productId!: number;
  @IsInt() @Min(1) quantity!: number;
  @IsInt() @Min(0) unitPrice!: number;
}

export class CreateInvoiceDto {
  @IsOptional() @IsInt() @Min(1) customerId?: number;
  @IsOptional() @IsString() buyerFirstName?: string;
  @IsOptional() @IsString() buyerLastName?: string;
  @IsOptional() @IsString() buyerNationalId?: string;
  @IsOptional() @IsString() buyerAddress?: string;
  @IsOptional() @IsString() notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => InvoiceLineDto) items!: InvoiceLineDto[];
}

export class BuyerDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsString() @MaxLength(100) lastName!: string;
  @IsOptional() @IsString() @MaxLength(20) nationalId?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class InvoiceQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customerId?: number;
  @IsOptional() @IsString() buyer?: string;
  @IsOptional() @IsString() product?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class UpdateStoreSettingsDto {
  @IsString() name!: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() logoUrl?: string;
}
