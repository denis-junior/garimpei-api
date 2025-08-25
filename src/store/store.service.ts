import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Store } from './store.entity';
import { ILike, Repository } from 'typeorm';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';

interface IFindAllQuery {
  name?: any;
  instagram?: any;
  seller?: { id: number };
}
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

  async findAll(idSeller?: number, name?: string): Promise<Store[]> {
    let whereConditions: any = {};

    if (idSeller && name && name.length > 0) {
      // Se tem idSeller e name, busca por seller E (name OU instagram)
      whereConditions = [
        {
          seller: { id: idSeller },
          name: ILike(`%${name}%`),
        },
        {
          seller: { id: idSeller },
          instagram: ILike(`%${name}%`),
        },
      ];
    } else if (idSeller) {
      // Se tem apenas idSeller
      whereConditions = { seller: { id: idSeller } };
    } else if (name && name.length > 0) {
      // Se tem apenas name, busca por name OU instagram
      whereConditions = [
        { name: ILike(`%${name}%`) },
        { instagram: ILike(`%${name}%`) },
      ];
    }

    console.log('Query Options:', whereConditions);

    const stores = await this.storeRepository.find({
      relations: ['seller', 'clothings'],
      where: whereConditions,
    });
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
      where: { id },
      relations: ['seller', 'clothings', 'clothings.images', 'clothings.bids'],
    });

    if (!store) {
      throw new NotFoundException(`Loja com id ${id} não encontrada`);
    }

    // Filtra apenas as clothings com status 'active'
    store.clothings = store.clothings.filter(
      (clothing) => clothing.status === 'active',
    );

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
