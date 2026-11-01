import {
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsIn,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
  MaxLength,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMovementDto {
  @IsInt() @Min(1) productId!: number;
  @IsInt() @Min(1) quantity!: number;
  @IsIn(['PURCHASE', 'RETURN', 'ADJUSTMENT']) type!:
    'PURCHASE' | 'RETURN' | 'ADJUSTMENT';
  @IsOptional() @IsInt() @Min(0) unitPrice?: number;
  @IsOptional() @IsInt() @Min(0) sellPrice?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() @Min(1) invoiceId?: number;
  @IsOptional() @IsDateString() date?: string;
}

export class InvoiceLineDto {
  @IsInt() @Min(1) productId!: number;
  @IsInt() @Min(1) quantity!: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) unitPrice?: number;
}

export class CreateInvoiceDto {
  @IsOptional() @IsIn(['IRR', 'TOMAN']) currency?: 'IRR' | 'TOMAN';
  @IsOptional() @IsIn(['REGULAR', 'CREDIT']) saleType?: 'REGULAR' | 'CREDIT';
  @IsOptional() @IsDateString({ strict: true }) issueDate?: string;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) discount?: number;
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) paidAmount?: number;
  @IsOptional() @IsIn(['CASH', 'INSTALLMENT']) settlement?:
    'CASH' | 'INSTALLMENT';
  @IsOptional() @IsInt() @Min(1) customerId?: number;
  @IsOptional() @IsString() buyerFirstName?: string;
  @IsOptional() @IsString() buyerLastName?: string;
  @IsOptional() @IsString() buyerNationalId?: string;
  @IsOptional() @IsString() buyerAddress?: string;
  @IsOptional() @IsString() @MaxLength(600) notes?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDto)
  items!: InvoiceLineDto[];
}

export class BuyerDto {
  @IsString() @MaxLength(100) firstName!: string;
  @IsString() @MaxLength(100) lastName!: string;
  @IsOptional() @IsString() @MaxLength(20) nationalId?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(500) address?: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class FinalizeInvoiceDto {
  @IsOptional() @IsIn(['IRR', 'TOMAN']) currency?: 'IRR' | 'TOMAN';
  @IsOptional() @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) discount?: number;
  @IsString() @Matches(/^[a-f0-9]{64}$/) token!: string;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) paymentAmount!: number;
}

export class InvoicePaymentDto {
  @IsOptional() @IsIn(['IRR', 'TOMAN']) currency?: 'IRR' | 'TOMAN';
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0.1) paymentAmount!: number;
}

export class InvoiceQueryDto {
  @IsOptional() @IsIn(['true', 'false']) openOnly?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) customerId?: number;
  @IsOptional() @IsString() buyer?: string;
  @IsOptional() @IsString() product?: string;
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
}

export class UpdateStoreSettingsDto {
  @IsString() @MaxLength(100) name!: string;
  @IsOptional() @IsString() @MaxLength(200) address?: string;
  @IsOptional() @IsString() @MaxLength(30) phone?: string;
  @IsOptional() @IsString() @MaxLength(2000) logoUrl?: string;
  @IsOptional()
  @IsString()
  @Matches(/^(?:IR\d{24})?$/, { message: 'شماره شبا باید IR و ۲۴ رقم باشد.' })
  iban?: string;
  @IsOptional() @IsString() @MaxLength(120) ibanLabel?: string;
  @IsOptional() @IsString() @MaxLength(600) defaultInvoiceNotes?: string;
}
