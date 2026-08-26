import { toGetIntegrationProviderDto, Ids } from '@edanalytics/models';
import { IntegrationProvider } from '@edanalytics/models-server';

import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { Authorize } from '../auth/authorization';
import { InjectFilter } from '../auth/helpers/inject-filter';
import { whereIds } from '../auth/helpers/where-ids';

@ApiTags('IntegrationProvider - Team')
@Controller()
export class IntegrationProvidersTeamController {
  constructor(
    @InjectRepository(IntegrationProvider)
    private integrationProvidersRepository: Repository<IntegrationProvider>
  ) {}

  async findOneById(id: number) {
    return await this.integrationProvidersRepository.findOneByOrFail({ id }).catch(throwNotFound);
  }

  @Get()
  @Authorize({
    privilege: 'team.integration-provider.application:read',
    subject: { id: '__filtered__', teamId: 'teamId' },
  })
  async findMany(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @InjectFilter('team.integration-provider.application:read')
    validIds: Ids
  ) {
    return toGetIntegrationProviderDto(
      await this.integrationProvidersRepository.findBy({ ...whereIds(validIds) })
    );
  }

  @Get(':integrationProviderId')
  @Authorize({
    privilege: 'team.integration-provider.application:read',
    subject: { id: 'integrationProviderId', teamId: 'teamId' },
  })
  async findOne(
    @Param('teamId', new ParseIntPipe()) teamId: number,
    @Param('integrationProviderId', new ParseIntPipe()) integrationProviderId?: number
  ) {
    return toGetIntegrationProviderDto(await this.findOneById(integrationProviderId));
  }
}
