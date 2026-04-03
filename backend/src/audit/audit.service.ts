import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(data: {
    userId?: string;
    userName?: string;
    action: string;
    entityType?: string;
    entityId?: string;
    details?: any;
  }) {
    return this.prisma.auditLog.create({ data });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
  }) {
    const { page = 1, limit = 50, action, userId, from, to } = params;
    const where: any = {};
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
