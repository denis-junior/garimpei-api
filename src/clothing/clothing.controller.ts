import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  UploadedFiles,
  Req,
  Query,
} from '@nestjs/common';
import { CreateClothingDto } from './dto/create-clothing.dto';
import { UpdateClothingDto } from './dto/update-clothing.dto';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { BlobService } from 'src/blob/blob.service';
import { Image } from '../image/image.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { IRequestWithUser } from 'src/interfaces';
import { ClothingService } from './clothing.service';
import { ClothingStatusService } from './clothing-status.service';
import { ClothingSearchDto } from './dto/clothing-search.dto';

@Controller('clothing')
export class ClothingController {
  constructor(
    private readonly clothingService: ClothingService,
    private readonly clothingStatusService: ClothingStatusService,
    private readonly blobService: BlobService,
    @InjectRepository(Image)
    private readonly imageRepository: Repository<Image>,
    private readonly dataSource: DataSource,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(@Body() dto: CreateClothingDto) {
    return this.clothingService.create(dto);
  }

  @Get()
  findAll(
    @Req() req: IRequestWithUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    if (req?.user?.seller) {
      return this.clothingService.findAllPerUser(req.user.userId);
    }
    return this.clothingService.findAll(Number(page), Number(limit));
  }

  @Get('manage')
  manageFindAll(
    @Req() req: IRequestWithUser,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query() searchDto: ClothingSearchDto,
  ) {
    // Busca padrão com filtros opcionais
    return this.clothingService.manageFindAll(
      Number(page),
      Number(limit),
      searchDto,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('finished-with-bids')
  async getFinishedWithBids(@Req() req: IRequestWithUser) {
    if (req?.user?.seller) {
      return this.clothingService.findFinishedWithBidsBySeller(req.user.userId);
    }
    return this.clothingService.findFinishedByBuyer(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('won-auctions')
  async getWonAuctions(@Req() req: IRequestWithUser) {
    if (req?.user?.seller) {
      return this.clothingService.findFinishedWithBidsBySeller(req.user.userId);
    }
    return this.clothingService.findAuctionsWonByBuyer(req.user.userId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('create-with-images')
  @UseInterceptors(FilesInterceptor('images', 10))
  async createWithImages(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() body: CreateClothingDto,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const clothing = await queryRunner.manager
        .getRepository('Clothing')
        .save(queryRunner.manager.getRepository('Clothing').create(body));

      console.log('Clothing Result:', clothing);

      if (!clothing || !clothing.id) {
        throw new Error('Falha ao criar o produto');
      }

      const images: { url: string }[] = [];

      // Processa todas as imagens
      for (const file of files) {
        const path = `clothing/${clothing.id}`;
        const imageUrl = await this.blobService.uploadFile(file, path);

        const image = queryRunner.manager.getRepository('Image').create({
          url: imageUrl,
          clothing,
        });
        await queryRunner.manager.getRepository('Image').save(image);
        images.push({ url: imageUrl });
      }

      // Confirma a transação
      await queryRunner.commitTransaction();

      return {
        ...clothing,
        images,
      };
    } catch (error) {
      // Desfaz a transação em caso de erro
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      // Libera o query runner
      await queryRunner.release();
    }
  }

  @Post('process-all')
  async processAllStatuses() {
    await this.clothingStatusService.updateClothingStatuses();
    return { success: true, message: 'All clothing statuses processed' };
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clothingService.findOne(+id);
  }

  @Get(':id/time-remaining')
  getTimeRemaining(@Param('id') id: string) {
    return this.clothingService.getTimeRemaining(+id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/upload-image')
  @UseInterceptors(FileInterceptor('image'))
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const path = `clothing/${id}`;
    const imageUrl = await this.blobService.uploadFile(file, path);

    // Salva a URL no banco
    const clothing = await this.clothingService.findOne(+id);
    const image = this.imageRepository.create({ url: imageUrl, clothing });
    await this.imageRepository.save(image);

    return { imageUrl };
  }

  // @UseGuards(AuthGuard('jwt'))
  // @Post('create-with-image')
  // @UseInterceptors(FileInterceptor('image'))
  // async createWithImage(
  //   @UploadedFile() file: Express.Multer.File,
  //   @Body() body: any,
  // ) {
  //   const queryRunner = this.dataSource.createQueryRunner();
  //   await queryRunner.connect();
  //   await queryRunner.startTransaction();

  //   try {
  //     // Cria o produto dentro da transação
  //     const clothingResult = await queryRunner.manager
  //       .getRepository('Clothing')
  //       .save(queryRunner.manager.getRepository('Clothing').create(body));
  //     const clothing = Array.isArray(clothingResult)
  //       ? clothingResult[0]
  //       : clothingResult;

  //     console.log('Clothing Result:', clothingResult);

  //     // Faz upload da imagem
  //     const path = `clothing/${clothing.id}`;
  //     const imageUrl = await this.blobService.uploadFile(file, path);

  //     // Salva a imagem dentro da transação
  //     const image = queryRunner.manager.getRepository('Image').create({
  //       url: imageUrl,
  //       clothing,
  //     });
  //     await queryRunner.manager.getRepository('Image').save(image);

  //     // Confirma a transação
  //     await queryRunner.commitTransaction();

  //     return {
  //       ...clothing,
  //       images: [{ url: imageUrl }],
  //     };
  //   } catch (error) {
  //     // Desfaz a transação em caso de erro
  //     await queryRunner.rollbackTransaction();
  //     throw error;
  //   } finally {
  //     // Libera o query runner
  //     await queryRunner.release();
  //   }
  // }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClothingDto) {
    return this.clothingService.update(+id, dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clothingService.remove(+id);
  }

  @Post(':id/mark-paid')
  async markAsPaid(@Param('id') id: string) {
    const clothing = await this.clothingService.findOne(+id);

    if (clothing.status !== 'waiting_payment') {
      return { success: false, message: 'Clothing is not waiting for payment' };
    }

    await this.clothingService.update(+id, { status: 'paid' });

    return {
      success: true,
      message: `Clothing ${id} marked as paid`,
    };
  }

  @Post(':id/force-next-bidder')
  async forceNextBidder(@Param('id') id: string) {
    const clothing = await this.clothingService.findOne(+id);

    if (clothing.status !== 'waiting_payment') {
      return { success: false, message: 'Clothing is not waiting for payment' };
    }

    // Forçar processamento do próximo lance
    await this.clothingStatusService['processNextBidder'](clothing);

    return {
      success: true,
      message: `Next bidder process initiated for clothing ${id}`,
    };
  }
}
