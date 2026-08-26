import 'reflect-metadata';
import { validate } from 'class-validator';
import { IsArn } from './is-arn';

class TestDto {
  @IsArn()
  arn: string;
}

class TestDtoAllowEmpty {
  @IsArn({ allowEmptyString: true })
  arn: string;
}

describe('IsArn', () => {
  it('passes for a valid ARN', async () => {
    const dto = new TestDto();
    dto.arn = 'arn:aws:iam::123456789012:role/MyRole';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails for an invalid ARN', async () => {
    const dto = new TestDto();
    dto.arn = 'not-an-arn';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('arn');
  });

  it('fails for an empty string when allowEmptyString is not set', async () => {
    const dto = new TestDto();
    dto.arn = '';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('passes for an empty string when allowEmptyString is true', async () => {
    const dto = new TestDtoAllowEmpty();
    dto.arn = '';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('still validates non-empty strings when allowEmptyString is true', async () => {
    const dto = new TestDtoAllowEmpty();
    dto.arn = 'still-invalid';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
