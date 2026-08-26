import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ schema: 'cert', name: 'certification_ods_api' })
export class CertificationOdsApi {
  @PrimaryGeneratedColumn()
  odsId: number;

  @Column({ type: 'varchar', length: 2048 })
  odsUrl: string;

  @Column({ type: 'varchar', length: 255 })
  clientId: string;
}
