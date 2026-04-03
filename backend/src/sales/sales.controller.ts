import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './sales.dto';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
  }

  @Get()
  findAll(@Query('page') page?: number, @Query('limit') limit?: number) {
    return this.salesService.findAll(page ?? 1, limit ?? 50);
  }

  @Get('today')
  todaySummary() {
    return this.salesService.todaySummary();
  }

  @Get('receipt/:receiptNumber')
  findByReceipt(@Param('receiptNumber') receiptNumber: string) {
    return this.salesService.findByReceipt(receiptNumber);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }
}
