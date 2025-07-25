import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clothing, ClothingStatus } from './clothing.entity';

@Injectable()
export class ClothingStatusService {
  private readonly logger = new Logger(ClothingStatusService.name);

  constructor(
    @InjectRepository(Clothing)
    private clothingRepository: Repository<Clothing>,
  ) {}

  /**
   * Atualiza os status dos clothings baseado nas datas/horas
   */
  async updateClothingStatuses(): Promise<void> {
    try {
      this.logger.log('🔍 Searching for clothings that need status update...');

      // Buscar clothings que podem precisar de atualização de status
      const clothings = await this.clothingRepository.find({
        where: [{ status: 'programmed' }, { status: 'active' }],
      });

      this.logger.log(`📊 Found ${clothings.length} clothings to check`);

      if (clothings.length === 0) {
        this.logger.log('ℹ️ No clothings found for status update');
        return;
      }

      const now = new Date();
      const updates: Array<{
        id: number;
        status: ClothingStatus;
        oldStatus: ClothingStatus;
      }> = [];

      this.logger.log(`⏰ Current time: ${now.toISOString()}`);

      for (const clothing of clothings) {
        const newStatus = this.calculateClothingStatus(clothing, now);

        if (newStatus !== clothing.status) {
          updates.push({
            id: clothing.id,
            status: newStatus as ClothingStatus,
            oldStatus: clothing.status,
          });

          this.logger.log(
            `🔄 Clothing ID ${clothing.id}: ${clothing.status} → ${newStatus} ` +
              `(Initial: ${clothing.initial_date}T${clothing.initial_time}, ` +
              `End: ${clothing.end_date}T${clothing.end_time})`,
          );
        }
      }

      // Executar atualizações em batch
      if (updates.length > 0) {
        await this.batchUpdateStatuses(updates);
        this.logger.log(
          `✨ Successfully updated ${updates.length} clothing statuses`,
        );

        // Log detalhado das mudanças
        updates.forEach((update) => {
          this.logger.log(
            `  📝 ID ${update.id}: ${update.oldStatus} → ${update.status}`,
          );
        });
      } else {
        this.logger.log('📌 No status changes needed');
      }
    } catch (error) {
      this.logger.error('💥 Error updating clothing statuses:', error);
      throw error;
    }
  }

  /**
   * Calcula o status correto baseado nas datas
   */
  private calculateClothingStatus(clothing: Clothing, now: Date): string {
    if (!clothing.initial_date || !clothing.initial_time) {
      this.logger.debug(
        `⚠️ Clothing ID ${clothing.id}: Missing initial date/time`,
      );
      return 'programmed';
    }

    const initialDateTime = new Date(
      `${clothing.initial_date}T${clothing.initial_time}`,
    );
    const endDateTime =
      clothing.end_date && clothing.end_time
        ? new Date(`${clothing.end_date}T${clothing.end_time}`)
        : null;

    this.logger.debug(
      `🧮 Clothing ID ${clothing.id} calculation:`,
      `\n  Now: ${now.toISOString()}`,
      `\n  Initial: ${initialDateTime.toISOString()}`,
      `\n  End: ${endDateTime?.toISOString() || 'Not set'}`,
      `\n  Current status: ${clothing.status}`,
    );

    // Se ainda não chegou a hora inicial
    if (now < initialDateTime) {
      this.logger.debug(
        `⏳ Clothing ID ${clothing.id}: Still programmed (before initial time)`,
      );
      return 'programmed';
    }

    // Se passou da hora final
    if (endDateTime && now > endDateTime) {
      this.logger.debug(
        `🏁 Clothing ID ${clothing.id}: Should be ended (after end time)`,
      );
      return 'ended';
    }

    // Se está entre a hora inicial e final
    this.logger.debug(
      `🟢 Clothing ID ${clothing.id}: Should be active (between times)`,
    );
    return 'active';
  }

  /**
   * Atualiza múltiplos status em uma única operação
   */
  private async batchUpdateStatuses(
    updates: Array<{
      id: number;
      status: ClothingStatus;
      oldStatus: ClothingStatus;
    }>,
  ): Promise<void> {
    this.logger.log(
      `💾 Starting batch update of ${updates.length} clothings...`,
    );

    for (const update of updates) {
      await this.clothingRepository.update(update.id, {
        status: update.status,
      });
      this.logger.debug(`💾 Updated clothing ID ${update.id} in database`);
    }

    this.logger.log('💾 Batch update completed');
  }

  /**
   * Determina o status inicial no momento da criação
   */
  getInitialStatus(initialDate: string, initialTime: string): string {
    if (!initialDate || !initialTime) {
      this.logger.debug('⚠️ Missing initial date/time for new clothing');
      return 'programmed';
    }

    const now = new Date();
    const initialDateTime = new Date(`${initialDate}T${initialTime}`);
    const status = now >= initialDateTime ? 'active' : 'programmed';

    this.logger.log(
      `🆕 New clothing initial status: ${status}`,
      `\n  Now: ${now.toISOString()}`,
      `\n  Initial: ${initialDateTime.toISOString()}`,
    );

    return status;
  }
}
