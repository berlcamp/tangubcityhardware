import { PrismaService } from '../prisma/prisma.service';

/**
 * Adds a record to the sync queue for later Supabase sync.
 */
export async function addToSyncQueue(
  prisma: PrismaService,
  tableName: string,
  recordId: string,
  operation: 'INSERT' | 'UPDATE' | 'DELETE',
  payload: any,
) {
  await prisma.syncQueue.create({
    data: {
      tableName,
      recordId,
      operation,
      payload,
    },
  });
}
