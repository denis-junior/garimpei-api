import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SellerService } from './seller.service';
import { SellerController } from './seller.controller';
import { Seller } from './seller.entity';
import { Store } from '../store/store.entity';
import { AuthModule } from 'src/auth/auth.module';
import { Buyer } from 'src/buyer/buyer.entity';
import { Transaction } from '../payment/transaction.entity';
@Module({
  imports: [
    TypeOrmModule.forFeature([Seller, Store, Buyer, Transaction]),
    AuthModule,
  ],
  controllers: [SellerController],
  providers: [SellerService],
})
export class SellerModule {}
