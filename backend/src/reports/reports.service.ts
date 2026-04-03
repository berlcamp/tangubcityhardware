import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async salesByDay(days = 30) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const sales = await this.prisma.sale.findMany({
      where: { createdAt: { gte: from } },
      select: { createdAt: true, total: true },
      orderBy: { createdAt: 'asc' },
    });

    const map: Record<string, { date: string; count: number; revenue: number }> = {};
    for (const sale of sales) {
      const date = sale.createdAt.toISOString().split('T')[0];
      if (!map[date]) map[date] = { date, count: 0, revenue: 0 };
      map[date].count++;
      map[date].revenue = Number((map[date].revenue + Number(sale.total)).toFixed(2));
    }

    // Fill in missing days with 0
    const result: { date: string; count: number; revenue: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const date = d.toISOString().split('T')[0];
      result.push(map[date] || { date, count: 0, revenue: 0 });
    }
    return result;
  }

  async salesSummary(from?: string, to?: string) {
    const where: any = { isVoided: false };
    const itemWhere: any = {};
    const returnWhere: any = {};
    if (from || to) {
      where.createdAt = {};
      itemWhere.sale = { createdAt: {}, isVoided: false };
      returnWhere.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(from);
        itemWhere.sale.createdAt.gte = new Date(from);
        returnWhere.createdAt.gte = new Date(from);
      }
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
        itemWhere.sale.createdAt.lte = toDate;
        returnWhere.createdAt.lte = toDate;
      }
    } else {
      itemWhere.sale = { isVoided: false };
    }

    const [sales, items, saleReturns] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        select: { total: true, discount: true, paymentMethod: true },
      }),
      this.prisma.saleItem.findMany({
        where: itemWhere,
        select: { total: true, costPrice: true, quantity: true },
      }),
      this.prisma.saleReturn.findMany({
        where: returnWhere,
        select: { refundAmount: true },
      }),
    ]);

    const totalTransactions = sales.length;
    const grossRevenue = sales.reduce((s, x) => s + Number(x.total), 0);
    const totalRefunds = saleReturns.reduce((s, x) => s + Number(x.refundAmount), 0);
    const totalRevenue = grossRevenue - totalRefunds;
    const totalDiscount = sales.reduce((s, x) => s + Number(x.discount), 0);
    const avgTransaction = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
    const totalCost = items.reduce((s, x) => s + Number(x.costPrice) * Number(x.quantity), 0);
    const totalProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const paymentCounts: Record<string, number> = {};
    for (const s of sales) {
      paymentCounts[s.paymentMethod] = (paymentCounts[s.paymentMethod] || 0) + 1;
    }

    return {
      totalTransactions,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalRefunds: Number(totalRefunds.toFixed(2)),
      totalDiscount: Number(totalDiscount.toFixed(2)),
      avgTransaction: Number(avgTransaction.toFixed(2)),
      totalCost: Number(totalCost.toFixed(2)),
      totalProfit: Number(totalProfit.toFixed(2)),
      profitMargin: Number(profitMargin.toFixed(2)),
      paymentCounts,
    };
  }

  async topProducts(limit = 10, from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.sale = { createdAt: {} };
      if (from) where.sale.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.sale.createdAt.lte = toDate;
      }
    }

    const items = await this.prisma.saleItem.findMany({
      where,
      select: {
        productId: true,
        quantity: true,
        total: true,
        costPrice: true,
        product: { select: { id: true, name: true, sku: true } },
      },
    });

    const map: Record<string, { productId: string; name: string; sku: string; totalQty: number; totalRevenue: number; totalCost: number }> = {};
    for (const item of items) {
      const key = item.productId;
      if (!map[key]) {
        map[key] = { productId: key, name: item.product.name, sku: item.product.sku, totalQty: 0, totalRevenue: 0, totalCost: 0 };
      }
      map[key].totalQty = Number((map[key].totalQty + Number(item.quantity)).toFixed(4));
      map[key].totalRevenue = Number((map[key].totalRevenue + Number(item.total)).toFixed(2));
      map[key].totalCost = Number((map[key].totalCost + Number(item.costPrice) * Number(item.quantity)).toFixed(2));
    }

    return Object.values(map)
      .map((p) => ({
        ...p,
        totalProfit: Number((p.totalRevenue - p.totalCost).toFixed(2)),
        profitMargin: p.totalRevenue > 0
          ? Number(((p.totalRevenue - p.totalCost) / p.totalRevenue * 100).toFixed(2))
          : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  }

  async salesByCashier(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const sales = await this.prisma.sale.findMany({
      where,
      select: { cashier: true, total: true, discount: true },
    });

    const map: Record<string, { cashier: string; transactions: number; revenue: number; discount: number }> = {};
    for (const s of sales) {
      const key = s.cashier || 'Unknown';
      if (!map[key]) map[key] = { cashier: key, transactions: 0, revenue: 0, discount: 0 };
      map[key].transactions++;
      map[key].revenue = Number((map[key].revenue + Number(s.total)).toFixed(2));
      map[key].discount = Number((map[key].discount + Number(s.discount)).toFixed(2));
    }

    return Object.values(map)
      .map(c => ({
        ...c,
        avgTransaction: c.transactions > 0 ? Number((c.revenue / c.transactions).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }

  async paymentBreakdown(from?: string, to?: string) {
    const where: any = {};
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const sales = await this.prisma.sale.findMany({
      where,
      select: { paymentMethod: true, total: true },
    });

    const map: Record<string, { method: string; count: number; revenue: number }> = {};
    for (const s of sales) {
      const m = s.paymentMethod;
      if (!map[m]) map[m] = { method: m, count: 0, revenue: 0 };
      map[m].count++;
      map[m].revenue = Number((map[m].revenue + Number(s.total)).toFixed(2));
    }

    return Object.values(map);
  }

  async transactions(params: {
    date?: string;
    page?: number;
    limit?: number;
  }) {
    const { date, page = 1, limit = 20 } = params;
    const where: any = {};
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
        include: {
          items: { include: { product: { select: { name: true } } } },
          returns: { include: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async inventoryMovements(params: {
    productId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    const { productId, from, to, page = 1, limit = 50 } = params;
    const where: any = {};
    if (productId) where.productId = productId;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.inventoryMovement.findMany({
        where,
        include: { product: { select: { name: true, sku: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inventoryMovement.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
