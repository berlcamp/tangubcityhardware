import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSaleDto, VoidSaleDto, ReturnItemsDto } from './sales.dto';
import { addToSyncQueue } from '../common/sync.helper';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SalesService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async create(dto: CreateSaleDto) {
    const { items, discount = 0, paymentMethod = 'cash', amountPaid, customerId, cashier, terminalId, userId, userName } = dto;

    // Validate products and units exist
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, isActive: true },
      include: { units: true, inventory: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException('One or more products not found or inactive');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // Validate and compute items
    let subtotal = 0;
    const computedItems: any[] = [];
    const inventoryUpdates: { productId: string; deduct: number; previousQty: number }[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) throw new BadRequestException(`Product ${item.productId} not found`);

      const unit = product.units.find((u) => u.unitName === item.unitName);
      if (!unit) throw new BadRequestException(`Unit ${item.unitName} not found for product ${product.name}`);

      const itemDiscount = item.discount ?? 0;
      const itemTotal = item.quantity * item.price - itemDiscount;
      subtotal += itemTotal;

      const baseQtyDeducted = item.quantity * Number(unit.conversionFactor);

      if (product.inventory) {
        const currentQty = Number(product.inventory.quantity);
        if (currentQty < baseQtyDeducted) {
          throw new BadRequestException(`Insufficient stock for ${product.name}`);
        }
        inventoryUpdates.push({ productId: item.productId, deduct: baseQtyDeducted, previousQty: currentQty });
      }

      computedItems.push({
        productId: item.productId,
        unitName: item.unitName,
        quantity: item.quantity,
        price: item.price,
        discount: itemDiscount,
        total: itemTotal,
        costPrice: 0, // computed via FIFO inside transaction
      });
    }

    const total = subtotal - discount;
    const change = amountPaid - total;

    if (change < 0) {
      throw new BadRequestException('Insufficient payment amount');
    }

    // Generate receipt number
    const today = new Date();
    const prefix = today.toISOString().split('T')[0].replace(/-/g, '');
    const countToday = await this.prisma.sale.count({
      where: { createdAt: { gte: new Date(today.toISOString().split('T')[0]) } },
    });
    const receiptNumber = `${prefix}-${String(countToday + 1).padStart(4, '0')}`;

    // Create sale in transaction
    const sale = await this.prisma.$transaction(async (tx) => {
      // FIFO: compute costPrice per item and deduct from stock batches
      for (let i = 0; i < computedItems.length; i++) {
        const ci = computedItems[i];
        const update = inventoryUpdates.find((u) => u.productId === ci.productId);
        if (!update) continue;

        const baseQtyToDeduct = update.deduct;
        const conversionFactor = baseQtyToDeduct / ci.quantity;

        const batches = await tx.stockBatch.findMany({
          where: { productId: ci.productId, quantity: { gt: 0 } },
          orderBy: { receivedAt: 'asc' },
        });

        let remaining = baseQtyToDeduct;
        let totalBaseCost = 0;

        for (const batch of batches) {
          if (remaining <= 0) break;
          const batchAvail = Number(batch.quantity);
          const consumed = Math.min(batchAvail, remaining);
          totalBaseCost += consumed * Number(batch.costPrice);
          await tx.stockBatch.update({
            where: { id: batch.id },
            data: { quantity: batchAvail - consumed },
          });
          remaining -= consumed;
        }

        const weightedAvgBaseCost = baseQtyToDeduct > 0 ? totalBaseCost / baseQtyToDeduct : 0;
        computedItems[i].costPrice = Number((weightedAvgBaseCost * conversionFactor).toFixed(2));
      }

      const created = await tx.sale.create({
        data: {
          receiptNumber,
          customerId,
          subtotal,
          discount,
          total,
          paymentMethod,
          amountPaid,
          change,
          cashier: userName || cashier,
          terminalId,
          items: { create: computedItems },
        },
        include: {
          items: { include: { product: { include: { units: true } } } },
          customer: true,
        },
      });

      // Deduct inventory and record movements
      for (const update of inventoryUpdates) {
        const newQty = update.previousQty - update.deduct;
        await tx.inventory.update({
          where: { productId: update.productId },
          data: { quantity: newQty },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: update.productId,
            type: 'SALE',
            quantity: -update.deduct,
            previousQty: update.previousQty,
            newQty,
            reason: `Sale: ${receiptNumber}`,
            referenceId: created.id,
            userId: userId,
            userName: userName || cashier,
          },
        });
      }

      return created;
    });

    // Audit log
    await this.auditService.log({
      userId,
      userName: userName || cashier,
      action: 'SALE_CREATED',
      entityType: 'sale',
      entityId: sale.id,
      details: { receiptNumber, total, paymentMethod, itemCount: items.length },
    });

    // Sync queue
    await addToSyncQueue(this.prisma, 'sales', sale.id, 'INSERT', sale);

    return sale;
  }

  async findAll(page = 1, limit = 50, cashier?: string, date?: string) {
    const where: any = {};
    if (cashier) where.cashier = cashier;
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.createdAt = { gte: start, lte: end };
    }

    const [data, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          items: { include: { product: true } },
          customer: true,
        },
      }),
      this.prisma.sale.count({ where }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: { include: { units: true } } } },
        customer: true,
      },
    });
  }

  async findByReceipt(receiptNumber: string) {
    return this.prisma.sale.findUnique({
      where: { receiptNumber },
      include: {
        items: { include: { product: { include: { units: true } } } },
        customer: true,
      },
    });
  }

  async voidSale(id: string, dto: VoidSaleDto) {
    const { reason, userId, userName } = dto;

    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.isVoided) throw new BadRequestException('Sale is already voided');

    const saleReturn = await this.prisma.$transaction(async (tx) => {
      // Restore stock for every item
      for (const item of sale.items) {
        const inventory = await tx.inventory.findUnique({ where: { productId: item.productId } });
        if (!inventory) continue;

        const restoreQty = Number(item.quantity);
        const previousQty = Number(inventory.quantity);
        const newQty = previousQty + restoreQty;

        await tx.inventory.update({
          where: { productId: item.productId },
          data: { quantity: newQty },
        });

        // Add back as a new stock batch (at original cost price)
        await tx.stockBatch.create({
          data: {
            productId: item.productId,
            quantity: restoreQty,
            initialQty: restoreQty,
            costPrice: item.costPrice,
            reference: `VOID:${sale.receiptNumber}`,
            userId,
            userName,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: item.productId,
            type: 'RETURN',
            quantity: restoreQty,
            previousQty,
            newQty,
            reason: `Void: ${sale.receiptNumber}`,
            referenceId: sale.id,
            userId,
            userName,
          },
        });
      }

      // Mark sale voided
      await tx.sale.update({ where: { id }, data: { isVoided: true } });

      // Record the void return
      return tx.saleReturn.create({
        data: {
          saleId: id,
          type: 'VOID',
          reason,
          refundAmount: sale.total,
          createdBy: userName,
        },
      });
    });

    await this.auditService.log({
      userId,
      userName,
      action: 'SALE_VOIDED',
      entityType: 'sale',
      entityId: id,
      details: { receiptNumber: sale.receiptNumber, refundAmount: Number(sale.total), reason },
    });

    return { saleReturn, refundAmount: Number(sale.total) };
  }

  async returnItems(id: string, dto: ReturnItemsDto) {
    const { items: returnItems, reason, userId, userName } = dto;

    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: true,
        returns: { include: { items: true } },
      },
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.isVoided) throw new BadRequestException('Cannot return items from a voided sale');

    // Calculate already-returned quantities per SaleItem
    const alreadyReturned: Record<string, number> = {};
    for (const ret of sale.returns) {
      for (const ri of ret.items) {
        alreadyReturned[ri.saleItemId] = (alreadyReturned[ri.saleItemId] || 0) + Number(ri.quantity);
      }
    }

    // Validate return quantities
    let totalRefund = 0;
    const processedItems: { saleItem: any; returnQty: number; refund: number }[] = [];

    for (const ri of returnItems) {
      const saleItem = sale.items.find((i) => i.id === ri.saleItemId);
      if (!saleItem) throw new BadRequestException(`Sale item ${ri.saleItemId} not found`);

      const originalQty = Number(saleItem.quantity);
      const returned = alreadyReturned[ri.saleItemId] || 0;
      const available = originalQty - returned;

      if (ri.quantity > available) {
        throw new BadRequestException(
          `Cannot return ${ri.quantity} — only ${available} available for return`,
        );
      }

      const refund = Number(((ri.quantity / originalQty) * Number(saleItem.total)).toFixed(2));
      totalRefund += refund;
      processedItems.push({ saleItem, returnQty: ri.quantity, refund });
    }

    const saleReturn = await this.prisma.$transaction(async (tx) => {
      for (const { saleItem, returnQty, refund: _ } of processedItems) {
        const inventory = await tx.inventory.findUnique({ where: { productId: saleItem.productId } });
        if (!inventory) continue;

        const previousQty = Number(inventory.quantity);
        const newQty = previousQty + returnQty;

        await tx.inventory.update({
          where: { productId: saleItem.productId },
          data: { quantity: newQty },
        });

        await tx.stockBatch.create({
          data: {
            productId: saleItem.productId,
            quantity: returnQty,
            initialQty: returnQty,
            costPrice: saleItem.costPrice,
            reference: `RETURN:${sale.receiptNumber}`,
            userId,
            userName,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            productId: saleItem.productId,
            type: 'RETURN',
            quantity: returnQty,
            previousQty,
            newQty,
            reason: `Return: ${sale.receiptNumber}`,
            referenceId: sale.id,
            userId,
            userName,
          },
        });
      }

      const created = await tx.saleReturn.create({
        data: {
          saleId: id,
          type: 'RETURN',
          reason,
          refundAmount: totalRefund,
          createdBy: userName,
          items: {
            create: processedItems.map(({ saleItem, returnQty, refund }) => ({
              saleItemId: saleItem.id,
              quantity: returnQty,
              refund,
            })),
          },
        },
        include: { items: true },
      });

      return created;
    });

    await this.auditService.log({
      userId,
      userName,
      action: 'SALE_RETURN_CREATED',
      entityType: 'sale',
      entityId: id,
      details: { receiptNumber: sale.receiptNumber, refundAmount: totalRefund, reason, itemCount: returnItems.length },
    });

    return { saleReturn, refundAmount: totalRefund };
  }

  async todaySummary() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [salesCount, items, returns] = await Promise.all([
      this.prisma.sale.count({ where: { createdAt: { gte: today }, isVoided: false } }),
      this.prisma.saleItem.findMany({
        where: { sale: { createdAt: { gte: today }, isVoided: false } },
        select: { total: true, costPrice: true, quantity: true },
      }),
      this.prisma.saleReturn.findMany({
        where: { createdAt: { gte: today } },
        select: { refundAmount: true },
      }),
    ]);

    const totalRevenue = items.reduce((s, x) => s + Number(x.total), 0);
    const totalCost = items.reduce((s, x) => s + Number(x.costPrice) * Number(x.quantity), 0);
    const totalRefunds = returns.reduce((s, x) => s + Number(x.refundAmount), 0);
    const netRevenue = totalRevenue - totalRefunds;

    return {
      totalSales: salesCount,
      totalRevenue: netRevenue.toFixed(2),
      totalCost: totalCost.toFixed(2),
      totalProfit: (netRevenue - totalCost).toFixed(2),
    };
  }
}
