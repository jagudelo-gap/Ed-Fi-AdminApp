import {
  GetUserDto,
  PostSbEnvironmentDto,
  PutSbEnvironmentDto,
  toOdsTemplateOptionDto,
} from '@edanalytics/models';
import { SbEnvironment, regarding } from '@edanalytics/models-server';
import { Injectable } from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CustomHttpException, throwNotFound } from '../../utils';
import { StartingBlocksServiceV2 } from '../edfi-tenants/starting-blocks';

@Injectable()
export class SbEnvironmentsService {
  constructor(
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    @InjectEntityManager()
    private readonly entityManager: EntityManager,
    private readonly startingBlocksServiceV2: StartingBlocksServiceV2
  ) {}
  create(createSbEnvironmentDto: PostSbEnvironmentDto) {
    return this.sbEnvironmentsRepository.save(
      this.sbEnvironmentsRepository.create(createSbEnvironmentDto)
    );
  }

  async findOne(id: number) {
    return this.sbEnvironmentsRepository.findOneByOrFail({ id });
  }

  async update(id: number, updateSbEnvironmentDto: PutSbEnvironmentDto) {
    const old = await this.findOne(id);
    return this.sbEnvironmentsRepository.save({
      ...old,
      ...updateSbEnvironmentDto,
    });
  }

  async remove(id: number, _user: GetUserDto) {
    const old = await this.findOne(id).catch(throwNotFound);
    await this.sbEnvironmentsRepository.remove(old);
    return undefined;
  }

  async getOdsTemplates(sbEnvironment: SbEnvironment) {
    const templates = await this.startingBlocksServiceV2.odsMgmtService.listTemplates(
      sbEnvironment
    );
    if (templates.status !== 'SUCCESS') {
      throw new CustomHttpException(
        {
          title: 'List-templates unsuccessful.',
          type: 'Error',
          message: templates.status + '. ' + (templates?.data?.errorMessage ?? 'Unknown error.'),
          regarding: regarding(sbEnvironment),
        },
        500
      );
    }
    return toOdsTemplateOptionDto(templates.data.map((t) => ({ id: t, displayName: t })));
  }
}
