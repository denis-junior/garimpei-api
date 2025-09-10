import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Store } from '../store/store.entity';
import { Bid } from '../bid/bid.entity';
import { Image } from '../image/image.entity';

export type ClothingStatus =
  | 'programmed'
  | 'active'
  | 'disabled'
  | 'ended'
  | 'auctioned'
  | 'paid'
  | 'waiting_payment'
  | 'finished';

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
  initial_date: string;

  @Column({ type: 'time', nullable: true })
  initial_time: string;

  @Column({ type: 'date', nullable: true })
  end_date: string;

  @Column({ type: 'time', nullable: true })
  end_time: string;

  @Column({ default: '' })
  size: string;

  @Column({
    type: 'enum',
    enum: [
      'programmed',
      'active',
      'disabled',
      'ended',
      'auctioned',
      'waiting_payment',
      'paid',
      'delivery_process',
      'finished',
    ],
    default: 'programmed',
  })
  status: ClothingStatus;

  // Novos campos para rastrear o processo pós-leilão
  @Column({ type: 'timestamp', nullable: true })
  auctioned_at: Date; // Quando foi leiloado (email enviado)

  @Column({ type: 'timestamp', nullable: true })
  payment_warning_sent_at: Date; // Quando o aviso de pagamento foi enviado

  @Column({ type: 'int', nullable: true })
  current_winner_bid_id: number; // ID do bid vencedor atual

  @Column('simple-array', { nullable: true })
  excludedBidders: number[] = []; // IDs dos usuários excluídos do leilão

  @Column({ type: 'int', default: 0 })
  auction_attempt: number; // Tentativa atual (0 = primeiro vencedor, 1 = segundo, etc.)

  @ManyToOne(() => Store, (store) => store.clothings, { onDelete: 'CASCADE' })
  store: Store;

  @OneToMany(() => Bid, (bid) => bid.clothing, { cascade: true })
  bids: Bid[];

  @OneToMany(() => Image, (image) => image.clothing, { cascade: true })
  images: Image[];
}
