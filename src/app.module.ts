import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Buyer } from './buyer/buyer.entity';
import { Seller } from './seller/seller.entity';
import { Clothing } from './clothing/clothing.entity';
import { Store } from './store/store.entity';
import { Bid } from './bid/bid.entity';
import { BuyerModule } from './buyer/buyer.module';
import { SellerModule } from './seller/seller.module';
import { StoreModule } from './store/store.module';
import { BidModule } from './bid/bid.module';
import { ClothingModule } from './clothing/clothing.module';
import { Image } from './image/image.entity';
import { ImageModule } from './image/image.module';
import { AuthModule } from './auth/auth.module';
import { PaymentModule } from './payment/payment.module';
import { ScheduleModule } from './schedule/schedule.module';
import { Order } from './payment/order.entity';
import { Transaction } from './payment/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 7000,
      username: 'postgres',
      password: 'root',
      database: 'garimpeidb',
      entities: [
        Buyer,
        Seller,
        Clothing,
        Bid,
        Store,
        Image,
        Order,
        Transaction,
      ],
      synchronize: true, // true só para desenvolvimento!
    }),
    BuyerModule,
    SellerModule,
    StoreModule,
    BidModule,
    ClothingModule,
    ImageModule,
    AuthModule,
    PaymentModule,
    ScheduleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
