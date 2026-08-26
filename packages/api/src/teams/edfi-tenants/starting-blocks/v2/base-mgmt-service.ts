import { InvokeCommand, LambdaClient } from '@aws-sdk/client-lambda';
import { parse } from '@aws-sdk/util-arn-parser';
import { ISbEnvironmentConfigPublicV2 } from '@edanalytics/models';
import { SbEnvironment } from '@edanalytics/models-server';
import { Logger } from '@nestjs/common';

type MgmtArnKey = keyof Pick<
  ISbEnvironmentConfigPublicV2['meta'],
  | 'odsManagementFunctionArn'
  | 'tenantManagementFunctionArn'
  | 'edorgManagementFunctionArn'
  | 'dataFreshnessFunctionArn'
>;

export class BaseMgmtServiceV2 {
  private readonly logger: Logger;
  private arnPropertyName: MgmtArnKey;

  constructor(arnPropertyName: MgmtArnKey) {
    this.logger = new Logger(this.constructor.name);
    this.arnPropertyName = arnPropertyName;
  }

  executeMgmtFunction<
    SuccessBody,
    FailureResponses extends {
      errorMessage: string;
      errorType?: string;
      requestId?: string;
      stackTrace?: string[];
    } = { errorMessage: string; errorType: string; requestId: string; stackTrace?: string[] }
  >(sbEnvironment: SbEnvironment, payload: object) {
    const configPublic = sbEnvironment.configPublic;
    const versionedConfig =
      'version' in configPublic &&
      (configPublic.version === 'v2' || configPublic.version === 'v3')
        ? configPublic.values
        : undefined;
    const arnStr = versionedConfig?.meta?.[this.arnPropertyName];
    if (arnStr) {
      const arn = parse(arnStr);
      const client = new LambdaClient({
        region: arn.region,
        retryMode: 'adaptive',
        maxAttempts: 5,
      });
      return client
        .send(
          new InvokeCommand({
            FunctionName: arnStr,
            InvocationType: 'RequestResponse',
            Payload: JSON.stringify(payload),
          })
        )
        .then((result) => {
          const payload = JSON.parse(Buffer.from(result.Payload).toString('utf8'));
          if (!('FunctionError' in result)) {
            return {
              status: 'SUCCESS' as const,
              data: payload as SuccessBody,
            };
          } else {
            this.logger.error('Failed to execute management Lambda', payload);
            return {
              status: 'FAILURE' as const,
              data: payload as FailureResponses,
            };
          }
        })
        .catch((err) => {
          this.logger.error(err);
          return {
            status: 'FAILURE' as const,
            data: undefined,
            error: err.message ? (err.message as string) : 'Failed to execute management Lambda',
          };
        });
    } else {
      this.logger.warn(`ARN ${this.arnPropertyName} not found in ${sbEnvironment.envLabel}`);
      return {
        status: 'NO_CONFIG' as const,
        data: undefined,
      };
    }
  }
}
