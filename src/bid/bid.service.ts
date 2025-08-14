import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Bid } from './bid.entity';
import { CreateBidDto } from './dto/create-bid.dto';
import { UpdateBidDto } from './dto/update-bid.dto';
import { Store } from 'src/store/store.entity';
import { Clothing } from 'src/clothing/clothing.entity';
import { BidSseService } from './bid-sse.service';

@Injectable()
export class BidService {
  constructor(
    @InjectRepository(Bid)
    private bidRepository: Repository<Bid>,
    @InjectRepository(Store)
    private storeRepository: Repository<Store>,
    @InjectRepository(Clothing)
    private clothingService: Repository<Clothing>,
    private bidSseService: BidSseService,
  ) {}

  async create(createBidDto: CreateBidDto, id: number): Promise<Bid> {
    const now = new Date();

    // Usa horário local em vez de UTC
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    const date = `${year}-${month}-${day}`;
    const time = `${hours}:${minutes}:${seconds}`;

    const clothingId = createBidDto.clothing;

    const clothing = await this.clothingService.findOne({
      where: { id: Number(clothingId) },
      relations: ['bids'],
    });

    if (!clothing) {
      throw new NotFoundException('Clothing não encontrada.');
    }

    const deadlineString = `${clothing.end_date}T${clothing.end_time}`;
    const initialAuctionString = `${clothing.initial_date}T${clothing.initial_time}`;
    const deadline = new Date(deadlineString);
    const initialAuction = new Date(initialAuctionString);

    if (new Date() > deadline) {
      throw new ForbiddenException(
        'O prazo para dar lances nesta peça expirou.',
      );
    }
    if (new Date() < initialAuction) {
      throw new ForbiddenException(
        'O prazo para dar lances nesta peça ainda não começou.',
      );
    }

    const lastBid = await this.bidRepository.findOne({
      where: { clothing: { id: Number(clothingId) } },
      order: { id: 'DESC' },
    });

    if (lastBid && createBidDto.bid <= lastBid.bid) {
      throw new ForbiddenException(
        'O lance deve ser maior que o último lance dado!',
      );
    }

    const bid = this.bidRepository.create({
      ...createBidDto,
      date,
      time,
      buyer: { id: id },
    });

    const savedBid = await this.bidRepository.save(bid);

    this.bidSseService.emitNewBid(Number(createBidDto.clothing), savedBid);

    return savedBid;
  }

  findAllUser(id: number) {
    console.log('id is', id);
    return this.bidRepository.find({
      where: { buyer: { id } },
      relations: ['buyer', 'clothing'],
    });
  }

  async findAllSeller(id: number) {
    // Busca todas as stores do seller
    const stores = await this.storeRepository.find({
      where: { seller: { id } },
      relations: [
        'clothings',
        'clothings.bids',
        'clothings.bids.buyer',
        'clothings.bids.clothing',
      ],
    });

    const bids = stores
      .flatMap((store) => store.clothings)
      .flatMap((clothing) => clothing.bids);

    return bids;
  }

  findAllPerClothing(id: number) {
    console.log("I'm clothing", id);
    return this.bidRepository.find({
      where: { clothing: { id } },
      relations: ['buyer', 'clothing'],
    });
  }

  findOne(id: number) {
    return this.bidRepository.findOne({
      where: { id },
      relations: ['buyer', 'clothing'],
    });
  }

  async update(id: number, dto: UpdateBidDto) {
    await this.bidRepository.update(id, dto);
    return this.findOne(id);
  }

  remove(id: number) {
    return this.bidRepository.delete(id);
  }
}
