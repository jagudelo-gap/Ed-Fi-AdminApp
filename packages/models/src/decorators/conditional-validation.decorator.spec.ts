import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  IsNumberOrCommaSeparatedNumbers,
  IsNotEmptyForVersions,
  IsUrlForVersions,
} from './conditional-validation.decorator';

class TestDtoNumbers {
  version: string;

  @IsNumberOrCommaSeparatedNumbers(['v2'])
  edorgIds: string;

  [key: string]: unknown;
}

class TestDtoNotEmpty {
  version: string;

  @IsNotEmptyForVersions(['v2'])
  requiredField: string;

  [key: string]: unknown;
}

class TestDtoUrl {
  version: string;

  @IsUrlForVersions(['v2'])
  apiUrl: string;

  [key: string]: unknown;
}

describe('IsNumberOrCommaSeparatedNumbers', () => {
  it('passes when version is not in the allowed list', async () => {
    const dto = Object.assign(new TestDtoNumbers(), { version: 'v1', edorgIds: 'not-a-number' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes for a single number when version matches', async () => {
    const dto = Object.assign(new TestDtoNumbers(), { version: 'v2', edorgIds: '123' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes for comma-separated numbers', async () => {
    const dto = Object.assign(new TestDtoNumbers(), { version: 'v2', edorgIds: '1, 2, 3' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails for a non-numeric string when version matches', async () => {
    const dto = Object.assign(new TestDtoNumbers(), { version: 'v2', edorgIds: 'abc' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('edorgIds');
  });

  it('passes for empty value (defers to @IsOptional)', async () => {
    const dto = Object.assign(new TestDtoNumbers(), { version: 'v2', edorgIds: '' });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('IsNotEmptyForVersions', () => {
  it('passes when version is not in the allowed list', async () => {
    const dto = Object.assign(new TestDtoNotEmpty(), { version: 'v1', requiredField: '' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes when value is not empty for a matching version', async () => {
    const dto = Object.assign(new TestDtoNotEmpty(), { version: 'v2', requiredField: 'some value' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails when value is empty for a matching version', async () => {
    const dto = Object.assign(new TestDtoNotEmpty(), { version: 'v2', requiredField: '' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('requiredField');
  });
});

describe('IsUrlForVersions', () => {
  it('passes when version is not in the allowed list', async () => {
    const dto = Object.assign(new TestDtoUrl(), { version: 'v1', apiUrl: 'not-a-url' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('passes for a valid URL when version matches', async () => {
    const dto = Object.assign(new TestDtoUrl(), { version: 'v2', apiUrl: 'https://example.com/api' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('fails for an invalid URL when version matches', async () => {
    const dto = Object.assign(new TestDtoUrl(), { version: 'v2', apiUrl: 'not-a-url' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('apiUrl');
  });

  it('passes for empty value (defers to other validators)', async () => {
    const dto = Object.assign(new TestDtoUrl(), { version: 'v2', apiUrl: '' });
    expect(await validate(dto)).toHaveLength(0);
  });
});
