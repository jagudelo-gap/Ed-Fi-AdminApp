import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ScenarioStep } from './cert-scenario-step.entity';

@Entity({ schema: 'cert', name: 'scenario_step_error' })
export class ScenarioStepError {
  @PrimaryGeneratedColumn()
  errorId: number;

  @ManyToOne(() => ScenarioStep, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'stepRunId' })
  stepRun: ScenarioStep;

  @Column()
  stepRunId: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  validation: string | null;
}
