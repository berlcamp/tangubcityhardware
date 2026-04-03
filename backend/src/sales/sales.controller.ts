import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { CreateSaleDto, VoidSaleDto, ReturnItemsDto } from './sales.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  create(@Body() dto: CreateSaleDto) {
    return this.salesService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('cashier') cashier?: string,
    @Query('date') date?: string,
  ) {
    return this.salesService.findAll(page ?? 1, limit ?? 50, cashier, date);
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

  @Post(':id/void')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  voidSale(@Param('id') id: string, @Body() dto: VoidSaleDto) {
    return this.salesService.voidSale(id, dto);
  }

  @Post(':id/return')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  returnItems(@Param('id') id: string, @Body() dto: ReturnItemsDto) {
    return this.salesService.returnItems(id, dto);
  }
}
