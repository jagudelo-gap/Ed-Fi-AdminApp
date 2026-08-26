import { Controller } from '@nestjs/common';
// import { Public } from '../auth/authorization/public.decorator';
// import { CertificationService } from './certification.service';
// import { ArtifactService } from './artifact/artifact.service';

// interface RunDto {
//   scenarioPath: string; // path relative to runtime bruno root, e.g. v4/Group/Entity
//   params?: Record<string, any>;
//   env?: string;
// }

@Controller('certification')
export class CertificationController {
  // TODO: — inject CertificationService and ArtifactService
  // Moved out of the constructor to avoid prettier formatting issues in CI.

  // // ------------------------------------------------------------------------------
  // // @TODO: The run() method was copied from the original POC and will be refactored in Certification 2.2
  // // ------------------------------------------------------------------------------
  // @Post('run')
  // @Public()
  // async run(@Body() body: RunDto) {

  //   if (!body || !body.scenarioPath) {
  //     return { error: 'scenarioPath required' };
  //   }
  //   if (!this.artifactService.isRunTimeReady) {
  //     return { error: 'Certification runtime is not ready yet. Please try again later.' };
  //   }

  //   const workDir = await this.certificationService.prepareScenario(body.scenarioPath, body.params || {});
  //   const result = await this.certificationService.runBruno(workDir, body.env);
  //   return {
  //     scenarioPath: body.scenarioPath,
  //     workDir,
  //     exitCode: result.exitCode,
  //     output: result.output,
  //   };
  // }
}
