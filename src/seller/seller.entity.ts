import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Store } from '../store/store.entity';
import { Transaction } from 'src/payment/transaction.entity';

@Entity()
export class Seller {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: '' })
  password: string;

  @Column({ default: '' })
  contact: string;

  @Column({ default: '' })
  instagram: string;

  @Column({ default: '' })
  cpf: string;

  @Column({ default: '' })
  email: string;

  @OneToMany(() => Store, (store) => store.seller, { cascade: true })
  stores: Store[];

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ nullable: true })
  mercadopagoAccountId: string; // ID da conta do vendedor no Mercado Pago

  @OneToMany(() => Transaction, (transaction) => transaction.seller)
  transactions: Transaction[];
}
