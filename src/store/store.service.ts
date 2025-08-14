import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Store } from './store.entity';
import { Repository } from 'typeorm';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { ClothingStatus } from 'src/clothing/clothing.entity';

@Injectable()
export class StoreService {
  constructor(
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
  ) {}

  async create(createStoreDto: CreateStoreDto, id: number): Promise<Store> {
    const store = this.storeRepository.create({
      ...createStoreDto,
      seller: { id },
    });
    return this.storeRepository.save(store);
  }

  async findAll(idSeller?: number): Promise<Store[]> {
    const query = idSeller
      ? {
          where: { seller: { id: idSeller } },
          relations: ['seller', 'clothings'],
        }
      : {
          relations: ['seller', 'clothings'],
        };
    const stores = await this.storeRepository.find(query);
    return stores;
  }

  async findOneSeller(id: number): Promise<Store> {
    const store = await this.storeRepository.findOne({
      where: { id },
      relations: ['seller', 'clothings', 'clothings.images', 'clothings.bids'],
    });
    if (!store) {
      throw new NotFoundException(`Loja com id ${id} não encontrada`);
    }
    console.log('Store found for seller:', store);
    return store;
  }
  async findOne(id: number): Promise<Store> {
    const store = await this.storeRepository.findOne({
      where: { id, clothings: { status: 'active' as ClothingStatus } },
      relations: ['seller', 'clothings', 'clothings.images', 'clothings.bids'],
    });
    if (!store) {
      throw new NotFoundException(`Loja com id ${id} não encontrada`);
    }
    return store;
  }

  async update(id: number, updateStoreDto: UpdateStoreDto): Promise<Store> {
    await this.storeRepository.update(id, updateStoreDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.storeRepository.delete(id);
  }
}
