import { EdfiTenant, SbEnvironment } from '@edanalytics/models-server';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  NotFoundException,
  createParamDecorator,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import _ from 'lodash';
import { Repository } from 'typeorm';
import { throwNotFound } from '../utils';
import { Reflector } from '@nestjs/core';
import { OPERATION, SB_VERSION } from '../auth/authorization/sbVersion.decorator';

/** Look up SbEnvironment and EdfiTenant identified in route path and attach it to request object
 * Check if an operation available only in V2 is being attempted in a V1 SB environment
 */
@Injectable()
export class SbEnvironmentEdfiTenantInterceptor implements NestInterceptor {
  constructor(
    @InjectRepository(EdfiTenant)
    private edfiTenantsRepository: Repository<EdfiTenant>,
    @InjectRepository(SbEnvironment)
    private sbEnvironmentsRepository: Repository<SbEnvironment>,
    private reflector: Reflector
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();

    const sbEnvironmentId = Number(request.params?.sbEnvironmentId);
    const edfiTenantId = Number(request.params?.edfiTenantId);
    const sbVersions = this.reflector.getAllAndOverride<string[]>(SB_VERSION, [
      context.getHandler(),
      context.getClass(),
    ]);

    const operation = this.reflector.getAllAndOverride<string>(OPERATION, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (_.isFinite(edfiTenantId)) {
      const edfiTenant = await this.edfiTenantsRepository
        .findOneOrFail({
          where: {
            id: edfiTenantId,
            ...(_.isFinite(sbEnvironmentId) ? { sbEnvironmentId } : {}),
          },
          relations: ['sbEnvironment'],
        })
        .catch(throwNotFound);

      request.edfiTenant = edfiTenant;
      request.sbEnvironment = edfiTenant.sbEnvironment;
    } else if (_.isFinite(sbEnvironmentId)) {
      request.sbEnvironment = await this.sbEnvironmentsRepository
        .findOneByOrFail({ id: sbEnvironmentId })
        .catch(throwNotFound);
    }

    if (sbVersions?.length && !sbVersions.includes(request.sbEnvironment.version)) {
      throw new NotFoundException(
        `${operation} is not supported in ${request.sbEnvironment.version} environments`
      );
    }
    return next.handle();
  }
}

/** Inject EdfiTenant from request object into a handler param */
export const ReqEdfiTenant = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  if (!(request?.edfiTenant?.constructor?.name === 'EdfiTenant')) {
    throw new Error("No EdfiTenant found in request's context in ReqEdfiTenant.");
  }
  return request.edfiTenant;
});
/** Inject SbEnvironment from request object into a handler param */
export const ReqSbEnvironment = createParamDecorator((data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  if (!(request?.sbEnvironment?.constructor?.name === 'SbEnvironment')) {
    throw new Error("No SbEnvironment found in request's context in ReqSbEnvironment.");
  }

  return request.sbEnvironment;
});
