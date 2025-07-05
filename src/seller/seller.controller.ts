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
  UnauthorizedException,
  Request,
  ParseFloatPipe,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { SellerService } from './seller.service';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import { LoginSellerDto } from './dto/login-seller.dto';
import { AuthGuard } from '@nestjs/passport';
import { IRequestWithUser } from 'src/interfaces';

@Controller('sellers')
export class SellerController {
  constructor(
    private readonly sellerService: SellerService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  async register(@Body() createSellerDto: CreateSellerDto) {
    const seller = await this.sellerService.create(createSellerDto);
    const { ...result } = seller;
    return result;
  }

  @UseGuards(AuthGuard('jwt'))
  @Get()
  findAll() {
    return this.sellerService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('balance')
  getBalance(@Req() req: IRequestWithUser) {
    if (!req.user.seller) {
      throw new UnauthorizedException(
        'Acesso permitido apenas para vendedores.',
      );
    }
    const sellerId = Number(req.user.userId);
    if (!sellerId || isNaN(sellerId)) {
      throw new UnauthorizedException('ID de vendedor inválido.');
    }
    return this.sellerService.getBalance(sellerId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('withdraw')
  requestWithdrawal(
    @Req() req: IRequestWithUser,
    @Body('amount', ParseFloatPipe) amount: number,
  ) {
    if (!req.user.seller) {
      throw new UnauthorizedException(
        'Acesso permitido apenas para vendedores.',
      );
    }
    return this.sellerService.requestWithdrawal(req.user.userId, amount);
  }

  @UseGuards(AuthGuard('jwt'))
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sellerService.findOne(+id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSellerDto: UpdateSellerDto) {
    return this.sellerService.update(+id, updateSellerDto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sellerService.remove(+id);
  }

  @Post('login')
  async login(@Body() loginSellerDto: LoginSellerDto) {
    const seller = await this.sellerService.findByEmail(loginSellerDto.email);
    if (!seller) {
      return { message: 'Email ou senha inválidos' };
    }
    const isPasswordValid = await bcrypt.compare(
      loginSellerDto.password,
      seller.password,
    );
    if (!isPasswordValid) {
      return { message: 'Email ou senha inválidos' };
    }
    // Gere o JWT
    const payload = { sub: seller.id, email: seller.email };
    const token = this.jwtService.sign(payload);
    const { ...result } = seller;
    return {
      token,
      ...result,
    };
  }
}
