import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import {
  AreaCatalog,
  CatalogVersion,
  ScenarioCatalog,
  StepCatalog,
  StepParameterCatalog,
} from '@edanalytics/models-server';

interface ParsedParam {
  name: string;
  type: string;
  description: string | null;
}

interface ParsedStep {
  stepName: string;
  displayName: string | null;
  seq: number;
  stepType: string;
  params: ParsedParam[];
}

interface ParsedScenario {
  name: string;
  displayName: string | null;
  displayOrder: number;
  steps: ParsedStep[];
}

interface ParsedArea {
  name: string;
  displayName: string | null;
  displayOrder: number;
  scenarios: ParsedScenario[];
}

interface BruMeta {
  name: string | null;
  seq: number | null;
}

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @InjectRepository(CatalogVersion)
    private readonly catalogVersionRepo: Repository<CatalogVersion>,
    private readonly dataSource: DataSource
  ) {}

  /**
   * Scans each versioned subdirectory under `sisRoot` (e.g. v4/, v5/) and syncs
   * catalog tables when no matching row exists for (artifactVersion, dataStandardVersion).
   */
  async sync(artifactVersion: string | undefined, sisRoot: string): Promise<void> {
    if (!artifactVersion) {
      this.logger.warn('Artifact version not set; skipping catalog sync');
      return;
    }

    if (!fs.existsSync(sisRoot)) {
      this.logger.warn(`SIS root not found: ${sisRoot}; skipping catalog sync`);
      return;
    }

    const versionDirs = fs
      .readdirSync(sisRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^v\d+/.test(d.name))
      .map((d) => d.name)
      .sort();

    for (const dataStandardVersion of versionDirs) {
      await this.syncVersion(
        artifactVersion,
        dataStandardVersion,
        path.join(sisRoot, dataStandardVersion)
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private — per-version sync
  // ---------------------------------------------------------------------------

  private async syncVersion(
    artifactVersion: string,
    dataStandardVersion: string,
    versionRoot: string
  ): Promise<void> {
    const existing = await this.catalogVersionRepo.findOne({
      where: { artifactVersion, dataStandardVersion },
    });

    if (existing) {
      this.logger.log(
        `Catalog already synced for ${artifactVersion}/${dataStandardVersion}, skipping`
      );
      return;
    }

    this.logger.log(`Syncing catalog for ${artifactVersion}/${dataStandardVersion}...`);
    const areas = this.parseAreas(versionRoot);

    await this.dataSource.transaction(async (manager) => {
      // Deactivate all currently active versions for this data standard
      await manager
        .createQueryBuilder()
        .update(CatalogVersion)
        .set({ isActive: false })
        .where('dataStandardVersion = :dsv AND isActive = :isActive', {
          dsv: dataStandardVersion,
          isActive: true,
        })
        .execute();

      const catalogVersion = manager.create(CatalogVersion, {
        artifactVersion,
        dataStandardVersion,
        importedAt: new Date(),
        isActive: true,
      });
      await manager.save(CatalogVersion, catalogVersion);

      for (const area of areas) {
        const areaCatalog = manager.create(AreaCatalog, {
          catalogVersionId: catalogVersion.catalogVersionId,
          name: area.name,
          displayName: area.displayName,
          displayOrder: area.displayOrder,
          isEnabled: true,
        });
        await manager.save(AreaCatalog, areaCatalog);

        for (const scenario of area.scenarios) {
          const scenarioCatalog = manager.create(ScenarioCatalog, {
            areaId: areaCatalog.areaId,
            name: scenario.name,
            displayName: scenario.displayName,
            displayOrder: scenario.displayOrder,
            isEnabled: true,
          });
          await manager.save(ScenarioCatalog, scenarioCatalog);

          for (const step of scenario.steps) {
            const stepCatalog = manager.create(StepCatalog, {
              scenarioId: scenarioCatalog.scenarioId,
              stepName: step.stepName,
              displayName: step.displayName,
              stepType: step.stepType,
              displayOrder: step.seq,
              isEnabled: true,
            });
            await manager.save(StepCatalog, stepCatalog);

            for (const param of step.params) {
              await manager.save(
                manager.create(StepParameterCatalog, {
                  stepId: stepCatalog.stepId,
                  type: param.type,
                  name: param.name,
                  description: param.description,
                })
              );
            }
          }
        }
      }
    });

    this.logger.log(
      `Catalog sync complete for ${artifactVersion}/${dataStandardVersion}: ${areas.length} areas`
    );
  }

  // ---------------------------------------------------------------------------
  // Private — Bruno artifact parsing
  // ---------------------------------------------------------------------------

  private parseAreas(versionRoot: string): ParsedArea[] {
    return fs
      .readdirSync(versionRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .map((areaName, areaIdx) => {
        const meta = this.parseMeta(path.join(versionRoot, areaName, 'folder.bru'));
        return {
          name: areaName,
          displayName: meta.name,
          displayOrder: meta.seq ?? areaIdx + 1,
          scenarios: this.parseScenarios(path.join(versionRoot, areaName)),
        };
      });
  }

  private parseScenarios(areaPath: string): ParsedScenario[] {
    return fs
      .readdirSync(areaPath, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
      .map((scenarioName, scenarioIdx) => {
        const scenarioPath = path.join(areaPath, scenarioName);
        const meta = this.parseMeta(path.join(scenarioPath, 'folder.bru'));
        const stepTypeMap = this.parseStepTypeMap(path.join(scenarioPath, 'folder.bru'));
        return {
          name: scenarioName,
          displayName: meta.name,
          displayOrder: meta.seq ?? scenarioIdx + 1,
          steps: this.parseSteps(scenarioPath, stepTypeMap),
        };
      });
  }

  private parseSteps(
    scenarioPath: string,
    stepTypeMap: Record<number, string> | null
  ): ParsedStep[] {
    return fs
      .readdirSync(scenarioPath)
      .filter((f) => f.endsWith('.bru') && f !== 'folder.bru')
      .sort()
      .map((stepFile) => {
        const content = fs.readFileSync(path.join(scenarioPath, stepFile), 'utf8');
        const metaName =
          (content.match(/^meta \{[\s\S]*?name:\s*(.+)/m) || [])[1]?.trim() ??
          path.basename(stepFile, '.bru');
        const seq = parseInt((content.match(/seq:\s*(\d+)/) || [])[1] ?? '0', 10);
        const stepType = stepTypeMap?.[seq] ?? this.inferStepType(stepFile);
        return {
          stepName: metaName,
          displayName: metaName,
          seq,
          stepType,
          params: this.extractParams(content, stepType),
        };
      });
  }

  private parseMeta(folderBruPath: string): BruMeta {
    if (!fs.existsSync(folderBruPath)) return { name: null, seq: null };
    try {
      const content = fs.readFileSync(folderBruPath, 'utf8');
      const nameMatch = content.match(/^meta \{[\s\S]*?\bname:\s*(.+)/m);
      const seqMatch = content.match(/^meta \{[\s\S]*?\bseq:\s*(\d+)/m);
      return {
        name: nameMatch?.[1]?.trim() ?? null,
        seq: seqMatch ? parseInt(seqMatch[1], 10) : null,
      };
    } catch {
      return { name: null, seq: null };
    }
  }

  private parseStepTypeMap(folderBruPath: string): Record<number, string> | null {
    if (!fs.existsSync(folderBruPath)) return null;
    const content = fs.readFileSync(folderBruPath, 'utf8');
    const docsMatch = content.match(/^docs \{([\s\S]*?)\n\}/m);
    if (!docsMatch) return null;
    const map: Record<number, string> = {};
    for (const [, seq, type] of docsMatch[1].matchAll(
      /^\s*(\d+)\.\s*__(CREATE|UPDATE|DELETE)__/gm
    )) {
      map[parseInt(seq, 10)] = type;
    }
    return Object.keys(map).length > 0 ? map : null;
  }

  private inferStepType(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.includes('delete')) return 'DELETE';
    if (lower.includes('update')) return 'UPDATE';
    return 'CREATE';
  }

  private extractParams(bruContent: string, stepType: string): ParsedParam[] {
    return [
      ...this.extractInputParams(bruContent),
      ...this.extractContextParams(bruContent),
      ...this.extractReferenceParam(bruContent, stepType),
    ];
  }

  private extractQueryParamsBlock(bruContent: string): string | null {
    const startMatch = /^params:query\s*\{/m.exec(bruContent);
    if (!startMatch) return null;

    const startBraceIndex = startMatch.index + startMatch[0].lastIndexOf('{');
    let depth = 1;

    for (let i = startBraceIndex + 1; i < bruContent.length; i++) {
      const ch = bruContent[i];
      if (ch === '{') depth++;
      if (ch === '}') depth--;

      if (depth === 0) {
        return bruContent.slice(startBraceIndex + 1, i);
      }
    }

    return null;
  }

  /**
   * `input` params — lines in `params:query` with `[ENTER ...]` values.
   * These are filled in directly by the user.
   */
  private extractInputParams(bruContent: string): ParsedParam[] {
    const paramsBlock = this.extractQueryParamsBlock(bruContent);
    if (!paramsBlock) return [];

    const params: ParsedParam[] = [];
    for (const line of paramsBlock.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const name = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();

      if (/^\[ENTER/i.test(value)) {
        const description =
          value
            .replace(/^\[ENTER[\s_]*/i, '')
            .replace(/]$/, '')
            .trim() || null;
        params.push({ name, type: 'input', description });
      }
    }
    return params;
  }

  /**
   * `context` params — lines in `params:query` with `{{var}}` values.
   * Bruno cannot encode these directly, so a pre-request script resolves them
   * from a prior step result and injects the encoded value.
   */
  private extractContextParams(bruContent: string): ParsedParam[] {
    const paramsBlock = this.extractQueryParamsBlock(bruContent);
    if (!paramsBlock) return [];

    const params: ParsedParam[] = [];
    for (const line of paramsBlock.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) continue;

      const name = trimmed.slice(0, colonIdx).trim();
      const value = trimmed.slice(colonIdx + 1).trim();

      if (/^\{\{/.test(value)) {
        const varName = value.replace(/^\{\{|\}\}$/g, '').trim();
        params.push({
          name,
          type: 'context',
          description: `Resolved from Bruno context variable: ${varName}`,
        });
      }
    }
    return params;
  }

  /**
   * `reference` param — applies only to UPDATE and DELETE steps.
   * The URL always ends with `{{id}}` to target an existing record.
   * That id was captured by the App from the CREATE step and is provided
   * automatically — the user never has to enter it manually.
   *
   * Strategy: split the URL path by "/" and take the last segment.
   * If it matches `{{varName}}`, that variable is the reference param.
   */
  private extractReferenceParam(bruContent: string, stepType: string): ParsedParam[] {
    if (stepType !== 'UPDATE' && stepType !== 'DELETE') return [];

    const urlMatch = bruContent.match(/^\s*url:\s*(.+)/m);
    if (!urlMatch) return [];

    // Strip query string before splitting on "/"
    const urlPath = urlMatch[1].trim().split('?')[0];
    const lastSegment = urlPath.split('/').pop()?.trim() ?? '';

    const varMatch = lastSegment.match(/^\{\{(.+?)\}\}$/);
    if (!varMatch) return [];

    return [
      {
        name: varMatch[1],
        type: 'reference',
        description: `Resource identifier captured from the CREATE step and provided automatically by the App`,
      },
    ];
  }
}
