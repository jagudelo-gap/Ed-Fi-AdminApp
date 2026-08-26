import 'reflect-metadata';
import { BaseMgmtServiceV2 } from './base-mgmt-service';
import { SbEnvironment } from '@edanalytics/models-server';

const mockSend = jest.fn();
jest.mock('@aws-sdk/client-lambda', () => ({
  LambdaClient: jest.fn().mockImplementation(() => ({ send: mockSend })),
  InvokeCommand: jest.fn().mockImplementation((input) => input),
}));

describe('BaseMgmtServiceV2 - executeMgmtFunction version support', () => {
  let service: BaseMgmtServiceV2;

  const arn = 'arn:aws:lambda:us-east-1:123456789012:function:edorg-mgmt';

  const buildEnvironment = (version: 'v1' | 'v2' | 'v3' | undefined): Partial<SbEnvironment> =>
    (version
      ? {
          envLabel: 'test-env',
          configPublic: {
            version,
            values: { meta: { edorgManagementFunctionArn: arn } },
          },
        }
      : { envLabel: 'test-env', configPublic: { version: undefined, values: undefined } }) as Partial<SbEnvironment>;

  beforeEach(() => {
    service = new BaseMgmtServiceV2('edorgManagementFunctionArn');
    mockSend.mockReset();
    mockSend.mockResolvedValue({
      Payload: Buffer.from(JSON.stringify({ ok: true })),
    });
  });

  it('resolves the ARN and invokes the Lambda for a v2 environment', async () => {
    const result = await service.executeMgmtFunction(buildEnvironment('v2') as SbEnvironment, {
      Action: 'Add',
    });

    expect(result).toEqual({ status: 'SUCCESS', data: { ok: true } });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('resolves the ARN and invokes the Lambda for a v3 environment', async () => {
    const result = await service.executeMgmtFunction(buildEnvironment('v3') as SbEnvironment, {
      Action: 'Add',
    });

    expect(result).toEqual({ status: 'SUCCESS', data: { ok: true } });
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('returns NO_CONFIG for a v1 environment', async () => {
    const result = await service.executeMgmtFunction(buildEnvironment('v1') as SbEnvironment, {
      Action: 'Add',
    });

    expect(result).toEqual({ status: 'NO_CONFIG', data: undefined });
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('returns NO_CONFIG when the environment has no version', async () => {
    const result = await service.executeMgmtFunction(buildEnvironment(undefined) as SbEnvironment, {
      Action: 'Add',
    });

    expect(result).toEqual({ status: 'NO_CONFIG', data: undefined });
    expect(mockSend).not.toHaveBeenCalled();
  });
});
