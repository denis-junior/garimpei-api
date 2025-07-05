import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Store } from 'src/store/store.entity';
import { Bid } from 'src/bid/bid.entity';
import { Image } from 'src/image/image.entity';

export enum ClothingStatus {
  AUCTIONING = 'auctioning', // Em leilão
  PENDING_PAYMENT = 'pending_payment', // Aguardando pagamento
  SOLD = 'sold', // Vendido
  EXPIRED = 'expired', // Leilão expirou sem lances
}
@Entity()
export class Clothing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  initial_bid: number;

  @Column({ type: 'date', nullable: true })
  initial_date: string; // Apenas a data (YYYY-MM-DD)

  @Column({ type: 'time', nullable: true })
  initial_time: string; // Apenas a hora (HH:mm:ss)

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({ type: 'time', nullable: true })
  end_time: string;

  @Column({ default: '' })
  size: string;

  @Column({
    type: 'enum',
    enum: ClothingStatus,
    default: ClothingStatus.AUCTIONING,
  })
  status: ClothingStatus;

  @ManyToOne(() => Store, (store) => store.clothings, { onDelete: 'CASCADE' })
  store: Store;

  @OneToMany(() => Bid, (bid) => bid.clothing, { cascade: true })
  bids: Bid[];

  @OneToMany(() => Image, (image) => image.clothing, { cascade: true })
  images: Image[];
}
