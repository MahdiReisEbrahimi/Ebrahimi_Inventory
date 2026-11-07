import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  IsIn,
  IsArray,
  IsInt,
  Min,
  ValidateNested,
  IsHash,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AccountsService } from './accounts.service.js';
class PartyCashDto {
  @IsNumber({ maxDecimalPlaces: 1 }) amount!: number;
  @IsIn(['PAYMENT', 'REFUND']) kind!: 'PAYMENT' | 'REFUND';
  @IsUUID() requestKey!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
}
class AccountReturnLineDto {
  @IsInt() @Min(1) productId!: number;
  @IsInt() @Min(1) quantity!: number;
}
class AccountReturnDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AccountReturnLineDto)
  items!: AccountReturnLineDto[];
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsUUID() requestKey!: string;
}
class AccountPreviewQuery {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  discount?: number;
}
class AccountFinalizeDto {
  @IsHash('sha256') token!: string;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) discount!: number;
  @IsNumber({ maxDecimalPlaces: 1 }) @Min(0) paymentAmount!: number;
  @IsUUID() requestKey!: string;
}
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}
  @Get() list(@Query('all') all?: string) {
    return this.accounts.list(all === 'true');
  }
  @Get(':id') detail(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.detail(id);
  }
  @Post(':id/cash') cash(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: PartyCashDto,
  ) {
    return this.accounts.cash(id, data);
  }
  @Get(':id/returnable') returnable(@Param('id', ParseIntPipe) id: number) {
    return this.accounts.returnable(id);
  }
  @Post(':id/returns') returnGoods(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: AccountReturnDto,
  ) {
    return this.accounts.returnGoods(id, data);
  }
  @Get(':id/finalization') finalization(
    @Param('id', ParseIntPipe) id: number,
    @Query() query: AccountPreviewQuery,
  ) {
    return this.accounts.finalizationPreview(id, query.discount);
  }
  @Post(':id/finalize') finalize(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: AccountFinalizeDto,
  ) {
    return this.accounts.finalize(id, data);
  }
}
