import { Type } from 'class-transformer';
import { IsOptional, IsString, IsNumber, Min, IsIn } from 'class-validator';

// Usar array de strings em vez do enum
const VALID_STATUSES = [
  'programmed',
  'active',
  'ended',
  'auctioned',
  'paid',
  'waiting_payment',
  'delivery_process',
  'finished',
] as const;

export class ClothingSearchDto {
  @IsOptional()
  @IsString()
  querySearch?: string;

  @IsOptional()
  @IsString()
  size?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBid?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBid?: number;

  @IsOptional()
  @IsString()
  initialDate?: string;

  @IsOptional()
  @IsString()
  finalDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  storeId?: number;

  @IsOptional()
  @IsString()
  @IsIn(VALID_STATUSES)
  status?: string; // Mudança: usar string em vez do ClothingStatus
}
