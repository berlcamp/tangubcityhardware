import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addToSyncQueue } from '../common/sync.helper';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InventoryService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(search?: string, page = 1, limit = 20) {
    const where = search
      ? {
          product: {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              { sku: { contains: search, mode: 'insensitive' as const } },
            ],
          },
        }
      : {};

    const [data, total] = await Promise.all([
      this.prisma.inventory.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, units: true } },
        },
        orderBy: { product: { name: 'asc' } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventory.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getLowStock() {
    return this.prisma.$queryRaw`
      SELECT i.*, row_to_json(p.*) as product
      FROM inventory i
      JOIN products p ON p.id = i.product_id
      WHERE i.quantity <= i.low_stock
      ORDER BY i.quantity ASC
    `;
  }

  async createStockBatch(
    productId: string,
    data: { quantity: number; costPrice: number; reference?: string },
    user?: { id?: string; username?: string; name?: string },
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: { product: { select: { name: true, sku: true } } },
    });

    if (!inventory) throw new Error('Inventory record not found');

    const previousQty = Number(inventory.quantity);
    const newQty = previousQty + data.quantity;

    const [batch] = await this.prisma.$transaction([
      this.prisma.stockBatch.create({
        data: {
          productId,
          quantity: data.quantity,
          initialQty: data.quantity,
          costPrice: data.costPrice,
          reference: data.reference,
          userId: user?.id,
          userName: user?.name || user?.username,
        },
      }),
      this.prisma.inventory.update({
        where: { productId },
        data: { quantity: newQty },
      }),
      this.prisma.inventoryMovement.create({
        data: {
          productId,
          type: 'RESTOCK',
          quantity: data.quantity,
          previousQty,
          newQty,
          reason: data.reference || 'Stock received',
          userId: user?.id,
          userName: user?.name || user?.username,
        },
      }),
    ]);

    await this.auditService.log({
      userId: user?.id,
      userName: user?.name || user?.username,
      action: 'STOCK_BATCH_CREATED',
      entityType: 'stock_batch',
      entityId: batch.id,
      details: {
        productName: inventory.product.name,
        quantity: data.quantity,
        costPrice: data.costPrice,
        reference: data.reference,
      },
    });

    await addToSyncQueue(this.prisma, 'inventory', inventory.id, 'UPDATE', { productId, quantity: newQty });

    return batch;
  }

  async getStockBatches(productId: string) {
    return this.prisma.stockBatch.findMany({
      where: { productId },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async adjustStock(
    productId: string,
    quantity: number,
    reason?: string,
    user?: { id?: string; username?: string; name?: string },
  ) {
    const inventory = await this.prisma.inventory.findUnique({
      where: { productId },
      include: { product: { select: { name: true, sku: true } } },
    });

    if (!inventory) throw new Error('Inventory record not found');

    const previousQty = Number(inventory.quantity);
    const newQty = previousQty + quantity;

    const movementType = quantity > 0 ? 'RESTOCK' : 'ADJUSTMENT';

    await this.prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { productId },
        data: { quantity: newQty },
      });

      // For negative adjustments, deduct from FIFO batches
      if (quantity < 0) {
        let remaining = Math.abs(quantity);
        const batches = await tx.stockBatch.findMany({
          where: { productId, quantity: { gt: 0 } },
          orderBy: { receivedAt: 'asc' },
        });
        for (const batch of batches) {
          if (remaining <= 0) break;
          const batchQty = Number(batch.quantity);
          const deduct = Math.min(batchQty, remaining);
          await tx.stockBatch.update({
            where: { id: batch.id },
            data: { quantity: batchQty - deduct },
          });
          remaining -= deduct;
        }
      }

      await tx.inventoryMovement.create({
        data: {
          productId,
          type: movementType,
          quantity,
          previousQty,
          newQty,
          reason,
          userId: user?.id,
          userName: user?.name || user?.username,
        },
      });
    });

    const updated = await this.prisma.inventory.findUnique({ where: { productId } });

    await this.auditService.log({
      userId: user?.id,
      userName: user?.name || user?.username,
      action: 'STOCK_ADJUSTED',
      entityType: 'inventory',
      entityId: productId,
      details: {
        productName: inventory.product.name,
        quantity,
        previousQty,
        newQty,
        reason,
        type: movementType,
      },
    });

    await addToSyncQueue(this.prisma, 'inventory', updated!.id, 'UPDATE', updated);

    return updated;
  }
}
