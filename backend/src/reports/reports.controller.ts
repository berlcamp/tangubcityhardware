import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER)
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('sales-by-day')
  salesByDay(@Query('days') days?: number) {
    return this.reportsService.salesByDay(days ? Number(days) : 30);
  }

  @Get('sales-summary')
  salesSummary(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.salesSummary(from, to);
  }

  @Get('top-products')
  topProducts(
    @Query('limit') limit?: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reportsService.topProducts(limit ? Number(limit) : 10, from, to);
  }

  @Get('payment-breakdown')
  paymentBreakdown(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.paymentBreakdown(from, to);
  }

  @Get('inventory-movements')
  inventoryMovements(
    @Query('productId') productId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reportsService.inventoryMovements({ productId, from, to, page: Number(page) || 1, limit: Number(limit) || 50 });
  }
}
