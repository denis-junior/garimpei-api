import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  payment_id: string;

  @Column()
  vendedor_id: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  valor_total: number; // Valor bruto (R$ 100.00)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  taxa_mercadopago: number; // Taxa do MP (R$ 5.48)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  valor_liquido: number; // Após taxa MP (R$ 94.52)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  comissao_plataforma: number; // Sua comissão (R$ 14.18)

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  valor_vendedor: number; // Para o vendedor (R$ 80.34)

  @Column()
  status: string;

  @Column()
  descricao: string;

  @Column()
  email_comprador: string;

  @Column('json', { nullable: true })
  metadata_pagamento: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
