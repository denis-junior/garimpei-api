import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order, OrderStatus } from './order.entity';
import { Repository } from 'typeorm';
import { MercadoPagoService } from './mercadopago.service';
import { Seller } from 'src/seller/seller.entity';
import { Transaction, TransactionType } from './transaction.entity';
import { Clothing, ClothingStatus } from 'src/clothing/clothing.entity';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Seller)
    private sellerRepository: Repository<Seller>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    @InjectRepository(Clothing)
    private clothingRepository: Repository<Clothing>,
    private mercadoPagoService: MercadoPagoService,
  ) {}

  async createPayment(orderId: number, userId: number) {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'buyer',
        'clothing',
        'clothing.store',
        'clothing.store.seller',
      ],
    });

    if (!order) {
      throw new NotFoundException('Pedido não encontrado.');
    }
    if (order.buyer.id !== userId) {
      throw new ForbiddenException(
        'Você não tem permissão para pagar este pedido.',
      );
    }
    if (order.status !== OrderStatus.PENDING) {
      throw new ForbiddenException(
        'Este pedido não está mais pendente de pagamento.',
      );
    }
    const seller = order.clothing.store.seller;
    if (!seller?.mercadopagoAccountId) {
      throw new ForbiddenException(
        'O vendedor não configurou uma conta de pagamento.',
      );
    }

    const payment = await this.mercadoPagoService.createPayment(order.id, {
      amount: order.amount,
      description: `Pagamento para o item: ${order.clothing.name}`,
      payerEmail: order.buyer.email,
      platformFee: order.platformFee,
    });

    // Salva o ID do pagamento do Mercado Pago no nosso pedido
    order.paymentId = String(payment.id);
    await this.orderRepository.save(order);

    return payment.point_of_interaction?.transaction_data;
  }

  async handleWebhook(paymentId: string) {
    const payment = await this.mercadoPagoService.getPayment(Number(paymentId));
    if (!payment || !payment.external_reference) {
      throw new NotFoundException('Pagamento não encontrado no Mercado Pago.');
    }

    const orderId = Number(payment.external_reference);
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['clothing', 'clothing.store', 'clothing.store.seller'],
    });

    if (!order) {
      throw new NotFoundException(`Pedido com ID ${orderId} não encontrado.`);
    }

    if (payment.status === 'approved' && order.status === OrderStatus.PENDING) {
      // 1. Atualizar status do pedido e da roupa
      order.status = OrderStatus.PAID;
      await this.orderRepository.save(order);

      const clothing = order.clothing;
      clothing.status = ClothingStatus.SOLD;
      await this.clothingRepository.save(clothing);

      // 2. Atualizar saldo do vendedor
      const seller = clothing.store.seller;
      const newBalance = Number(seller.balance) + Number(order.sellerEarning);
      await this.sellerRepository.update(seller.id, { balance: newBalance });

      // 3. Criar transação
      const transaction = this.transactionRepository.create({
        seller,
        type: TransactionType.SALE,
        amount: order.sellerEarning,
      });
      await this.transactionRepository.save(transaction);
    }
    // Adicionar lógica para outros status (e.g., 'rejected', 'cancelled') se necessário
  }
}
