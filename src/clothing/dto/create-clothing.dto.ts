import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CreateBidDto } from 'src/bid/dto/create-bid.dto';
import { CreateImageDto } from 'src/image/dto/create-image.dto';
import { CreateStoreDto } from 'src/store/dto/create-store.dto';
import { ClothingStatus } from '../clothing.entity';

export class CreateClothingDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  initial_bid: number;

  @IsDateString()
  initial_date: string; // Ex: '2025-06-22'

  @IsString()
  initial_time: string; // Ex: '14:00:00'

  @IsDateString()
  end_date: string;

  @IsString()
  end_time: string;

  @IsString()
  size: string;

  @IsString()
  status: ClothingStatus = 'programmed'; // Default status

  @ValidateNested({ each: true })
  @Type(() => CreateStoreDto)
  store: CreateStoreDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBidDto)
  bids?: CreateBidDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateImageDto)
  images?: CreateImageDto[];
}
