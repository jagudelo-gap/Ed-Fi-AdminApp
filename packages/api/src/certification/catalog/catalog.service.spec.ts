import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource, Repository } from 'typeorm';
import {
  AreaCatalog,
  CatalogVersion,
  ScenarioCatalog,
  StepCatalog,
  StepParameterCatalog,
} from '@edanalytics/models-server';
import { CatalogService } from './catalog.service';

type ParsedParamLike = { name: string; type: string; description: string | null };
type ParsedStepLike = {
  stepName: string;
  displayName: string | null;
  seq: number;
  stepType: string;
  params: ParsedParamLike[];
};
type ParsedScenarioLike = {
  name: string;
  displayName: string | null;
  displayOrder: number;
  steps: ParsedStepLike[];
};
type ParsedAreaLike = {
  name: string;
  displayName: string | null;
  displayOrder: number;
  scenarios: ParsedScenarioLike[];
};
type BruMetaLike = { name: string | null; seq: number | null };

// Mirrors the private surface of CatalogService that these tests exercise
// directly. Kept structurally compatible so we can access private members
// without resorting to `any`.
type CatalogServiceInternal = {
  syncVersion(
    artifactVersion: string,
    dataStandardVersion: string,
    versionRoot: string
  ): Promise<void>;
  parseAreas(versionRoot: string): ParsedAreaLike[];
  parseMeta(folderBruPath: string): BruMetaLike;
  parseStepTypeMap(folderBruPath: string): Record<number, string> | null;
  extractInputParams(bruContent: string): ParsedParamLike[];
  extractContextParams(bruContent: string): ParsedParamLike[];
  extractReferenceParam(bruContent: string, stepType: string): ParsedParamLike[];
  inferStepType(fileName: string): string;
};

const asInternal = (svc: CatalogService): CatalogServiceInternal =>
  svc as unknown as CatalogServiceInternal;

jest.mock('@edanalytics/models-server', () => {
  class AreaCatalog {}
  class CatalogVersion {}
  class ScenarioCatalog {}
  class StepCatalog {}
  class StepParameterCatalog {}

  return {
    AreaCatalog,
    CatalogVersion,
    ScenarioCatalog,
    StepCatalog,
    StepParameterCatalog,
  };
});

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn(),
  readdirSync: jest.fn(),
  readFileSync: jest.fn(),
}));

type MockDirent = {
  name: string;
  isDirectory: () => boolean;
};

const dirent = (name: string, isDirectory = true): MockDirent => ({
  name,
  isDirectory: () => isDirectory,
});

describe('CatalogService', () => {
  const mockedFs = fs as jest.Mocked<typeof fs>;

  const catalogVersionRepo = {
    findOne: jest.fn(),
  };

  const qb = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };

  const manager = {
    createQueryBuilder: jest.fn().mockReturnValue(qb),
    create: jest.fn(),
    save: jest.fn(),
  };

  const dataSource = {
    transaction: jest.fn(),
  };

  let service: CatalogService;

  beforeEach(() => {
    jest.clearAllMocks();

    manager.create.mockImplementation((entity: unknown, payload: Record<string, unknown>) => {
      if (entity === CatalogVersion) return { catalogVersionId: 1, ...payload };
      if (entity === AreaCatalog) return { areaId: 10, ...payload };
      if (entity === ScenarioCatalog) return { scenarioId: 20, ...payload };
      if (entity === StepCatalog) return { stepId: 30, ...payload };
      if (entity === StepParameterCatalog) return { parameterId: 40, ...payload };
      return payload;
    });

    manager.save.mockImplementation(async (entityOrObject: unknown, maybeObject?: unknown) => {
      return maybeObject ?? entityOrObject;
    });

    dataSource.transaction.mockImplementation(async (cb: (m: typeof manager) => Promise<void>) => {
      await cb(manager);
    });

    service = new CatalogService(
      catalogVersionRepo as unknown as Repository<CatalogVersion>,
      dataSource as unknown as DataSource
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sync should skip when artifact version is missing', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    await service.sync(undefined, '/fake-root');

    expect(warnSpy).toHaveBeenCalledWith('Artifact version not set; skipping catalog sync');
  });

  it('sync should skip when sis root does not exist', async () => {
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    mockedFs.existsSync.mockReturnValue(false);

    await service.sync('v2.1.0', '/missing-root');

    expect(warnSpy).toHaveBeenCalledWith('SIS root not found: /missing-root; skipping catalog sync');
  });

  it('sync should process only version directories sorted', async () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readdirSync.mockReturnValue([
      dirent('v10'),
      dirent('notes', false),
      dirent('v2'),
      dirent('scratch'),
      dirent('v1'),
      dirent('x'),
    ] as unknown as ReturnType<typeof fs.readdirSync>);

    const syncVersionSpy = jest
      .spyOn(asInternal(service), 'syncVersion')
      .mockResolvedValue(undefined);

    await service.sync('v2.1.0', '/sis');

    expect(syncVersionSpy).toHaveBeenCalledTimes(3);
    expect(syncVersionSpy).toHaveBeenNthCalledWith(1, 'v2.1.0', 'v1', path.join('/sis', 'v1'));
    expect(syncVersionSpy).toHaveBeenNthCalledWith(
      2,
      'v2.1.0',
      'v10',
      path.join('/sis', 'v10')
    );
    expect(syncVersionSpy).toHaveBeenNthCalledWith(3, 'v2.1.0', 'v2', path.join('/sis', 'v2'));
  });

  it('syncVersion should skip if version already exists', async () => {
    catalogVersionRepo.findOne.mockResolvedValue({ catalogVersionId: 99 });
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();

    await asInternal(service).syncVersion('v2.1.0', 'v4', '/root/v4');

    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith('Catalog already synced for v2.1.0/v4, skipping');
  });

  it('syncVersion should deactivate active version with portable boolean parameter and persist catalog hierarchy', async () => {
    catalogVersionRepo.findOne.mockResolvedValue(null);
    jest.spyOn(asInternal(service), 'parseAreas').mockReturnValue([
      {
        name: 'area-a',
        displayName: 'Area A',
        displayOrder: 1,
        scenarios: [
          {
            name: 'scenario-a',
            displayName: 'Scenario A',
            displayOrder: 1,
            steps: [
              {
                stepName: 'Create record',
                displayName: 'Create record',
                seq: 1,
                stepType: 'CREATE',
                params: [{ name: 'nameOfInstitution', type: 'input', description: 'Name' }],
              },
            ],
          },
        ],
      },
    ]);

    await asInternal(service).syncVersion('v2.1.0', 'v4', '/root/v4');

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(qb.update).toHaveBeenCalledWith(CatalogVersion);
    expect(qb.set).toHaveBeenCalledWith({ isActive: false });
    expect(qb.where).toHaveBeenCalledWith(
      'dataStandardVersion = :dsv AND isActive = :isActive',
      { dsv: 'v4', isActive: true }
    );
    expect(qb.execute).toHaveBeenCalledTimes(1);

    // CatalogVersion, AreaCatalog, ScenarioCatalog, StepCatalog, StepParameterCatalog
    expect(manager.save).toHaveBeenCalledTimes(5);
    expect(manager.create).toHaveBeenCalledWith(
      CatalogVersion,
      expect.objectContaining({ artifactVersion: 'v2.1.0', dataStandardVersion: 'v4', isActive: true })
    );
  });

  it('parseMeta should return null values when folder.bru does not exist', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = asInternal(service).parseMeta('/missing/folder.bru');

    expect(result).toEqual({ name: null, seq: null });
  });

  it('parseStepTypeMap should parse docs list by sequence', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(
      [
        'meta {',
        '  name: Demo',
        '}',
        'docs {',
        '  1. __CREATE__',
        '  2. __UPDATE__',
        '  3. __DELETE__',
        '}',
      ].join('\n')
    );

    const map = asInternal(service).parseStepTypeMap('/scenario/folder.bru');

    expect(map).toEqual({ 1: 'CREATE', 2: 'UPDATE', 3: 'DELETE' });
  });

  it('extractInputParams should return only ENTER parameters', () => {
    const bru = [
      'params:query {',
      '  localEducationAgencyId: [ENTER LEA ID]',
      '  schoolId: {{school_id}}',
      '  schoolYear: [ENTER school year]',
      '  # comment',
      '}',
    ].join('\n');

    const result = asInternal(service).extractInputParams(bru);

    expect(result).toEqual([
      { name: 'localEducationAgencyId', type: 'input', description: 'LEA ID' },
      { name: 'schoolYear', type: 'input', description: 'school year' },
    ]);
  });

  it('extractContextParams should return context parameters with descriptions', () => {
    const bru = [
      'params:query {',
      '  schoolId: {{school_id}}',
      '  localEducationAgencyId: [ENTER LEA ID]',
      '  sessionId: {{session_id}}',
      '}',
    ].join('\n');

    const result = asInternal(service).extractContextParams(bru);

    expect(result).toEqual([
      {
        name: 'schoolId',
        type: 'context',
        description: 'Resolved from Bruno context variable: school_id',
      },
      {
        name: 'sessionId',
        type: 'context',
        description: 'Resolved from Bruno context variable: session_id',
      },
    ]);
  });

  it('extractReferenceParam should return URL trailing id var for UPDATE/DELETE only', () => {
    const bru = 'url: {{baseUrl}}/schools/{{school_id}}?limit=1';

    const updateResult = asInternal(service).extractReferenceParam(bru, 'UPDATE');
    const deleteResult = asInternal(service).extractReferenceParam(bru, 'DELETE');
    const createResult = asInternal(service).extractReferenceParam(bru, 'CREATE');

    expect(updateResult).toEqual([
      {
        name: 'school_id',
        type: 'reference',
        description:
          'Resource identifier captured from the CREATE step and provided automatically by the App',
      },
    ]);
    expect(deleteResult).toHaveLength(1);
    expect(createResult).toEqual([]);
  });

  it('inferStepType should infer delete/update/create from filename', () => {
    expect(asInternal(service).inferStepType('01-delete-school.bru')).toBe('DELETE');
    expect(asInternal(service).inferStepType('02-update-school.bru')).toBe('UPDATE');
    expect(asInternal(service).inferStepType('03-create-school.bru')).toBe('CREATE');
  });
});
