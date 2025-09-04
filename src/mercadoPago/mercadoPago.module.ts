import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercadoPagoController } from './mercadoPago.controller';
import { MercadoPagoService } from './mercadoPago.service';
import { MercadoPagoOAuthService } from './mercadoPago.authService';
import { WebhooksService } from '../webhooks/webhooks.service';
import { Transaction } from '../transactions/transaction.entity';
import { Seller } from '../seller/seller.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Seller])],
  controllers: [MercadoPagoController],
  providers: [MercadoPagoService, MercadoPagoOAuthService, WebhooksService],
  exports: [MercadoPagoService, MercadoPagoOAuthService],
})
export class MercadoPagoModule {}
