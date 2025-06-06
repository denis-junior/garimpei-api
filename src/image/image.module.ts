import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clothing } from 'src/clothing/clothing.entity';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { Image } from './image.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Image, Clothing])],
  controllers: [ImageController],
  providers: [ImageService],
})
export class ImageModule {}
