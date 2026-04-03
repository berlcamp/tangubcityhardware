import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { addToSyncQueue } from '../common/sync.helper';
import { CreateProductDto, UpdateProductDto } from './products.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private auditService: AuditService,
  ) {}

  async findAll(search?: string, page?: number, limit?: number) {
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { sku: { contains: search, mode: 'insensitive' as const } },
            { barcode: { contains: search, mode: 'insensitive' as const } },
          ],
          isActive: true,
        }
      : { isActive: true };

    // When page/limit are provided, return paginated result
    if (page !== undefined && limit !== undefined) {
      const [data, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          include: { units: true, inventory: true },
          orderBy: { name: 'asc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.product.count({ where }),
      ]);
      return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    return this.prisma.product.findMany({
      where,
      include: { units: true, inventory: true },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: { units: true, inventory: true },
    });
  }

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        barcode: dto.barcode,
        basePrice: dto.basePrice,
        costPrice: dto.costPrice,
        units: {
          create: dto.units.map((u) => ({
            unitName: u.unitName,
            conversionFactor: u.conversionFactor,
            price: u.price,
          })),
        },
        inventory: {
          create: {
            quantity: dto.initialStock ?? 0,
            lowStock: dto.lowStock ?? 10,
          },
        },
      },
      include: { units: true, inventory: true },
    });

    await addToSyncQueue(this.prisma, 'products', product.id, 'INSERT', product);

    await this.auditService.log({
      action: 'PRODUCT_CREATED',
      entityType: 'product',
      entityId: product.id,
      details: { name: dto.name, sku: dto.sku },
    });

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        sku: dto.sku,
        barcode: dto.barcode,
        basePrice: dto.basePrice,
        costPrice: dto.costPrice,
      },
      include: { units: true, inventory: true },
    });

    await addToSyncQueue(this.prisma, 'products', product.id, 'UPDATE', product);

    await this.auditService.log({
      action: 'PRODUCT_UPDATED',
      entityType: 'product',
      entityId: id,
      details: dto,
    });

    return product;
  }

  async remove(id: string) {
    const product = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    await addToSyncQueue(this.prisma, 'products', product.id, 'UPDATE', product);

    await this.auditService.log({
      action: 'PRODUCT_DELETED',
      entityType: 'product',
      entityId: id,
    });

    return product;
  }
}
