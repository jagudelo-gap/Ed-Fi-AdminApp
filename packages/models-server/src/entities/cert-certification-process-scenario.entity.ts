import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { CertificationProcess } from './cert-certification-process.entity';
import { ScenarioCatalog } from './cert-scenario-catalog.entity';

@Entity({ schema: 'cert', name: 'certification_process_scenario' })
export class CertificationProcessScenario {
  @PrimaryColumn()
  certificationProcessId: number;

  @PrimaryColumn()
  scenarioId: number;

  @ManyToOne(() => CertificationProcess, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificationProcessId' })
  certificationProcess: CertificationProcess;

  @ManyToOne(() => ScenarioCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioId' })
  scenario: ScenarioCatalog;

  @Column({ type: 'varchar', length: 50 })
  status: string;
}
