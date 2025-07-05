import { Module } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { MercadoPagoService } from './mercadopago.service';
import { Clothing } from 'src/clothing/clothing.entity';
import { Seller } from 'src/seller/seller.entity';
import { Transaction } from './transaction.entity';
import { Buyer } from 'src/buyer/buyer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Order, Clothing, Seller, Transaction, Buyer]),
  ],
  controllers: [PaymentController],
  providers: [PaymentService, MercadoPagoService],
})
export class PaymentModule {}
