import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Clothing, ClothingStatus } from './clothing.entity';
import { Store } from '../store/store.entity';
import { CreateClothingDto } from './dto/create-clothing.dto';
import { UpdateClothingDto } from './dto/update-clothing.dto';
import { ClothingStatusService } from './clothing-status.service';
import { ClothingSearchDto } from './dto/clothing-search.dto';

@Injectable()
export class ClothingService {
  constructor(
    @InjectRepository(Clothing)
    private clothingRepository: Repository<Clothing>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    private readonly clothingStatusService: ClothingStatusService,
  ) {}

  async create(createClotingDto: CreateClothingDto): Promise<Clothing> {
    try {
      // verifica se a data e hora do termino sao maiores que a data e hora de inicio
      if (!createClotingDto.end_date || !createClotingDto.end_time) {
        throw new BadRequestException('End date and time must be provided');
      }
      if (!createClotingDto.initial_date || !createClotingDto.initial_time) {
        throw new BadRequestException('Initial date and time must be provided');
      }
      const initialDateTime = new Date(
        `${createClotingDto.initial_date}T${createClotingDto.initial_time}`,
      );
      const endDateTime = new Date(
        `${createClotingDto.end_date}T${createClotingDto.end_time}`,
      );
      if (endDateTime.getTime() <= initialDateTime.getTime()) {
        throw new BadRequestException(
          'End date and time must be greater than initial date and time',
        );
      }

      // Determinar o status inicial
      const initialStatus = this.clothingStatusService.getInitialStatus(
        createClotingDto.initial_date,
        createClotingDto.initial_time,
      );

      const clothing = this.clothingRepository.create({
        ...createClotingDto,
        status: initialStatus as ClothingStatus,
      });
      return await this.clothingRepository.save(clothing);
    } catch (error: any) {
      throw new BadRequestException(
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        error?.message || 'Failed to create clothing',
      );
    }
  }

  async findAll(
    page = 1,
    limit = 10,
  ): Promise<{ items: Clothing[]; lastPage: boolean }> {
    const clothings = await this.clothingRepository.find({
      relations: ['store', 'bids', 'bids.buyer', 'images'],
      where: {
        status: 'active' as ClothingStatus,
      },
    });

    const start = (page - 1) * limit;
    const end = start + limit;
    const items = clothings.slice(start, end);
    const lastPage = end >= clothings.length;

    return {
      items,
      lastPage,
    };
  }

  async findAuctionsWonByBuyer(buyerId: number): Promise<Clothing[]> {
    // const now = new Date();

    const clothings = await this.clothingRepository.find({
      relations: ['bids', 'bids.buyer', 'store', 'images'],
    });

    return clothings.filter((c) => {
      const isWinner = c.bids?.some(
        (bid) =>
          bid.id === c.current_winner_bid_id && bid.buyer?.id === buyerId,
      );
      return isWinner && c.current_winner_bid_id !== null;
    });
  }

  async findFinishedWithBidsBySeller(sellerId: number): Promise<Clothing[]> {
    const now = new Date();

    const clothings = await this.clothingRepository.find({
      relations: ['bids', 'bids.buyer', 'store', 'images'],
      where: {
        store: {
          seller: {
            id: sellerId,
          },
        },
      },
    });

    return clothings.filter((c) => {
      if (!c.end_date || !c.end_time) return false;
      const endDateTime = new Date(`${c.end_date}T${c.end_time}`);
      return (
        endDateTime.getTime() < now.getTime() && c.bids && c.bids.length > 0
      );
    });
  }

  async findFinishedByBuyer(buyerId: number): Promise<Clothing[]> {
    const now = new Date();

    // Busca todas as roupas com lances desse buyer
    const clothings = await this.clothingRepository.find({
      relations: ['bids', 'bids.buyer', 'store'],
    });

    // Filtra roupas finalizadas e com pelo menos um lance do buyer
    return clothings
      .map((clothing) => {
        if (!clothing.end_date || !clothing.end_time) return null;
        const endDateTime = new Date(
          `${clothing.end_date}T${clothing.end_time}`,
        );
        if (endDateTime.getTime() >= now.getTime()) return null;

        // Filtra apenas os bids desse buyer
        const buyerBids = (clothing.bids || []).filter(
          (bid) => bid.buyer?.id === buyerId,
        );
        if (buyerBids.length === 0) return null;

        return {
          ...clothing,
          bids: buyerBids,
        };
      })
      .filter((c): c is Clothing => c !== null);
  }

  async findAllPerUser(
    sellerId: number,
    page = 1,
    limit = 10,
  ): Promise<{ items: Clothing[]; lastPage: boolean }> {
    const clothings = await this.clothingRepository.find({
      relations: ['store', 'bids', 'bids.buyer', 'images'],
      where: {
        store: {
          seller: {
            id: sellerId,
          },
        },
        status: 'active' as ClothingStatus,
      },
    });

    const start = (page - 1) * limit;
    const end = start + limit;
    const items = clothings.slice(start, end);
    const lastPage = end >= clothings.length;

    return {
      items,
      lastPage,
    };
  }

  async findOne(id: number): Promise<Clothing> {
    const clothing = await this.clothingRepository.findOne({
      where: { id },
      relations: ['store', 'store.seller', 'bids', 'bids.buyer', 'images'],
    });
    if (!clothing) {
      throw new NotFoundException(`Store with id ${id} not found`);
    }
    return clothing;
  }

  async getTimeRemaining(id: number) {
    const clothing = await this.clothingRepository.findOne({ where: { id } });
    if (!clothing) {
      throw new Error('Clothing not found');
    }

    // Combina data e hora para criar objetos Date
    const initialDateTime = new Date(
      `${clothing.initial_date}T${clothing.initial_time}`,
    );
    const endDateTime = new Date(`${clothing.end_date}T${clothing.end_time}`);
    const now = new Date();

    const timeRemaining = endDateTime.getTime() - now.getTime();
    console.log('initial Date', initialDateTime);
    console.log('final Date', endDateTime);
    return {
      isActive:
        now.getTime() >= initialDateTime.getTime() &&
        now.getTime() <= endDateTime.getTime(),
      timeRemaining: timeRemaining > 0 ? timeRemaining : 0,
      end_date: clothing.end_date,
      end_time: clothing.end_time,
    };
  }

  async update(id: number, dto: UpdateClothingDto): Promise<Clothing> {
    await this.clothingRepository.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.clothingRepository.delete(id);
  }

  async manageFindAll(
    page = 1,
    limit = 10,
    sellerId: number, // Novo parâmetro obrigatório
    searchDto?: ClothingSearchDto,
  ): Promise<{ items: Clothing[]; lastPage: boolean }> {
    let query = this.clothingRepository
      .createQueryBuilder('clothing')
      .leftJoinAndSelect('clothing.store', 'store')
      .leftJoinAndSelect('store.seller', 'seller')
      .leftJoinAndSelect('clothing.bids', 'bids')
      .leftJoinAndSelect('bids.buyer', 'buyer')
      .leftJoinAndSelect('clothing.images', 'images')
      .select([
        'clothing',
        'store.name',
        'seller.id',
        'bids',
        'buyer',
        'images',
      ]);

    // FILTRO OBRIGATÓRIO: apenas roupas das lojas do seller
    query = query.andWhere('seller.id = :sellerId', { sellerId });

    // console.log('🔍 Filtering by sellerId:', sellerId);

    // Aplicar outros filtros
    if (searchDto?.status) {
      // console.log('🔍 Applying status filter:', searchDto.status);
      query = query.andWhere('clothing.status = :status', {
        status: searchDto.status,
      });
    }

    if (searchDto?.minBid) {
      query = query.andWhere('clothing.initial_bid >= :minBid', {
        minBid: searchDto.minBid,
      });
    }

    if (searchDto?.maxBid) {
      query = query.andWhere('clothing.initial_bid <= :maxBid', {
        maxBid: searchDto.maxBid,
      });
    }

    if (searchDto?.size) {
      query = query.andWhere('clothing.size = :size', {
        size: searchDto.size,
      });
    }

    if (searchDto?.storeId) {
      query = query.andWhere('clothing.storeId = :storeId', {
        storeId: searchDto.storeId,
      });
    }

    if (searchDto?.initialDate) {
      query = query.andWhere('clothing.initial_date >= :initialDate', {
        initialDate: searchDto.initialDate,
      });
    }

    if (searchDto?.finalDate) {
      query = query.andWhere('clothing.end_date <= :finalDate', {
        finalDate: searchDto.finalDate,
      });
    }

    if (searchDto?.querySearch) {
      const searchTerm = searchDto.querySearch.trim();

      if (searchTerm.length >= 2) {
        const escapedSearch = searchTerm
          .replace(/[%_\\]/g, '\\$&')
          .toLowerCase();

        // Buscar apenas no nome (como resolvemos antes)
        query = query.andWhere('LOWER(clothing.name) LIKE :search', {
          search: `%${escapedSearch}%`,
        });
      }
    }

    // Debug da query final
    // console.log('🔍 Final SQL:', query.getSql());
    // console.log('🔍 Parameters:', query.getParameters());

    const clothings = await query.getMany();
    // console.log('🔍 Total results for seller:', clothings.length);

    const start = (page - 1) * limit;
    const end = start + limit;
    const items = clothings.slice(start, end);
    const lastPage = end >= clothings.length;

    return {
      items,
      lastPage,
    };
  }

  async getHistory(
    page = 1,
    limit = 10,
    buyerId: number, // Novo parâmetro obrigatório
    searchDto?: ClothingSearchDto,
  ): Promise<{ items: Clothing[]; lastPage: boolean }> {
    // Busca todas as roupas onde o buyer fez pelo menos um lance
    console.log(
      '🔍 Fetching history for buyerId:',
      buyerId,
      searchDto.situation,
    );
    const clothings =
      searchDto?.situation === 'winner'
        ? await this.findAuctionsWonByBuyer(buyerId)
        : await this.clothingRepository.find({
            relations: ['store', 'bids', 'bids.buyer', 'images'],
            where: {
              bids: {
                buyer: {
                  id: buyerId,
                },
              },
            },
          });

    console.log('🔍 won clothings for buyer:', clothings);

    // Aplica filtros adicionais se fornecidos
    let filteredClothings = clothings;

    if (searchDto?.status) {
      filteredClothings = filteredClothings.filter(
        (clothing) => clothing.status === searchDto.status,
      );
    }

    if (searchDto?.size) {
      filteredClothings = filteredClothings.filter(
        (clothing) => clothing.size === searchDto.size,
      );
    }

    if (searchDto?.storeId) {
      filteredClothings = filteredClothings.filter(
        (clothing) => clothing.store.id === searchDto.storeId,
      );
    }

    if (searchDto?.minBid) {
      filteredClothings = filteredClothings.filter(
        (clothing) => Number(clothing.initial_bid) >= searchDto.minBid,
      );
    }

    if (searchDto?.maxBid) {
      filteredClothings = filteredClothings.filter(
        (clothing) => Number(clothing.initial_bid) <= searchDto.maxBid,
      );
    }

    if (searchDto?.querySearch) {
      const searchTerm = searchDto.querySearch.toLowerCase().trim();
      if (searchTerm.length >= 2) {
        filteredClothings = filteredClothings.filter((clothing) =>
          clothing.name.toLowerCase().includes(searchTerm),
        );
      }
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const items = filteredClothings.slice(start, end);
    const lastPage = end >= filteredClothings.length;

    return {
      items,
      lastPage,
    };
  }
}
