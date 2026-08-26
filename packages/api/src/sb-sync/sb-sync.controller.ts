import {
  PgBossJobState,
  SbSyncQueueFacetedValuesDto,
  toOperationResultDto,
  toSbSyncQueueDto,
  toSbSyncQueueFacetedValuesDto,
  toSyncQueuePaginatedResults,
} from '@edanalytics/models';
import { SbSyncQueue } from '@edanalytics/models-server';
import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Injectable,
  Param,
  ParseArrayPipe,
  ParseIntPipe,
  PipeTransform,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { Between, FindOptionsWhere, LessThan, MoreThan, Repository } from 'typeorm';
import { Authorize } from '../auth/authorization';
import { SYNC_SCHEDULER_CHNL } from './sb-sync.module';
import { IJobQueueService, Job } from './job-queue/job-queue.interface';

const sortCols = ['type', 'name', 'dataText', 'state', 'hasChanges', 'createdon', 'completedon'];

type PossibleFilterValue =
  | {
      id: 'type';
      value: 'SbEnvironment' | 'EdfiTenant';
    }
  | {
      id: 'dataText';
      value: string;
    }
  | {
      id: 'sbEnvironmentId';
      value: number;
    }
  | {
      id: 'edfiTenantId';
      value: number;
    }
  | {
      id: 'state';
      value: PgBossJobState;
    }
  | {
      id: 'hasChanges';
      value: boolean | null | undefined;
    }
  | {
      id: 'createdon' | 'completedon';
      value: [number | null, number | null];
    };

const normalFilterColumns: (keyof SbSyncQueue)[] = ['type', 'dataText', 'state', 'hasChanges'];
const dateFilterColumns: (keyof SbSyncQueue)[] = ['createdon', 'completedon'];

// TODO add full text search
const constructWhereClause = (filter: PossibleFilterValue[]): FindOptionsWhere<SbSyncQueue> => {
  const whereClause: FindOptionsWhere<SbSyncQueue> = {};
  filter.forEach((filter) => {
    if (filter?.id === 'type') {
      whereClause.type = filter.value;
    } else if (filter?.id === 'dataText') {
      whereClause.dataText = filter.value;
    } else if (filter?.id === 'sbEnvironmentId') {
      whereClause.sbEnvironmentId = Number(filter.value);
    } else if (filter?.id === 'edfiTenantId') {
      whereClause.edfiTenantId = Number(filter.value);
    } else if (filter?.id === 'state') {
      whereClause.state = filter.value;
    } else if (filter?.id === 'hasChanges') {
      whereClause.hasChanges = filter.value;
    } else if (filter?.id === 'createdon' || filter?.id === 'completedon') {
      if (filter.value[0] !== null && filter.value[1] !== null) {
        whereClause[filter?.id] = Between(new Date(filter.value[0]), new Date(filter.value[1]));
      } else if (filter.value[0] !== null) {
        whereClause[filter?.id] = MoreThan(new Date(filter.value[0]));
      } else if (filter.value[1] !== null) {
        whereClause[filter?.id] = LessThan(new Date(filter.value[1]));
      }
    }
  });
  return whereClause;
};

@Injectable()
export class ParseFilterQueryParamPipe implements PipeTransform {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transform(value: any) {
    if (value === undefined) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let parseResult: any;
    try {
      parseResult = JSON.parse(Buffer.from(value, 'base64').toString('utf-8'));
    } catch (_parseError) {
      throw new BadRequestException(
        'Invalid filter query parameter. It should be a base64-encoded JSON string.'
      );
    }
    if (!Array.isArray(parseResult)) {
      throw new BadRequestException(
        'Invalid filter query parameter. It should be an array of objects.'
      );
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parseResult = parseResult.map((item: { i: string; v: any }) => {
        if (!(item.i && 'v' in item))
          throw new BadRequestException(
            "Invalid filter query parameter. Each object should have 'i' and 'v' properties (shorthand for id and value)."
          );
        return {
          id: item.i,
          value: item.v,
        };
      });
    } catch (_mapFailedError) {
      throw new BadRequestException(
        "Invalid filter query parameter. Each object should have 'i' and 'v' properties (shorthand for id and value)."
      );
    }
    return parseResult as PossibleFilterValue[];
  }
}

@ApiTags('SB Sync Queue')
@Controller()
export class SbSyncController {
  constructor(
    @Inject('IJobQueueService')
    private readonly jobQueue: IJobQueueService,
    @InjectRepository(SbSyncQueue) private readonly queueRepository: Repository<SbSyncQueue>
  ) {}

  @Get('faceted-values')
  @Authorize({
    privilege: 'sb-sync-queue:read',
    subject: {
      id: '__filtered__',
    },
  })
  async facetedUniqueValues(
    @Query('colFilter', new ParseFilterQueryParamPipe()) colFilter: PossibleFilterValue[]
  ) {
    const whereClause = constructWhereClause(colFilter);
    const facetedValues: SbSyncQueueFacetedValuesDto = Object.fromEntries(
      await Promise.all([
        ...normalFilterColumns.map(async (column) => {
          const query = this.queueRepository
            .createQueryBuilder()
            .distinct()
            .select([`"${column}"`])
            .where(_.omit(whereClause, [column]));
          const result = await query.getRawMany();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return [column, result.map((r) => r[column]) as any];
        }),
        ...dateFilterColumns.map(async (column) => {
          const query = this.queueRepository
            .createQueryBuilder()
            .select([`MIN("${column}") as min`, `MAX("${column}") as max`])
            .where(_.omit(whereClause, [column]));
          const result = await query.getRawOne();
          return [column, [result.min, result.max]];
        }),
      ])
    );
    return toSbSyncQueueFacetedValuesDto(facetedValues);
  }
  @Get()
  @Authorize({
    privilege: 'sb-sync-queue:read',
    subject: {
      id: '__filtered__',
    },
  })
  async query(
    @Query('colFilter', new ParseFilterQueryParamPipe()) colFilter: PossibleFilterValue[],
    @Query('pageIndex', new ParseIntPipe()) pageIndex: string,
    @Query('pageSize', new ParseIntPipe()) pageSize: string,
    @Query('sortCol', new ParseArrayPipe({ optional: true })) sortCol: undefined | string[],
    @Query('sortDesc', new ParseArrayPipe({ optional: true })) sortDesc: undefined | string[]
  ) {
    const whereClause = constructWhereClause(colFilter);
    const orderByClause = Object.fromEntries(
      (sortCol ?? [])
        .filter((value) => sortCols.includes(value))
        .map((col, i) => [col, sortDesc[i] === 'true' ? ('DESC' as const) : ('ASC' as const)])
    );
    if (!('createdon' in orderByClause)) {
      orderByClause.createdon = 'DESC';
    }
    const data = await this.queueRepository
      .createQueryBuilder()
      .where(whereClause)
      .orderBy(orderByClause)
      .offset(Number(pageSize) * Number(pageIndex))
      .limit(Number(pageSize))
      .getMany();

    const rowCount = await this.queueRepository.count({ where: whereClause });
    return toSyncQueuePaginatedResults({
      data: toSbSyncQueueDto(data),
      rowCount,
    });
  }

  @Get(':sbSyncQueueId')
  @Authorize({
    privilege: 'sb-sync-queue:read',
    subject: {
      id: '__filtered__',
    },
  })
  async findOne(@Param('sbSyncQueueId') sbSyncQueueId: string) {
    return toSbSyncQueueDto(await this.queueRepository.findOneBy({ id: sbSyncQueueId }));
  }

  @Post()
  @Authorize({
    privilege: 'sb-environment.edfi-tenant:refresh-resources',
    subject: {
      id: '__filtered__',
    },
  })
  async triggerSync() {
    const jobQueue = this.jobQueue;
    const id = await jobQueue.send(SYNC_SCHEDULER_CHNL, null);
    return new Promise((r) => {
      let job: Job;
      const timer = setInterval(poll, 500);
      let i = 0;
      async function poll() {
        job = await jobQueue.getJobById(id);
        if (
          i === 120 ||
          job.state === 'completed' ||
          job.state === 'failed' ||
          job.state === 'cancelled' ||
          job.state === 'expired'
        ) {
          clearInterval(timer);
          r(
            toOperationResultDto(
              job.state === 'completed'
                ? {
                    type: 'Success',
                    title: 'Sync queued',
                  }
                : job.state === 'failed'
                ? {
                    type: 'Error',
                    title: 'Failed to queue sync',
                    data:
                      typeof job.output === 'object' && job.output !== null
                        ? _.omit(job.output as object, 'stack')
                        : undefined,
                  }
                : {
                    type: 'Warning',
                    title: 'Unknown issue',
                    data: _.pick(job, [
                      'state',
                      'retrycount',
                      'startedon',
                      'createdon',
                      'completedon',
                      'output',
                    ]),
                  }
            )
          );
        }
        i++;
      }
    });
  }
}
