import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Buyer } from '../buyer/buyer.entity';
import { Clothing } from '../clothing/clothing.entity';

@Entity()
export class Bid {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  bid: number;

  // ...existing code...
  @Column({ type: 'date', nullable: true })
  date: string;

  @Column({ type: 'time', nullable: true })
  time: string;
  // ...existing code...

  @ManyToOne(() => Buyer, (buyer) => buyer.bids, { onDelete: 'CASCADE' })
  buyer: Buyer;

  @ManyToOne(() => Clothing, (clothing) => clothing.bids, {
    onDelete: 'CASCADE',
  })
  clothing: Clothing;
}
