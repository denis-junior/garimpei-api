import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('transactions')
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  payment_id: string;

  @Column({ unique: true }) // ✅ Referência única
  @Index() // ✅ Indexar para busca rápida
  external_reference: string;

  @Column()
  vendedor_id: string;

  @Column('decimal', { precision: 10, scale: 2 })
  valor_total: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  taxa_mercadopago: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  valor_liquido: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  comissao_plataforma: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  valor_vendedor: number;

  @Column()
  status: string;

  @Column({ nullable: true })
  descricao: string;

  @Column({ nullable: true })
  email_comprador: string;

  @Column({ nullable: true })
  tipo_pagamento: string;

  @Column('jsonb', { nullable: true })
  metadata_pagamento: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
