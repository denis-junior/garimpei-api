import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClothingStatusService } from './clothing-status.service';

@Injectable()
export class ClothingSchedulerService {
  private readonly logger = new Logger(ClothingSchedulerService.name);

  constructor(private readonly clothingStatusService: ClothingStatusService) {}

  /**
   * Executa a cada minuto para verificar mudanças de status
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async handleClothingStatusUpdate(): Promise<void> {
    this.logger.log('🕐 Starting scheduled clothing status update...');
    const startTime = Date.now();

    try {
      await this.clothingStatusService.updateClothingStatuses();
      const duration = Date.now() - startTime;
      this.logger.log(`✅ Clothing status update completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('❌ Error in scheduled clothing status update:', error);
    }
  }
}
