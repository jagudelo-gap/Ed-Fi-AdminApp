import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ScenarioCatalog } from './cert-scenario-catalog.entity';

@Entity({ schema: 'cert', name: 'step_catalog' })
export class StepCatalog {
  @PrimaryGeneratedColumn()
  stepId: number;

  @ManyToOne(() => ScenarioCatalog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'scenarioId' })
  scenario: ScenarioCatalog;

  @Column()
  scenarioId: number;

  @Column({ type: 'varchar', length: 255 })
  stepName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  displayName: string | null;

  @Column({ type: 'varchar', length: 50 })
  stepType: string;

  @Column()
  displayOrder: number;

  @Column({ default: true })
  isEnabled: boolean;
}
