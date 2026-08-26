import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CatalogVersion } from './cert-catalog-version.entity';
import { CertificationOdsApi } from './cert-certification-ods-api.entity';

@Entity({ schema: 'cert', name: 'certification_process' })
export class CertificationProcess {
  @PrimaryGeneratedColumn()
  certificationProcessId: number;

  @ManyToOne(() => CertificationOdsApi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'odsId' })
  ods: CertificationOdsApi;

  @Column()
  odsId: number;

  @ManyToOne(() => CatalogVersion, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'catalogVersionId' })
  catalogVersion: CatalogVersion;

  @Column()
  catalogVersionId: number;

  @Column({ type: 'varchar', length: 50 })
  status: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
