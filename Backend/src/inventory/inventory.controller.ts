import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  AssignInvoicePartyDto,
  BuyerDto,
  CreateInvoiceDto,
  CreateMovementDto,
  InvoiceQueryDto,
  InvoicePaymentDto,
  FinalizeInvoiceDto,
  UpdateStoreSettingsDto,
} from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get('transactions') movements() {
    return this.inventory.movements();
  }
  @Post('transactions') movement(@Body() data: CreateMovementDto) {
    return this.inventory.createMovement(data);
  }
  @Get('buyers') buyers() {
    return this.inventory.buyers();
  }
  @Post('buyers') createBuyer(@Body() data: BuyerDto) {
    return this.inventory.createBuyer(data);
  }
  @Get('buyers/:id') buyer(@Param('id', ParseIntPipe) id: number) {
    return this.inventory.buyer(id);
  }
  @Patch('buyers/:id') updateBuyer(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: BuyerDto,
  ) {
    return this.inventory.updateBuyer(id, data);
  }
  @Delete('buyers/:id') deleteBuyer(@Param('id', ParseIntPipe) id: number) {
    return this.inventory.deleteBuyer(id);
  }
  @Get('invoices') invoices(@Query() query: InvoiceQueryDto) {
    return this.inventory.invoices(query);
  }
  @Get('invoices/:id') invoice(@Param('id', ParseIntPipe) id: number) {
    return this.inventory.invoice(id);
  }
  @Get('invoices/:id/returnable') returnableInvoice(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventory.returnableInvoice(id);
  }
  @Post('invoices') createInvoice(@Body() data: CreateInvoiceDto) {
    return this.inventory.createInvoice(data);
  }
  @Patch('invoices/:id') updateInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: CreateInvoiceDto,
  ) {
    return this.inventory.updateInvoice(id, data);
  }
  @Patch('invoices/:id/party') assignParty(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: AssignInvoicePartyDto,
  ) {
    return this.inventory.assignInvoiceParty(id, data.customerId);
  }
  @Patch('invoices/:id/payment') updatePayment(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: InvoicePaymentDto,
  ) {
    return this.inventory.updateInvoicePayment(
      id,
      data.paymentAmount,
      data.currency,
    );
  }
  @Get('invoices/:id/finalization') finalizationPreview(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.inventory.invoiceFinalizationPreview(id);
  }
  @Post('invoices/:id/finalize') finalizeInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: FinalizeInvoiceDto,
  ) {
    return this.inventory.finalizeInvoice(id, data);
  }
  @Get('store-settings') settings() {
    return this.inventory.storeSettings();
  }
  @Put('store-settings') updateSettings(@Body() data: UpdateStoreSettingsDto) {
    return this.inventory.updateStoreSettings(data);
  }
}
