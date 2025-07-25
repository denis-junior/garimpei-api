import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClothingController } from './clothing.controller';
import { ClothingStatusService } from './clothing-status.service';
import { Clothing } from './clothing.entity';
import { Store } from '../store/store.entity';
import { Image } from '../image/image.entity';
import { BlobModule } from '../blob/blob.module';
import { ClothingService } from './clothing.service';
import { ClothingSchedulerService } from './clothing-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([Clothing, Store, Image]), BlobModule],
  controllers: [ClothingController],
  providers: [ClothingService, ClothingStatusService, ClothingSchedulerService],
  exports: [ClothingService, ClothingStatusService],
})
export class ClothingModule {}
