import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as dns from 'dns';
import { promisify } from 'util';

const dnsResolve = promisify(dns.resolve);

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private supabase: SupabaseClient | null = null;

  constructor(private prisma: PrismaService) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_KEY;

    if (url && key && !url.includes('your-project')) {
      this.supabase = createClient(url, key);
      this.logger.log('Supabase client initialized');
    } else {
      this.logger.warn(
        'Supabase not configured — sync will queue but not push',
      );
    }
  }

  private async isOnline(): Promise<boolean> {
    try {
      await dnsResolve('dns.google');
      return true;
    } catch {
      return false;
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processQueue() {
    if (!this.supabase) return;

    const online = await this.isOnline();
    if (!online) {
      this.logger.debug('Offline — skipping sync');
      return;
    }

    const pending = await this.prisma.syncQueue.findMany({
      where: { isSynced: false, attempts: { lt: 5 } },
      orderBy: { createdAt: 'asc' },
      take: 50,
    });

    if (pending.length === 0) return;

    this.logger.log(`Processing ${pending.length} sync queue items`);

    for (const item of pending) {
      try {
        const { error } = await this.supabase
          .from(item.tableName)
          .upsert(item.payload as any, { onConflict: 'id' });

        if (error) throw error;

        await this.prisma.syncQueue.update({
          where: { id: item.id },
          data: {
            isSynced: true,
            syncedAt: new Date(),
          },
        });
      } catch (err: any) {
        this.logger.error(
          `Sync failed for ${item.tableName}/${item.recordId}: ${err.message}`,
        );

        await this.prisma.syncQueue.update({
          where: { id: item.id },
          data: {
            attempts: { increment: 1 },
            lastError: err.message,
          },
        });
      }
    }
  }

  async getStatus() {
    const [total, pending, failed] = await Promise.all([
      this.prisma.syncQueue.count(),
      this.prisma.syncQueue.count({ where: { isSynced: false, attempts: { lt: 5 } } }),
      this.prisma.syncQueue.count({ where: { isSynced: false, attempts: { gte: 5 } } }),
    ]);

    const online = await this.isOnline();

    return {
      online,
      supabaseConfigured: !!this.supabase,
      total,
      pending,
      failed,
      synced: total - pending - failed,
    };
  }

  async retryFailed() {
    await this.prisma.syncQueue.updateMany({
      where: { isSynced: false, attempts: { gte: 5 } },
      data: { attempts: 0, lastError: null },
    });
    return { message: 'Failed items reset for retry' };
  }
}
