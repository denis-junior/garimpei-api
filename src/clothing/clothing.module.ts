import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClothingService } from './clothing.service';
import { ClothingController } from './clothing.controller';
import { Clothing } from './clothing.entity';
import { Store } from '../store/store.entity';
import { Image } from '../image/image.entity';
import { ClothingStatusService } from './clothing-status.service';
import { ClothingSchedulerService } from './clothing-scheduler.service';
import { EmailModule } from '../email/email.module';
import { BlobModule } from '../blob/blob.module';
import { WhatsAppService } from '../whatsapp/whatsapp.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Clothing, Store, Image]),
    EmailModule,
    BlobModule,
  ],
  controllers: [ClothingController],
  providers: [
    ClothingService,
    ClothingStatusService,
    ClothingSchedulerService,
    WhatsAppService,
  ],
  exports: [ClothingService, ClothingStatusService],
})
export class ClothingModule {}
