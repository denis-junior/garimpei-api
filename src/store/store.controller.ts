import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { StoreService } from './store.service';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { Store } from './store.entity';
import { AuthGuard } from '@nestjs/passport';
import { IRequestWithUser } from 'src/interfaces';

@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @UseGuards(AuthGuard('jwt'))
  @Post()
  create(
    @Req() req: IRequestWithUser,
    @Body() createStoreDto: CreateStoreDto,
  ): Promise<Store> {
    const idSeller = req.user.userId;
    return this.storeService.create(createStoreDto, Number(idSeller));
  }

  @Get()
  findAll(@Req() req: IRequestWithUser): Promise<Store[] | Store> {
    console.log('Usuário autenticado:', req.user);
    if (req?.user?.seller) {
      return this.storeService.findAll(Number(req.user.userId));
    }
    return this.storeService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storeService.findOne(+id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateStoreDto: UpdateStoreDto) {
    return this.storeService.update(+id, updateStoreDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storeService.remove(+id);
  }
}
