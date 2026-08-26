import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'cert', name: 'catalog_version' })
export class CatalogVersion {
  @PrimaryGeneratedColumn()
  catalogVersionId: number;

  @Column({ type: 'varchar', length: 255 })
  artifactVersion: string;

  @Column({ type: 'varchar', length: 10 })
  dataStandardVersion: string;

  @Column({ default: () => 'CURRENT_TIMESTAMP' })
  importedAt: Date;

  @Column({ default: false })
  isActive: boolean;
}
