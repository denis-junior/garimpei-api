import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seller } from './seller.entity';
import { CreateSellerDto } from './dto/create-seller.dto';
import { UpdateSellerDto } from './dto/update-seller.dto';
import * as bcrypt from 'bcrypt';
import { Buyer } from 'src/buyer/buyer.entity';
import { JwtService } from '@nestjs/jwt';
import { Transaction } from 'src/payment/transaction.entity';
import { TransactionType } from 'src/payment/transaction.entity';
import { UnauthorizedException, Logger } from '@nestjs/common';

@Injectable()
export class SellerService {
  private readonly logger = new Logger(SellerService.name);

  constructor(
    @InjectRepository(Seller)
    private sellerRepository: Repository<Seller>,
    @InjectRepository(Buyer)
    private buyerRepository: Repository<Buyer>,
    @InjectRepository(Transaction)
    private transactionRepository: Repository<Transaction>,
    private jwtService: JwtService,
  ) {}

  async create(
    createSellerDto: CreateSellerDto,
  ): Promise<
    | ({ token: string; seller: boolean } & Omit<Seller, 'password'>)
    | { message: string }
  > {
    const buyer = await this.buyerRepository.findOne({
      where: { email: createSellerDto.email },
    });
    if (buyer) {
      return { message: 'Email já está em uso por um comprador.' };
    }
    const existingSeller = await this.sellerRepository.findOne({
      where: { email: createSellerDto.email },
    });
    if (existingSeller) {
      return { message: 'Email já está em uso por um vendedor.' };
    }
    const hash = await bcrypt.hash(createSellerDto.password, 10);

    const newSeller = this.sellerRepository.create({
      ...createSellerDto,
      password: hash,
    });

    const seller = await this.sellerRepository.save(newSeller); // <-- await aqui!

    const payload = { sub: seller.id, email: seller.email, seller: true };
    const token = this.jwtService.sign(payload);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...result } = seller;
    return { token, seller: true, ...result };
  }

  async findAll() {
    const sellers = await this.sellerRepository.find({ relations: ['stores'] });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    return sellers.map(({ password, ...rest }) => rest);
  }

  async findOne(id: number): Promise<Seller> {
    const seller = await this.sellerRepository.findOne({
      where: { id },
      relations: ['stores'],
    });
    if (!seller) {
      throw new Error(`Seller with id ${id} not found`);
    }
    return seller;
  }

  async update(id: number, updateSellerDto: UpdateSellerDto): Promise<Seller> {
    await this.sellerRepository.update(id, updateSellerDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.sellerRepository.delete(id);
  }

  async findByEmail(email: string): Promise<Seller | undefined> {
    const seller = await this.sellerRepository.findOne({ where: { email } });
    return seller === null ? undefined : seller;
  }

  async getBalance(sellerId: number): Promise<{ balance: number }> {
    const seller = await this.sellerRepository.findOneBy({ id: sellerId });
    if (!seller) {
      throw new NotFoundException('Vendedor não encontrado.');
    }
    return { balance: Number(seller.balance) };
  }

  getTransactionHistory(sellerId: number): Promise<Transaction[]> {
    return this.transactionRepository.find({
      where: { seller: { id: sellerId } },
      order: { createdAt: 'DESC' },
    });
  }

  async requestWithdrawal(
    sellerId: number,
    amount: number,
  ): Promise<{ message: string }> {
    const seller = await this.sellerRepository.findOneBy({ id: sellerId });
    if (!seller) {
      throw new NotFoundException('Vendedor não encontrado.');
    }
    if (Number(seller.balance) < amount) {
      throw new UnauthorizedException('Saldo insuficiente para o saque.');
    }
    if (!seller.mercadopagoAccountId) {
      throw new UnauthorizedException(
        'Conta do Mercado Pago não configurada para o saque.',
      );
    }

    // Lógica para chamar a API de Payouts do Mercado Pago iria aqui.
    // Por enquanto, vamos simular o saque no nosso sistema.

    const newBalance = Number(seller.balance) - amount;
    await this.sellerRepository.update(seller.id, { balance: newBalance });

    const transaction = this.transactionRepository.create({
      seller,
      type: TransactionType.WITHDRAWAL,
      amount: -amount, // Saques são registrados como valores negativos
    });
    await this.transactionRepository.save(transaction);

    this.logger.log(`Saque de ${amount} solicitado pelo vendedor ${sellerId}.`);

    return { message: 'Solicitação de saque processada com sucesso.' };
  }
}
