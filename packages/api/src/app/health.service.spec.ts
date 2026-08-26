import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

type HealthServiceWithPrivateMembers = {
  checkDatabaseIndependently: () => Promise<boolean>;
};

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();
    service = module.get(HealthService);
  });

  it('getHealth() returns healthy status when DB check passes', async () => {
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockResolvedValueOnce(true);
    const result = await service.getHealth();
    expect(result.status).toBe('healthy');
    expect(result.checks.api.status).toBe('healthy');
    expect(result.checks.database.status).toBe('healthy');
    expect(result.timestamp).toBeTruthy();
  });

  it('getHealth() returns unhealthy when DB check returns false', async () => {
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockResolvedValueOnce(false);
    const result = await service.getHealth();
    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.status).toBe('unhealthy');
    expect(result.checks.api.status).toBe('healthy');
  });

  it('getHealth() returns unhealthy when DB check throws a regular error', async () => {
    jest
      .spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently')
      .mockRejectedValueOnce(new Error('connection refused'));
    const result = await service.getHealth();
    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.status).toBe('unhealthy');
    expect(result.checks.database.message).toContain('Database unavailable');
  });

  it('getHealth() handles AggregateError from DB check', async () => {
    const aggErr = Object.assign(new Error('aggregate'), {
      name: 'AggregateError',
      errors: [new Error('inner db error')],
    });
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockRejectedValueOnce(aggErr);
    const result = await service.getHealth();
    expect(result.status).toBe('unhealthy');
  });

  it('getHealth() includes a valid ISO timestamp', async () => {
    jest.spyOn(service as unknown as HealthServiceWithPrivateMembers, 'checkDatabaseIndependently').mockResolvedValueOnce(true);
    const result = await service.getHealth();
    expect(() => new Date(result.timestamp)).not.toThrow();
    expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);
  });
});

