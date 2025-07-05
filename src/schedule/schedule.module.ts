import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clothing } from 'src/clothing/clothing.entity';
import { Order } from 'src/payment/order.entity';
import { AuctionService } from './auction.service';

@Module({
  imports: [
    NestScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Clothing, Order]),
  ],
  providers: [AuctionService],
})
export class ScheduleModule {}
