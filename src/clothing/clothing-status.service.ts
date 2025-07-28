import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clothing, ClothingStatus } from './clothing.entity';
import { EmailService } from '../email/email.service';
import { toZonedTime, format } from 'date-fns-tz';
import { parseISO } from 'date-fns';

@Injectable()
export class ClothingStatusService {
  private readonly logger = new Logger(ClothingStatusService.name);

  constructor(
    @InjectRepository(Clothing)
    private clothingRepository: Repository<Clothing>,
    private emailService: EmailService,
  ) {}

  /**
   * Atualiza os status dos clothings baseado nas datas/horas
   */
  async updateClothingStatuses(): Promise<void> {
    try {
      this.logger.log('🔍 Checking clothing statuses and auction processes...');

      const clothings = await this.clothingRepository.find({
        relations: ['bids', 'bids.buyer', 'store', 'store.seller'],
      });

      this.logger.log(`📊 Found ${clothings.length} clothings to check`);

      const now = this.getBrazilianTime();
      const updates: Array<{
        id: number;
        status: ClothingStatus;
        oldStatus: ClothingStatus;
        clothing?: Clothing;
      }> = [];

      this.logger.log(`⏰ Current time: ${this.formatBrazilianTime(now)}`);

      for (const clothing of clothings) {
        // 1. Verificar mudanças de status normais (programmed -> active -> ended)
        const newStatus = this.calculateClothingStatus(clothing, now);

        if (newStatus !== clothing.status && newStatus !== 'auctioned') {
          updates.push({
            id: clothing.id,
            status: newStatus as ClothingStatus,
            oldStatus: clothing.status,
            clothing,
          });
        }

        // 2. Processar lógica pós-leilão
        await this.processPostAuctionLogic(clothing, now);
      }

      // Executar atualizações em batch
      if (updates.length > 0) {
        await this.batchUpdateStatuses(updates);
        await this.sendAuctionEndEmails(updates);
        this.logger.log(
          `✨ Successfully updated ${updates.length} clothing statuses`,
        );
      }
    } catch (error) {
      this.logger.error('💥 Error updating clothing statuses:', error);
      throw error;
    }
  }

  /**
   * Processa toda a lógica pós-leilão (auctioned -> waiting_payment -> second_chance)
   */
  private async processPostAuctionLogic(
    clothing: Clothing,
    now: Date,
  ): Promise<void> {
    // const oneHour = 60 * 60 * 1000; // 1 hora em ms
    // const oneDay = 24 * 60 * 60 * 1000; // 1 dia em ms
    // const twoDays = 2 * 24 * 60 * 60 * 1000; // 2 dias em ms
    const oneHour = 5 * 60 * 1000; // 5 minutos em ms (para teste)
    const oneDay = 10 * 60 * 1000; // 10 minutos em ms (para teste)
    const twoDays = 15 * 60 * 1000; // 15 minutos em ms (para teste)

    switch (clothing.status) {
      case 'ended':
        await this.handleEndedStatus(clothing);
        break;

      case 'auctioned':
        await this.handleAuctionedStatus(clothing, now, oneHour);
        break;

      case 'waiting_payment':
        await this.handleWaitingPaymentStatus(clothing, now, oneDay, twoDays);
        break;
    }
  }

  /**
   * Lida com clothings no status 'ended' - verifica se tem bids e envia email
   */
  private async handleEndedStatus(clothing: Clothing): Promise<void> {
    if (!clothing.bids || clothing.bids.length === 0) {
      this.logger.log(`📝 Clothing ${clothing.id} ended without bids`);
      return;
    }

    const winningBid = this.findWinningBid(clothing, clothing.auction_attempt);
    if (!winningBid) {
      this.logger.log(
        `📝 Clothing ${clothing.id} ended but no valid winning bid found`,
      );
      return;
    }

    try {
      // Enviar email para o vencedor
      await this.emailService.sendAuctionWinnerEmail({
        winner: winningBid.buyer,
        clothing,
        winningBid: Number(winningBid.bid),
        auctionEndDate: clothing.end_date || '',
        auctionEndTime: clothing.end_time || '',
      });

      // Atualizar status para 'auctioned' e registrar timestamps
      await this.clothingRepository.update(clothing.id, {
        status: 'auctioned',
        auctioned_at: new Date(),
        current_winner_bid_id: winningBid.id,
      });

      this.logger.log(
        `✅ Clothing ${clothing.id} moved to 'auctioned' - Email sent to ${winningBid.buyer.email}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing ended clothing ${clothing.id}:`,
        error,
      );
    }
  }

  /**
   * Lida com clothings no status 'auctioned' - após 1 hora muda para waiting_payment
   */
  private async handleAuctionedStatus(
    clothing: Clothing,
    now: Date,
    oneHour: number,
  ): Promise<void> {
    if (!clothing.auctioned_at) return;

    const timeSinceAuctioned = now.getTime() - clothing.auctioned_at.getTime();

    if (timeSinceAuctioned >= oneHour) {
      await this.clothingRepository.update(clothing.id, {
        status: 'waiting_payment',
      });

      this.logger.log(
        `⏰ Clothing ${clothing.id} moved to 'waiting_payment' after 1 hour`,
      );
    }
  }

  /**
   * Lida com clothings no status 'waiting_payment'
   */
  private async handleWaitingPaymentStatus(
    clothing: Clothing,
    now: Date,
    oneDay: number,
    twoDays: number,
  ): Promise<void> {
    if (!clothing.auctioned_at) return;

    const timeSinceAuctioned = now.getTime() - clothing.auctioned_at.getTime();

    // Após 1 dia: enviar aviso para o seller (uma única vez)
    if (timeSinceAuctioned >= oneDay && !clothing.payment_warning_sent_at) {
      await this.sendPaymentWarningToSeller(clothing);
    }

    // Após 2 dias: passar para o próximo lance
    if (timeSinceAuctioned >= twoDays) {
      await this.processNextBidder(clothing);
    }
  }

  /**
   * Envia aviso de pagamento pendente para o seller
   */
  private async sendPaymentWarningToSeller(clothing: Clothing): Promise<void> {
    try {
      const winningBid = clothing.bids?.find(
        (bid) => bid.id === clothing.current_winner_bid_id,
      );
      if (!winningBid || !clothing.store?.seller) return;

      await this.emailService.sendPaymentWarningToSeller({
        seller: {
          name: clothing.store.seller.name,
          email: clothing.store.seller.email,
        },
        clothing,
        winner: winningBid.buyer,
        winningBid: Number(winningBid.bid),
        daysWaiting: 1,
      });

      // Registrar que o aviso foi enviado
      await this.clothingRepository.update(clothing.id, {
        payment_warning_sent_at: new Date(),
      });

      this.logger.log(
        `📧 Payment warning sent to seller for clothing ${clothing.id}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error sending payment warning for clothing ${clothing.id}:`,
        error,
      );
    }
  }

  /**
   * Processa o próximo lance (segunda chance)
   */
  private async processNextBidder(clothing: Clothing): Promise<void> {
    const nextAttempt = clothing.auction_attempt + 1;
    const nextWinningBid = this.findWinningBid(clothing, nextAttempt);

    if (!nextWinningBid) {
      // Não há mais lances, finalizar sem vencedor
      await this.clothingRepository.update(clothing.id, {
        status: 'finished',
      });

      this.logger.log(
        `🏁 Clothing ${clothing.id} finished without payment - no more bids available`,
      );
      return;
    }

    try {
      // Enviar email de segunda chance
      await this.emailService.sendSecondChanceEmail({
        winner: nextWinningBid.buyer,
        clothing,
        winningBid: Number(nextWinningBid.bid),
        auctionEndDate: clothing.end_date || '',
        auctionEndTime: clothing.end_time || '',
        attemptNumber: nextAttempt + 1,
      });

      // Resetar o processo para o novo vencedor
      await this.clothingRepository.update(clothing.id, {
        status: 'auctioned',
        auction_attempt: nextAttempt,
        current_winner_bid_id: nextWinningBid.id,
        auctioned_at: new Date(),
        payment_warning_sent_at: null,
      });

      this.logger.log(
        `🎯 Clothing ${clothing.id} started second chance with attempt #${nextAttempt + 1} - Email sent to ${nextWinningBid.buyer.email}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing next bidder for clothing ${clothing.id}:`,
        error,
      );
    }
  }

  /**
   * Encontra o lance vencedor baseado na tentativa atual
   */
  private findWinningBid(clothing: Clothing, attemptNumber: number): any {
    if (!clothing.bids || clothing.bids.length === 0) return null;

    // Ordenar bids por valor decrescente
    const sortedBids = clothing.bids
      .filter((bid) => bid.buyer) // Garantir que tem buyer
      .sort((a, b) => Number(b.bid) - Number(a.bid));

    // Retornar o bid da tentativa especificada
    return sortedBids[attemptNumber] || null;
  }

  /**
   * Retorna a data/hora atual no fuso horário brasileiro
   */
  private getBrazilianTime(): Date {
    const timeZone = 'America/Sao_Paulo';
    return toZonedTime(new Date(), timeZone);
  }

  /**
   * Formata data/hora para exibição no fuso brasileiro
   */
  private formatBrazilianTime(date: Date): string {
    const timeZone = 'America/Sao_Paulo';
    const zonedDate = toZonedTime(date, timeZone);
    return format(zonedDate, 'dd/MM/yyyy HH:mm:ss', { timeZone });
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

    // Criar as datas assumindo que estão no fuso brasileiro
    const timeZone = 'America/Sao_Paulo';

    const initialDateTimeString = `${clothing.initial_date}T${clothing.initial_time}`;
    const initialDateTime = toZonedTime(
      parseISO(initialDateTimeString),
      timeZone,
    );

    const endDateTime =
      clothing.end_date && clothing.end_time
        ? toZonedTime(
            parseISO(`${clothing.end_date}T${clothing.end_time}`),
            timeZone,
          )
        : null;

    this.logger.debug(`🧮 Clothing ID ${clothing.id} calculation:`);
    this.logger.debug(`Now (Brazil): ${this.formatBrazilianTime(now)}`);
    this.logger.debug(
      `Initial (Brazil): ${this.formatBrazilianTime(initialDateTime)}`,
    );
    this.logger.debug(
      `End (Brazil): ${endDateTime ? this.formatBrazilianTime(endDateTime) : 'Not set'}`,
    );
    this.logger.debug(`Current status: ${clothing.status}`);

    // Se ainda não chegou a hora inicial
    if (now < initialDateTime) {
      this.logger.debug(
        `⏳ Clothing ID ${clothing.id}: Still programmed (before initial time)`,
      );
      return 'programmed';
    }

    // Se não há data/hora final definida, permanece ativo
    if (!endDateTime) {
      this.logger.debug(
        `🟢 Clothing ID ${clothing.id}: Should be active (no end time set)`,
      );
      return 'active';
    }

    // Se passou da hora final e o status já é um dos pós-leilão, manter
    if (
      now > endDateTime &&
      ['auctioned', 'waiting_payment', 'paid', 'finished'].includes(
        clothing.status,
      )
    ) {
      this.logger.debug(
        `🔒 Clothing ID ${clothing.id}: Keeping post-auction status (${clothing.status})`,
      );
      return clothing.status;
    }

    // Se passou da hora final e ainda não está em status pós-leilão
    if (now > endDateTime) {
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

    const timeZone = 'America/Sao_Paulo';
    const now = toZonedTime(new Date(), timeZone);

    const initialDateTimeString = `${initialDate}T${initialTime}`;
    const initialDateTime = toZonedTime(
      parseISO(initialDateTimeString),
      timeZone,
    );

    // Converter para o mesmo fuso para comparação
    const initialBrazilTime = toZonedTime(initialDateTime, timeZone);
    const status = now >= initialBrazilTime ? 'active' : 'programmed';

    this.logger.log(`🆕 New clothing initial status: ${status}`);
    this.logger.log(`Now (Brazil): ${this.formatBrazilianTime(now)}`);
    this.logger.log(
      `Initial (Brazil): ${this.formatBrazilianTime(initialDateTime)}`,
    );

    return status;
  }

  /**
   * Envia emails para leilões que foram finalizados
   */
  private async sendAuctionEndEmails(
    updates: Array<{
      id: number;
      status: ClothingStatus;
      oldStatus: ClothingStatus;
      clothing?: Clothing;
    }>,
  ): Promise<void> {
    // Filtra apenas os leilões que mudaram para 'ended' e têm bids
    const endedAuctions = updates.filter(
      (update) =>
        update.status === 'ended' &&
        update.oldStatus !== 'ended' &&
        update.clothing &&
        update.clothing.bids &&
        update.clothing.bids.length > 0,
    );

    for (const auction of endedAuctions) {
      try {
        // A lógica de envio de email agora está no handleEndedStatus
        // Este método será chamado no próximo ciclo
        this.logger.log(
          `📝 Clothing ${auction.id} marked as ended, will process in next cycle`,
        );
      } catch (error) {
        this.logger.error(
          `❌ Erro ao marcar leilão finalizado ${auction.id}:`,
          error,
        );
      }
    }
  }
}
