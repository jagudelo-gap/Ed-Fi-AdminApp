import { registerDecorator, ValidationOptions, ValidationArguments } from 'class-validator';

/**
 * Validates that a value is a single number or comma-separated list of numbers
 * Only applies when the version property matches the specified versions
 */
export function IsNumberOrCommaSeparatedNumbers(versions: string[], validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNumberOrCommaSeparatedNumbers',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [versions],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [allowedVersions] = args.constraints;
          const currentVersion = (args.object as Record<string, unknown>)['version'];
          
          // If the current version is not in the allowed versions, skip validation
          if (!allowedVersions || !allowedVersions.includes(currentVersion)) {
            return true;
          }
          
          // If value is empty, let @IsOptional handle it
          if (value === null || value === undefined || value === '') {
            return true;
          }
          
          // Must be a string
          if (typeof value !== 'string') {
            return false;
          }
          
          // Check if it's a single number or comma-separated numbers
          const numberPattern = /^\s*\d+(?:\s*,\s*\d+)*\s*$/;
          return numberPattern.test(value);
        },
        defaultMessage() {
          return 'Must be a single number or a comma-separated list of numbers';
        },
      },
    });
  };
}

/**
 * Validates that a value is not empty, only for specified versions
 */
export function IsNotEmptyForVersions(versions: string[], validationOptions?: ValidationOptions) {
  return function (object: Record<string, unknown>, propertyName: string) {
    registerDecorator({
      name: 'isNotEmptyForVersions',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [versions],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [allowedVersions] = args.constraints;
          const currentVersion = (args.object as Record<string, unknown>)['version'];
          
          // If the current version is not in the allowed versions, skip validation
          if (!allowedVersions || !allowedVersions.includes(currentVersion)) {
            return true;
          }
          
          return value !== null && value !== undefined && value !== '';
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} is required`;
        },
      },
    });
  };
}

/**
 * Validates URL format, only for specified versions
 */
export function IsUrlForVersions(versions: string[], validationOptions?: ValidationOptions) {
  return function (object: Record<string, unknown>, propertyName: string) {
    registerDecorator({
      name: 'isUrlForVersions',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [versions],
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const [allowedVersions] = args.constraints;
          const currentVersion = (args.object as Record<string, unknown>)['version'];
          
          // If the current version is not in the allowed versions, skip validation
          if (!allowedVersions || !allowedVersions.includes(currentVersion)) {
            return true;
          }
          
          // If value is empty, let other validators handle it
          if (value === null || value === undefined || value === '') {
            return true;
          }
          
          try {
            new URL(value as string);
            return true;
          } catch {
            return false;
          }
        },
        defaultMessage() {
          return 'Must be a valid URL';
        },
      },
    });
  };
}
