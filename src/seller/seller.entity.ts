import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Store } from '../store/store.entity';

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

  @Column({ type: 'text', nullable: true })
  mp_access_token: string;

  @Column({ type: 'text', nullable: true })
  mp_refresh_token: string;

  @Column({ type: 'boolean', default: false })
  mp_conectado: boolean;

  @Column({ type: 'timestamp', nullable: true })
  mp_conectado_em: Date;

  @OneToMany(() => Store, (store) => store.seller, { cascade: true })
  stores: Store[];
}
