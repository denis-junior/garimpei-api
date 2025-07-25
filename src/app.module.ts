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
import { DashboardModule } from './dashboard/dashboard.module';
import { StoreModule } from './store/store.module';
import { BidModule } from './bid/bid.module';
import { ClothingModule } from './clothing/clothing.module';
import { Image } from './image/image.entity';
import { ImageModule } from './image/image.module';
import { AuthModule } from './auth/auth.module';
// import { MercadoPagoModule } from './mercadoPago/mercadoPago.module';
// import { Transaction } from './transactions/transaction.entity';
// import { WebhooksModule } from './webhooks/webhooks.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 7000,
      username: 'postgres',
      password: 'root',
      database: 'garimpeidb',
      entities: [Buyer, Seller, Clothing, Bid, Store, Image],
      synchronize: true, // true só para desenvolvimento!
    }),
    BuyerModule,
    SellerModule,
    StoreModule,
    BidModule,
    ClothingModule,
    ImageModule,
    DashboardModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
