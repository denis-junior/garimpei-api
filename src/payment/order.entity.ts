import { Buyer } from 'src/buyer/buyer.entity';
import { Clothing } from 'src/clothing/clothing.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  CANCELED = 'canceled',
}

@Entity()
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'enum', enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  platformFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  sellerEarning: number;

  @Column({ nullable: true })
  paymentId: string; // ID do pagamento no Mercado Pago

  @OneToOne(() => Clothing)
  @JoinColumn()
  clothing: Clothing;

  @ManyToOne(() => Buyer)
  buyer: Buyer; // Vencedor do leilão

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
