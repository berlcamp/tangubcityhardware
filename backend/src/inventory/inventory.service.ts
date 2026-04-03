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

    const updated = await this.prisma.inventory.update({
      where: { productId },
      data: { quantity: newQty },
    });

    const movementType = quantity > 0 ? 'RESTOCK' : 'ADJUSTMENT';

    await this.prisma.inventoryMovement.create({
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

    await addToSyncQueue(this.prisma, 'inventory', updated.id, 'UPDATE', updated);

    return updated;
  }
}
