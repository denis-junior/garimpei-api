import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
} from 'typeorm';
import { Seller } from '../seller/seller.entity';
import { Clothing } from '../clothing/clothing.entity';

@Entity()
export class Store {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ default: '' })
  description: string;

  @Column({ default: '' })
  contact: string;

  @Column({ default: '' })
  instagram: string;

  @Column({ default: '' })
  address: string;

  @ManyToOne(() => Seller, (seller) => seller.stores, { onDelete: 'CASCADE' })
  seller: Seller;

  @OneToMany(() => Clothing, (clothing) => clothing.store, { cascade: true })
  clothings: Clothing[];
}
