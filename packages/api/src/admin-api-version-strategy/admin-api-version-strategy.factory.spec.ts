import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminApiVersionStrategyFactory } from './admin-api-version-strategy.factory';
import { V1AdminApiVersionStrategy } from './v1-admin-api-version.strategy';
import { V2AdminApiVersionStrategy } from './v2-admin-api-version.strategy';
import { V3AdminApiVersionStrategy } from './v3-admin-api-version.strategy';

describe('AdminApiVersionStrategyFactory', () => {
  let factory: AdminApiVersionStrategyFactory;
  let v1: V1AdminApiVersionStrategy;
  let v2: V2AdminApiVersionStrategy;
  let v3: V3AdminApiVersionStrategy;

  beforeEach(async () => {
    v1 = { version: 'v1' } as V1AdminApiVersionStrategy;
    v2 = { version: 'v2' } as V2AdminApiVersionStrategy;
    v3 = { version: 'v3' } as V3AdminApiVersionStrategy;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminApiVersionStrategyFactory,
        { provide: V1AdminApiVersionStrategy, useValue: v1 },
        { provide: V2AdminApiVersionStrategy, useValue: v2 },
        { provide: V3AdminApiVersionStrategy, useValue: v3 },
      ],
    }).compile();

    factory = module.get(AdminApiVersionStrategyFactory);
  });

  it('resolves each known version to its strategy', () => {
    expect(factory.getStrategy('v1')).toBe(v1);
    expect(factory.getStrategy('v2')).toBe(v2);
    expect(factory.getStrategy('v3')).toBe(v3);
  });

  it('throws for an unknown or missing version', () => {
    expect(() => factory.getStrategy('v4')).toThrow('Invalid API version: v4');
    expect(() => factory.getStrategy(undefined)).toThrow('Invalid API version: undefined');
  });
});
