import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { CatalogVersion } from './cert-catalog-version.entity';

@Entity({ schema: 'cert', name: 'area_catalog' })
export class AreaCatalog {
  @PrimaryGeneratedColumn()
  areaId: number;

  @ManyToOne(() => CatalogVersion, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'catalogVersionId' })
  catalogVersion: CatalogVersion;

  @Column()
  catalogVersionId: number;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName: string | null;

  @Column()
  displayOrder: number;

  @Column({ default: true })
  isEnabled: boolean;
}
