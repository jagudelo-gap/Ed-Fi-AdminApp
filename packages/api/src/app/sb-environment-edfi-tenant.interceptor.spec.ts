import 'reflect-metadata';
import { CallHandler, ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import { SbEnvironmentEdfiTenantInterceptor } from './sb-environment-edfi-tenant.interceptor';

describe('SbEnvironmentEdfiTenantInterceptor - SbVersion allow-list', () => {
  let interceptor: SbEnvironmentEdfiTenantInterceptor;
  let mockEdfiTenantsRepository: Partial<Repository<EdfiTenant>>;
  let mockSbEnvironmentsRepository: Partial<Repository<SbEnvironment>>;
  let mockReflector: Partial<Reflector>;

  const nextHandler: CallHandler = { handle: jest.fn().mockReturnValue('handled') } as unknown as CallHandler;

  const buildContext = (sbEnvironmentId = '5'): ExecutionContext => {
    const request: { params: Record<string, string> } = { params: { sbEnvironmentId } };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    mockEdfiTenantsRepository = {};
    mockSbEnvironmentsRepository = {
      findOneByOrFail: jest.fn(),
    };
    mockReflector = {
      getAllAndOverride: jest.fn(),
    };
    interceptor = new SbEnvironmentEdfiTenantInterceptor(
      mockEdfiTenantsRepository as Repository<EdfiTenant>,
      mockSbEnvironmentsRepository as Repository<SbEnvironment>,
      mockReflector as Reflector
    );
    jest.clearAllMocks();
  });

  it('allows the request when the environment version is in the SbVersion allow-list', async () => {
    (mockReflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(['v2', 'v3'])
      .mockReturnValueOnce('Doing a thing');
    (mockSbEnvironmentsRepository.findOneByOrFail as jest.Mock).mockResolvedValue({
      id: 5,
      version: 'v3',
    });

    const result = await interceptor.intercept(buildContext(), nextHandler);

    expect(result).toBe('handled');
  });

  it('rejects the request when the environment version is not in the SbVersion allow-list', async () => {
    (mockReflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(['v2', 'v3'])
      .mockReturnValueOnce('Doing a thing');
    (mockSbEnvironmentsRepository.findOneByOrFail as jest.Mock).mockResolvedValue({
      id: 5,
      version: 'v1',
    });

    await expect(interceptor.intercept(buildContext(), nextHandler)).rejects.toThrow(
      NotFoundException
    );
  });

  it('still restricts to a single version when only one is supplied (legacy call sites)', async () => {
    (mockReflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(['v2'])
      .mockReturnValueOnce('Doing a thing');
    (mockSbEnvironmentsRepository.findOneByOrFail as jest.Mock).mockResolvedValue({
      id: 5,
      version: 'v3',
    });

    await expect(interceptor.intercept(buildContext(), nextHandler)).rejects.toThrow(
      NotFoundException
    );
  });

  it('does not restrict the request when no SbVersion metadata is set', async () => {
    (mockReflector.getAllAndOverride as jest.Mock)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);
    (mockSbEnvironmentsRepository.findOneByOrFail as jest.Mock).mockResolvedValue({
      id: 5,
      version: 'v1',
    });

    const result = await interceptor.intercept(buildContext(), nextHandler);

    expect(result).toBe('handled');
  });
});
