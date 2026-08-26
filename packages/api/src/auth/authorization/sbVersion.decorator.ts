import { SetMetadata } from '@nestjs/common';

export const SB_VERSION = 'sbVersion';
export const OPERATION = 'operation';
export const SbVersion = (...versions: string[]) => SetMetadata(SB_VERSION, versions);
export const Operation = (operationString = 'This operation') =>
  SetMetadata(OPERATION, operationString);
