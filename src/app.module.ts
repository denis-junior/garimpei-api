import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BuyerModule } from './buyer/buyer.module';
import { SellerModule } from './seller/seller.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { StoreModule } from './store/store.module';
import { BidModule } from './bid/bid.module';
import { ClothingModule } from './clothing/clothing.module';
import { ImageModule } from './image/image.module';
import { AuthModule } from './auth/auth.module';
// import { MercadoPagoModule } from './mercadoPago/mercadoPago.module';
// import { Transaction } from './transactions/transaction.entity';
// import { WebhooksModule } from './webhooks/webhooks.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from './email/email.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { validationSchema } from './config/validation.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      validationOptions: {
        allowUnknown: true,
        abortEarly: true,
      },
    }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host'),
        port: configService.get('database.port'),
        username: configService.get('database.username'),
        password: configService.get('database.password'),
        database: configService.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get('database.synchronize'),
        logging: false,
      }),
    }),
    BuyerModule,
    SellerModule,
    StoreModule,
    BidModule,
    ClothingModule,
    ImageModule,
    DashboardModule,
    AuthModule,
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
