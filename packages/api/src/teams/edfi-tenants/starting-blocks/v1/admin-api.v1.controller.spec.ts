import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Ids, SecretSharingMethod } from '@edanalytics/models';
import { EdfiTenant, Edorg, SbEnvironment } from '@edanalytics/models-server';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { AdminApiControllerV1 } from './admin-api.v1.controller';
import { AdminApiServiceV1 } from './admin-api.v1.service';
import { postYopassSecret } from '../../../../utils';

// postYopassSecret makes real network/crypto calls; mock it so the Yopass-path
// test below doesn't depend on an actual Yopass backend being configured.
jest.mock('../../../../utils', () => ({
  ...jest.requireActual('../../../../utils'),
  postYopassSecret: jest.fn(),
}));
// The Yopass branch is gated behind config.USE_YOPASS, which defaults to false
// in the test environment.
jest.mock('config', () => ({ USE_YOPASS: true }));

describe('AdminApiControllerV1 - exportClaimset', () => {
  let controller: AdminApiControllerV1;
  let mockSbService: { getClaimsetRaw: jest.Mock };

  const mockEdfiTenant = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  } as unknown as EdfiTenant;

  const mockResImpl = {
    setHeader: jest.fn(),
    send: jest.fn(),
  };
  const mockRes = mockResImpl as unknown as Response;

  beforeEach(() => {
    mockSbService = {
      getClaimsetRaw: jest.fn().mockResolvedValue({
        name: 'Test Claimset',
        resourceClaims: {},
      }),
    };
    controller = new AdminApiControllerV1(
      mockSbService as unknown as AdminApiServiceV1,
      null as unknown as Repository<Edorg>,
      null as unknown as Repository<EdfiTenant>
    );
    mockResImpl.setHeader.mockClear();
    mockResImpl.send.mockClear();
  });

  it('exports claimsets when validIds is true (superuser access)', async () => {
    const validIds: Ids = true;
    await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds, mockRes);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledTimes(2);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledWith(mockEdfiTenant, 1);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledWith(mockEdfiTenant, 2);
    expect(mockRes.send).toHaveBeenCalled();
  });

  it('exports claimsets when all requested IDs are in the authorized set', async () => {
    const validIds: Ids = new Set([1, 2]);
    await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds, mockRes);
    expect(mockSbService.getClaimsetRaw).toHaveBeenCalledTimes(2);
    expect(mockRes.send).toHaveBeenCalled();
  });

  it('throws ForbiddenException when one requested ID is outside the authorized set', async () => {
    const validIds: Ids = new Set([1]);
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds, mockRes)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 2'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the authorized set is empty', async () => {
    const validIds: Ids = new Set<number>();
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1'], validIds, mockRes)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 1'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for an empty-string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, [''], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: '));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a non-integer string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['abc'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when no id is provided (undefined)', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, undefined, validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('At least one claimset ID must be provided'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a zero ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['0'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 0'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a negative ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['-1'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: -1'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a decimal ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1.5'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 1.5'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when one ID in a mixed array is invalid', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', 'abc', '3'], validIds, mockRes)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.getClaimsetRaw).not.toHaveBeenCalled();
  });
});

describe('AdminApiControllerV1 - resetApplicationCredentials', () => {
  let controller: AdminApiControllerV1;
  let mockSbService: { getApplication: jest.Mock; resetApplicationCredentials: jest.Mock };

  const mockEdfiTenant = { id: 1 } as unknown as EdfiTenant;

  const mockSbEnvironment = {
    domain: 'https://example.edfi.org',
    startingBlocks: false,
  } as unknown as SbEnvironment;

  const mockApplication = {
    id: 5,
    applicationName: 'Test Application',
    _educationOrganizationIds: [1],
  };

  beforeEach(() => {
    (postYopassSecret as jest.Mock).mockClear();
    mockSbService = {
      getApplication: jest.fn().mockResolvedValue(mockApplication),
      resetApplicationCredentials: jest.fn().mockResolvedValue({
        applicationId: 5,
        key: 'new-key',
        secret: 'new-secret',
      }),
    };
    controller = new AdminApiControllerV1(
      mockSbService as unknown as AdminApiServiceV1,
      null as unknown as Repository<Edorg>,
      null as unknown as Repository<EdfiTenant>
    );
  });

  it('returns a response with secretSharingMethod "Yopass" via the Yopass sharing path', async () => {
    (postYopassSecret as jest.Mock).mockResolvedValue({ link: 'https://yopass.example/secret' });
    const validIds: Ids = true;

    const result = await controller.resetApplicationCredentials(
      1,
      1,
      mockEdfiTenant,
      mockSbEnvironment,
      5,
      validIds
    );

    expect(mockSbService.resetApplicationCredentials).toHaveBeenCalledWith(mockEdfiTenant, 5);
    expect(postYopassSecret).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: 5,
        key: 'new-key',
        secret: 'new-secret',
        secretSharingMethod: SecretSharingMethod.Yopass,
      })
    );
    expect(result).toMatchObject({ secretSharingMethod: SecretSharingMethod.Yopass });
  });
});
