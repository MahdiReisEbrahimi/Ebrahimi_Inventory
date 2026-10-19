import { Body, Controller, Get, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { CreateInvoiceDto, CreateMovementDto, UpdateStoreSettingsDto } from './inventory.dto.js';
import { InventoryService } from './inventory.service.js';

@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get('transactions') movements() { return this.inventory.movements(); }
  @Post('transactions') movement(@Body() data: CreateMovementDto) { return this.inventory.createMovement(data); }
  @Get('invoices') invoices() { return this.inventory.invoices(); }
  @Get('invoices/:id') invoice(@Param('id', ParseIntPipe) id: number) { return this.inventory.invoice(id); }
  @Post('invoices') createInvoice(@Body() data: CreateInvoiceDto) { return this.inventory.createInvoice(data); }
  @Get('store-settings') settings() { return this.inventory.storeSettings(); }
  @Put('store-settings') updateSettings(@Body() data: UpdateStoreSettingsDto) { return this.inventory.updateStoreSettings(data); }
}
