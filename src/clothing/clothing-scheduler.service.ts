import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClothingStatusService } from './clothing-status.service';
import { toZonedTime } from 'date-fns-tz';

@Injectable()
export class ClothingSchedulerService {
  private readonly logger = new Logger(ClothingSchedulerService.name);

  private getBrazilianTime(): Date {
    const timeZone = 'America/Sao_Paulo';
    return toZonedTime(new Date(), timeZone);
  }

  constructor(private readonly clothingStatusService: ClothingStatusService) {}

  /**
   * Executa a cada 5 minutos para verificar mudanças de status
   */

  // @Cron(CronExpression.EVERY_MINUTE)
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleClothingStatusUpdate(): Promise<void> {
    this.logger.log('Starting scheduled clothing status update...');
    const startTime = this.getBrazilianTime();

    try {
      await this.clothingStatusService.updateClothingStatuses();
      const duration = this.getBrazilianTime().getTime() - startTime.getTime();
      this.logger.log(`Clothing status update completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Error in scheduled clothing status update:', error);
    }
  }
}
