import { Controller, Get, Post, Body, Param, UseGuards, Request, Query } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '@prisma/client';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.inventoryService.findAll(search, page ? Number(page) : 1, limit ? Number(limit) : 20);
  }

  @Get('low-stock')
  getLowStock() {
    return this.inventoryService.getLowStock();
  }

  @Post(':productId/adjust')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  adjustStock(
    @Param('productId') productId: string,
    @Body() body: { quantity: number; reason?: string },
    @Request() req: any,
  ) {
    return this.inventoryService.adjustStock(productId, body.quantity, body.reason, req.user);
  }
}
