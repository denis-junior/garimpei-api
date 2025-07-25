import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Bid } from '../bid/bid.entity';

@Entity()
export class Buyer {
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

  @OneToMany(() => Bid, (bid) => bid.buyer)
  bids: Bid[];
}
