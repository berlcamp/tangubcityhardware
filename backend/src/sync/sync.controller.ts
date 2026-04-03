import { Controller, Get, Post } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  getStatus() {
    return this.syncService.getStatus();
  }

  @Post('retry')
  retryFailed() {
    return this.syncService.retryFailed();
  }

  @Post('now')
  syncNow() {
    return this.syncService.processQueue();
  }
}
