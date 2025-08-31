import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercadoPagoService } from './mercadoPago.service';
import { MercadoPagoController } from './mercadoPago.controller';
import { MercadoPagoOAuthService } from './mercadoPago.authService';
import { Transaction } from '../transactions/transaction.entity';
import { Seller } from '../seller/seller.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Seller])],
  providers: [MercadoPagoService, MercadoPagoOAuthService],
  controllers: [MercadoPagoController],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
