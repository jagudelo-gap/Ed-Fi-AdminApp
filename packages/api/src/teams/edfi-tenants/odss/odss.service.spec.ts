import 'reflect-metadata';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EdfiTenant, Edorg, Ods, SbEnvironment } from '@edanalytics/models-server';
import { EducationOrganizationDto, PostOdsDto } from '@edanalytics/models';
import { Repository } from 'typeorm';
import { OdssService } from './odss.service';
import { StartingBlocksServiceV2 } from '../starting-blocks';
import { AdminApiServiceV2 } from '../starting-blocks';
import { OdsRowCountService } from '../starting-blocks/v2/ods-rowcount.service';
import * as syncOdsModule from '../../../sb-sync/sync-ods';

jest.mock('../../../sb-sync/sync-ods', () => ({
  ...jest.requireActual('../../../sb-sync/sync-ods'),
  persistSyncOds: jest.fn(),
}));

const mockOdssRepository = () => ({
  findOneBy: jest.fn(),
  findBy: jest.fn(),
  save: jest.fn(),
  manager: {
    transaction: jest.fn(),
  },
});

const mockEdorgsRepository = () => ({
  findBy: jest.fn(),
  save: jest.fn(),
});

describe('OdssService', () => {
  let service: OdssService;
  let odssRepository: ReturnType<typeof mockOdssRepository>;
  let edorgsRepository: ReturnType<typeof mockEdorgsRepository>;
  let adminApiServiceV2: Partial<AdminApiServiceV2>;
  let startingBlocksServiceV2: Partial<StartingBlocksServiceV2>;

  const mockSbEnvironment: Partial<SbEnvironment> = { id: 1, version: 'v2' };
  const mockEdfiTenant: Partial<EdfiTenant> = { id: 10, sbEnvironmentId: 1, name: 'test-tenant' };

  const mockOds: Partial<Ods> = {
    id: 5,
    odsInstanceId: 42,
    odsInstanceName: 'test-ods',
    dbName: 'test_db',
    edfiTenantId: 10,
  };

  const mockEdOrgs: EducationOrganizationDto[] = [
    {
      instanceId: 42,
      instanceName: 'test-ods',
      educationOrganizationId: 31,
      nameOfInstitution: 'Grand Bend State',
      shortNameOfInstitution: null,
      discriminator: 'edfi.StateEducationAgency',
      parentId: undefined,
    },
    {
      instanceId: 42,
      instanceName: 'test-ods',
      educationOrganizationId: 255901,
      nameOfInstitution: 'Grand Bend ISD',
      shortNameOfInstitution: 'GBISD',
      discriminator: 'edfi.LocalEducationAgency',
      parentId: 31,
    },
  ];

  beforeEach(() => {
    odssRepository = mockOdssRepository();
    edorgsRepository = mockEdorgsRepository();
    adminApiServiceV2 = {
      getEdOrgsForOdsInstance: jest.fn(),
    };
    startingBlocksServiceV2 = {
      odsRowCountService: { rowCount: jest.fn() } as unknown as OdsRowCountService,
    };

    service = new OdssService(
      odssRepository as unknown as Repository<Ods>,
      edorgsRepository as unknown as Repository<Edorg>,
      startingBlocksServiceV2 as StartingBlocksServiceV2,
      adminApiServiceV2 as AdminApiServiceV2
    );

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('uses dto.templateName in odss create flow', async () => {
      const dto = {
        name: 'ODS One',
        templateName: 'TemplateNameValue',
        databaseTemplate: 'DatabaseTemplateValue',
      } as PostOdsDto;
      const sbEnvironment = {
        ...mockSbEnvironment,
        startingBlocks: false,
      } as SbEnvironment;
      const createdOds = { id: 1, odsInstanceName: 'ODS One' };

      startingBlocksServiceV2.createOds = jest
        .fn()
        .mockResolvedValue({ status: 'SUCCESS' });
      odssRepository.findOneBy.mockResolvedValue(createdOds);

      await service.create(sbEnvironment, mockEdfiTenant as EdfiTenant, dto);

      expect(startingBlocksServiceV2.createOds).toHaveBeenCalledWith(
        sbEnvironment,
        mockEdfiTenant,
        'ODS One',
        'TemplateNameValue'
      );
    });
  });
  
  describe('syncEdOrgs', () => {
    it('should throw NotFoundException for non-v2 environment', async () => {
      const v1Environment: Partial<SbEnvironment> = { id: 1, version: 'v1' };

      await expect(
        service.syncEdOrgs(
          v1Environment as SbEnvironment,
          mockEdfiTenant as EdfiTenant,
          mockOds.id
        )
      ).rejects.toThrow(NotFoundException);

      expect(odssRepository.findOneBy).not.toHaveBeenCalled();
      expect(adminApiServiceV2.getEdOrgsForOdsInstance).not.toHaveBeenCalled();
    });

    it('should load ODS, call Admin API, and persist Ed-Orgs', async () => {
      odssRepository.findOneBy.mockResolvedValue(mockOds);
      (adminApiServiceV2.getEdOrgsForOdsInstance as jest.Mock).mockResolvedValue(mockEdOrgs);

      const mockEm = {};
      odssRepository.manager.transaction.mockImplementation(async (cb: (em: unknown) => Promise<void>) => cb(mockEm));
      (syncOdsModule.persistSyncOds as jest.Mock).mockResolvedValue({ status: 'SUCCESS', data: {} });

      await service.syncEdOrgs(
        mockSbEnvironment as SbEnvironment,
        mockEdfiTenant as EdfiTenant,
        mockOds.id
      );

      expect(odssRepository.findOneBy).toHaveBeenCalledWith({ id: mockOds.id });
      expect(adminApiServiceV2.getEdOrgsForOdsInstance).toHaveBeenCalledWith(
        mockEdfiTenant,
        mockOds.odsInstanceId
      );
      expect(odssRepository.manager.transaction).toHaveBeenCalled();
      expect(syncOdsModule.persistSyncOds).toHaveBeenCalledWith({
        em: mockEm,
        edfiTenant: mockEdfiTenant,
        ods: expect.objectContaining({
          id: mockOds.odsInstanceId,
          name: mockOds.odsInstanceName,
          dbName: mockOds.dbName,
          edorgs: expect.arrayContaining([
            expect.objectContaining({
              educationorganizationid: 31,
              nameofinstitution: 'Grand Bend State',
              edorgs: expect.arrayContaining([
                expect.objectContaining({
                  educationorganizationid: 255901,
                  nameofinstitution: 'Grand Bend ISD',
                }),
              ]),
            }),
          ]),
        }),
      });
    });

    it('should throw NotFoundException when ODS is not found', async () => {
      odssRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.syncEdOrgs(
          mockSbEnvironment as SbEnvironment,
          mockEdfiTenant as EdfiTenant,
          999
        )
      ).rejects.toThrow(NotFoundException);

      expect(adminApiServiceV2.getEdOrgsForOdsInstance).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when odsInstanceId is null', async () => {
      const odsWithoutInstanceId: Partial<Ods> = { ...mockOds, odsInstanceId: null };
      odssRepository.findOneBy.mockResolvedValue(odsWithoutInstanceId);

      await expect(
        service.syncEdOrgs(
          mockSbEnvironment as SbEnvironment,
          mockEdfiTenant as EdfiTenant,
          mockOds.id
        )
      ).rejects.toThrow(BadRequestException);

      expect(adminApiServiceV2.getEdOrgsForOdsInstance).not.toHaveBeenCalled();
    });

    it('should pass null shortNameOfInstitution through without coercing to empty string', async () => {
      const edOrgsWithNullShortName: EducationOrganizationDto[] = [
        {
          instanceId: 42,
          instanceName: 'test-ods',
          educationOrganizationId: 255901,
          nameOfInstitution: 'Grand Bend ISD',
          shortNameOfInstitution: null,
          discriminator: 'edfi.LocalEducationAgency',
        },
      ];
      odssRepository.findOneBy.mockResolvedValue(mockOds);
      (adminApiServiceV2.getEdOrgsForOdsInstance as jest.Mock).mockResolvedValue(edOrgsWithNullShortName);
      const mockEm = {};
      odssRepository.manager.transaction.mockImplementation(async (cb: (em: unknown) => Promise<void>) => cb(mockEm));
      (syncOdsModule.persistSyncOds as jest.Mock).mockResolvedValue({ status: 'SUCCESS', data: {} });

      await service.syncEdOrgs(
        mockSbEnvironment as SbEnvironment,
        mockEdfiTenant as EdfiTenant,
        mockOds.id
      );

      expect(syncOdsModule.persistSyncOds).toHaveBeenCalledWith(
        expect.objectContaining({
          ods: expect.objectContaining({
            edorgs: expect.arrayContaining([
              expect.objectContaining({ shortnameofinstitution: null }),
            ]),
          }),
        })
      );
    });

    it('should propagate error when Admin API call fails', async () => {
      odssRepository.findOneBy.mockResolvedValue(mockOds);
      const apiError = new Error('Admin API unavailable');
      (adminApiServiceV2.getEdOrgsForOdsInstance as jest.Mock).mockRejectedValue(apiError);

      await expect(
        service.syncEdOrgs(
          mockSbEnvironment as SbEnvironment,
          mockEdfiTenant as EdfiTenant,
          mockOds.id
        )
      ).rejects.toThrow(apiError);

      expect(odssRepository.manager.transaction).not.toHaveBeenCalled();
    });
  });
});
