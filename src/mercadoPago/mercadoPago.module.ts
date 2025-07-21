import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MercadoPagoController } from './mercadoPago.controller';
import { MercadoPagoService } from './mercadoPago.service';
import { Transaction } from '../transactions/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction])],
  controllers: [MercadoPagoController],
  providers: [MercadoPagoService],
  exports: [MercadoPagoService],
})
export class MercadoPagoModule {}
