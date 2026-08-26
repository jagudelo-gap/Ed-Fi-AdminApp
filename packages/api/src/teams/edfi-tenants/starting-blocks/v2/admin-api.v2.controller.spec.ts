import 'reflect-metadata';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Edorg, EdfiTenant, Ods } from '@edanalytics/models-server';
import { Ids, PostInstanceDtoV2, PostProfileDtoV2 } from '@edanalytics/models';
import { Repository } from 'typeorm';
import { AdminApiControllerV2 } from './admin-api.v2.controller';
import { AdminApiServiceV2 } from './admin-api.v2.service';
import { CustomHttpException, ValidationHttpException } from '../../../../utils';
import { ENV_SYNC_CHNL } from '../../../../sb-sync/sb-sync.module';
import { IntegrationAppsTeamService } from '../../../../integration-apps-team/integration-apps-team.service';
import { IJobQueueService } from '../../../../sb-sync/job-queue/job-queue.interface';

describe('AdminApiControllerV2 - exportClaimset', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { exportClaimset: jest.Mock };

  const mockEdfiTenant = {
    id: 1,
    sbEnvironmentId: 2,
    sbEnvironment: { envLabel: 'Test Env' },
  } as unknown as EdfiTenant;

  beforeEach(() => {
    mockSbService = {
      exportClaimset: jest.fn().mockResolvedValue({
        name: 'Test Claimset',
        resourceClaims: [],
      }),
    };
    controller = new AdminApiControllerV2(
      null as unknown as IntegrationAppsTeamService,
      mockSbService as unknown as AdminApiServiceV2,
      null as unknown as Repository<Edorg>,
      null as unknown as Repository<Ods>,
      null as unknown as IJobQueueService
    );
  });

  it('exports claimsets when validIds is true (superuser access)', async () => {
    const validIds: Ids = true;
    const result = await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds);
    expect(mockSbService.exportClaimset).toHaveBeenCalledTimes(2);
    expect(mockSbService.exportClaimset).toHaveBeenCalledWith(mockEdfiTenant, 1);
    expect(mockSbService.exportClaimset).toHaveBeenCalledWith(mockEdfiTenant, 2);
    expect(result).toBeDefined();
  });

  it('exports claimsets when all requested IDs are in the authorized set', async () => {
    const validIds: Ids = new Set([1, 2]);
    const result = await controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds);
    expect(mockSbService.exportClaimset).toHaveBeenCalledTimes(2);
    expect(result).toBeDefined();
  });

  it('throws ForbiddenException when one requested ID is outside the authorized set', async () => {
    const validIds: Ids = new Set([1]);
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', '2'], validIds)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 2'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws ForbiddenException when the authorized set is empty', async () => {
    const validIds: Ids = new Set<number>();
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1'], validIds)
    ).rejects.toThrow(new ForbiddenException('Access denied to claimset ID: 1'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for an empty-string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, [''], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: '));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a non-integer string ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['abc'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when no id is provided (undefined)', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, undefined, validIds)
    ).rejects.toThrow(new BadRequestException('At least one claimset ID must be provided'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a zero ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['0'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 0'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a negative ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['-1'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: -1'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException for a decimal ID', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1.5'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: 1.5'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when one ID in a mixed array is invalid', async () => {
    const validIds: Ids = true;
    await expect(
      controller.exportClaimset(1, 1, mockEdfiTenant, ['1', 'abc', '3'], validIds)
    ).rejects.toThrow(new BadRequestException('Invalid claimset ID: abc'));
    expect(mockSbService.exportClaimset).not.toHaveBeenCalled();
  });
});

describe('AdminApiControllerV2 - postProfile', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { postProfile: jest.Mock };

  const mockEdfiTenant = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  } as unknown as EdfiTenant;

  const mockProfile: PostProfileDtoV2 = {
    name: 'Test Profile',
    definition: '<Profile />',
  };

  const makeAxiosError = (data: unknown) => ({
    isAxiosError: true,
    message: 'Request failed with status code 400',
    response: { status: 400, data },
  });

  beforeEach(() => {
    mockSbService = {
      postProfile: jest.fn(),
    };
    controller = new AdminApiControllerV2(
      null as unknown as IntegrationAppsTeamService,
      mockSbService as unknown as AdminApiServiceV2,
      null as unknown as Repository<Edorg>,
      null as unknown as Repository<Ods>,
      null as unknown as IJobQueueService
    );
  });

  it('throws ValidationHttpException for a duplicate profile name', async () => {
    mockSbService.postProfile.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Name: ['this name already exists'] },
      })
    );

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new ValidationHttpException({
        field: 'name',
        message: 'A profile with this name already exists. Please choose a different name.',
      })
    );
  });

  it('throws ValidationHttpException for an invalid XML definition', async () => {
    const definitionError = 'List of possible elements expected: Foo.';
    mockSbService.postProfile.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Definition: [definitionError] },
      })
    );

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new ValidationHttpException({
        field: 'definition',
        message: `Invalid XML format for definition: ${definitionError}`,
      })
    );
  });

  it('throws CustomHttpException for a generic validation error', async () => {
    const errorData = {
      title: 'Validation failed',
      status: 400,
      errors: { Other: ['something else went wrong'] },
    };
    mockSbService.postProfile.mockRejectedValue(makeAxiosError(errorData));

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      new CustomHttpException(
        {
          title: 'Validation error',
          type: 'Error',
          data: errorData,
        },
        400
      )
    );
  });

  it('rethrows the original error when it is not an axios validation error', async () => {
    const otherError = new Error('boom');
    mockSbService.postProfile.mockRejectedValue(otherError);

    await expect(controller.postProfile(1, 1, mockEdfiTenant, mockProfile)).rejects.toThrow(
      otherError
    );
  });
});

describe('AdminApiControllerV2 - postInstance', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { postInstance: jest.Mock };
  let mockOdsRepository: { save: jest.Mock };
  let mockJobQueue: { send: jest.Mock };

  const mockEdfiTenant = {
    id: 1,
    sbEnvironment: { envLabel: 'Test Env' },
  } as unknown as EdfiTenant;

  const mockInstance: PostInstanceDtoV2 = {
    name: 'My DB Instance',
    databaseTemplate: 'Minimal',
  };

  const makeAxiosError = (data: unknown) => ({
    isAxiosError: true,
    message: 'Request failed with status code 400',
    response: { status: 400, data },
  });

  beforeEach(() => {
    mockSbService = {
      postInstance: jest.fn(),
    };
    mockOdsRepository = {
      save: jest.fn(),
    };
    mockJobQueue = {
      send: jest.fn(),
    };
    controller = new AdminApiControllerV2(
      null as unknown as IntegrationAppsTeamService,
      mockSbService as unknown as AdminApiServiceV2,
      null as unknown as Repository<Edorg>,
      mockOdsRepository as unknown as Repository<Ods>,
      mockJobQueue as unknown as IJobQueueService
    );
  });

  it('creates local ODS row and enqueues sync after instance creation', async () => {
    mockSbService.postInstance.mockResolvedValue({ id: 55 });
    mockOdsRepository.save.mockResolvedValue({ id: 901 });
    mockJobQueue.send.mockResolvedValue('job-123');

    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).resolves.toEqual({
      id: 901,
    });
    expect(mockSbService.postInstance).toHaveBeenCalledWith(mockEdfiTenant, mockInstance);
    expect(mockOdsRepository.save).toHaveBeenCalledWith({
      edfiTenantId: mockEdfiTenant.id,
      sbEnvironmentId: mockEdfiTenant.sbEnvironmentId,
      odsInstanceId: 55,
      dbName: mockInstance.name,
      odsInstanceName: mockInstance.name,
      instanceType: mockInstance.databaseTemplate,
      databaseTemplate: mockInstance.databaseTemplate,
      status: 'PendingCreate',
    });
    expect(mockJobQueue.send).toHaveBeenCalledWith(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: mockEdfiTenant.sbEnvironmentId },
      { expireInHours: 2 }
    );
  });

  it('throws ValidationHttpException for name validation errors', async () => {
    mockSbService.postInstance.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { Name: ['name is required'] },
      })
    );

    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(
      new ValidationHttpException({
        field: 'name',
        message: 'name is required',
      })
    );
  });

  it('throws ValidationHttpException for databaseTemplate validation errors', async () => {
    mockSbService.postInstance.mockRejectedValue(
      makeAxiosError({
        title: 'Validation failed',
        status: 400,
        errors: { DatabaseTemplate: ['database template is required'] },
      })
    );

    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(
      new ValidationHttpException({
        field: 'databaseTemplate',
        message: 'database template is required',
      })
    );
  });

  it('throws CustomHttpException for other validation errors', async () => {
    const errorData = {
      title: 'Validation failed',
      status: 400,
      errors: { Other: ['something else went wrong'] },
    };
    mockSbService.postInstance.mockRejectedValue(makeAxiosError(errorData));

    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(
      new CustomHttpException(
        {
          title: 'Validation error',
          type: 'Error',
          data: errorData,
        },
        400
      )
    );
  });

  it('rethrows non-validation errors', async () => {
    const otherError = new Error('boom');
    mockSbService.postInstance.mockRejectedValue(otherError);

    await expect(controller.postInstance(1, 1, mockEdfiTenant, mockInstance)).rejects.toThrow(
      otherError
    );
  });
});

describe('AdminApiControllerV2 - deleteInstance', () => {
  let controller: AdminApiControllerV2;
  let mockSbService: { deleteInstance: jest.Mock };
  let mockOdsRepository: { findOneBy: jest.Mock; save: jest.Mock };
  let mockJobQueue: { send: jest.Mock };

  const mockEdfiTenant = {
    id: 1,
    sbEnvironmentId: 2,
    sbEnvironment: { envLabel: 'Test Env' },
  } as unknown as EdfiTenant;

  beforeEach(() => {
    mockSbService = {
      deleteInstance: jest.fn().mockResolvedValue(undefined),
    };
    mockOdsRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 901,
        instanceManageId: 55,
        status: 'Created',
      }),
      save: jest.fn().mockResolvedValue({
        id: 901,
        instanceManageId: 55,
        status: 'PendingDelete',
      }),
    };
    mockJobQueue = {
      send: jest.fn().mockResolvedValue('job-123'),
    };
    controller = new AdminApiControllerV2(
      null as unknown as IntegrationAppsTeamService,
      mockSbService as unknown as AdminApiServiceV2,
      null as unknown as Repository<Edorg>,
      mockOdsRepository as unknown as Repository<Ods>,
      mockJobQueue as unknown as IJobQueueService
    );
  });

  it('finds local ODS, calls sbService delete, sets PendingDelete, and enqueues sync', async () => {
    const instanceManageId = 55;

    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, instanceManageId)).resolves.toBeUndefined();

    expect(mockOdsRepository.findOneBy).toHaveBeenCalledWith({
      edfiTenantId: mockEdfiTenant.id,
      instanceManageId,
    });
    expect(mockSbService.deleteInstance).toHaveBeenCalledWith(mockEdfiTenant, instanceManageId);
    expect(mockOdsRepository.save).toHaveBeenCalledWith({
      id: 901,
      instanceManageId: 55,
      status: 'PendingDelete',
    });
    expect(mockJobQueue.send).toHaveBeenCalledWith(
      ENV_SYNC_CHNL,
      { sbEnvironmentId: mockEdfiTenant.sbEnvironmentId },
      { expireInHours: 2 }
    );
    expect(mockSbService.deleteInstance.mock.invocationCallOrder[0]).toBeLessThan(
      mockOdsRepository.save.mock.invocationCallOrder[0]
    );
    expect(mockOdsRepository.save.mock.invocationCallOrder[0]).toBeLessThan(
      mockJobQueue.send.mock.invocationCallOrder[0]
    );
  });

  it("throws BadRequestException when the local ODS is not in 'Created' status", async () => {
    const instanceManageId = 55;
    mockOdsRepository.findOneBy.mockResolvedValue({
      id: 901,
      instanceManageId,
      status: 'PendingDelete',
    });

    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, instanceManageId)).rejects.toThrow(
      new BadRequestException("ODS must be in 'Created' status to delete by instanceManageId")
    );

    expect(mockSbService.deleteInstance).not.toHaveBeenCalled();
    expect(mockOdsRepository.save).not.toHaveBeenCalled();
    expect(mockJobQueue.send).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when instanceManageId is less than or equal to zero', async () => {
    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, 0)).rejects.toThrow(
      new BadRequestException('instanceManageId must be greater than zero')
    );
    expect(mockOdsRepository.findOneBy).not.toHaveBeenCalled();
    expect(mockOdsRepository.save).not.toHaveBeenCalled();
    expect(mockSbService.deleteInstance).not.toHaveBeenCalled();
    expect(mockJobQueue.send).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when local ODS is not found', async () => {
    const instanceManageId = 55;
    mockOdsRepository.findOneBy.mockResolvedValue(null);

    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, instanceManageId)).rejects.toThrow(
      new NotFoundException('ODS not found for instanceManageId')
    );
    expect(mockOdsRepository.findOneBy).toHaveBeenCalledWith({
      edfiTenantId: mockEdfiTenant.id,
      instanceManageId,
    });
    expect(mockOdsRepository.save).not.toHaveBeenCalled();
    expect(mockSbService.deleteInstance).not.toHaveBeenCalled();
    expect(mockJobQueue.send).not.toHaveBeenCalled();
  });

  it('does not set PendingDelete or enqueue sync when sbService delete fails', async () => {
    const instanceManageId = 55;
    const deleteError = new Error('delete failed');
    mockSbService.deleteInstance.mockRejectedValue(deleteError);
    mockOdsRepository.findOneBy.mockResolvedValue({
      id: 901,
      instanceManageId,
      status: 'Created',
    });

    await expect(controller.deleteInstance(1, 1, mockEdfiTenant, instanceManageId)).rejects.toThrow(
      deleteError
    );
    expect(mockSbService.deleteInstance).toHaveBeenCalledWith(mockEdfiTenant, instanceManageId);
    expect(mockOdsRepository.save).not.toHaveBeenCalled();
    expect(mockJobQueue.send).not.toHaveBeenCalled();
  });
});
