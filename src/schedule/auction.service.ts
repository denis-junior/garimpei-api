import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Clothing, ClothingStatus } from 'src/clothing/clothing.entity';
import { Order, OrderStatus } from 'src/payment/order.entity';
import { Repository } from 'typeorm';

@Injectable()
export class AuctionService {
  private readonly logger = new Logger(AuctionService.name);

  constructor(
    @InjectRepository(Clothing)
    private clothingRepository: Repository<Clothing>,
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
  ) {}

  // Este Cron Job rodará a cada minuto.
  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    this.logger.debug('Verificando leilões finalizados...');

    const now = new Date();
    const finishedAuctions = await this.clothingRepository.find({
      where: {
        status: ClothingStatus.AUCTIONING,
      },
      relations: ['bids', 'bids.buyer', 'store.seller'],
    });
    finishedAuctions.filter((c) => {
      if (!c.end_date || !c.end_time) return false;
      const endDateTime = new Date(`${c.end_date}T${c.end_time}`);
      return endDateTime.getTime() < now.getTime();
    });
    console.log('finishedAuctions', finishedAuctions);
    if (finishedAuctions.length === 0) {
      return;
    }

    for (const clothing of finishedAuctions) {
      if (clothing.bids && clothing.bids.length > 0) {
        // Ordena os lances para encontrar o vencedor
        const winningBid = clothing.bids.sort((a, b) => b.bid - a.bid)[0];

        // Calcula a taxa da plataforma (ex: 10%) e o ganho do vendedor
        const platformFee = winningBid.bid * 0.1;
        const sellerEarning = winningBid.bid - platformFee;

        // Cria um pedido de pagamento
        const order = this.orderRepository.create({
          clothing: clothing,
          buyer: winningBid.buyer,
          amount: winningBid.bid,
          platformFee: platformFee,
          sellerEarning: sellerEarning,
          status: OrderStatus.PENDING,
        });
        await this.orderRepository.save(order);

        clothing.status = ClothingStatus.PENDING_PAYMENT;
        this.logger.log(
          `Leilão para "${clothing.name}" finalizado. Pedido #${order.id} criado.`,
        );
      } else {
        clothing.status = ClothingStatus.EXPIRED;
        this.logger.log(`Leilão para "${clothing.name}" expirou sem lances.`);
      }
      await this.clothingRepository.save(clothing);
    }
  }
}
