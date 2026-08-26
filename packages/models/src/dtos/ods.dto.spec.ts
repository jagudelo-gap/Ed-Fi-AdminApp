import 'reflect-metadata';
import { validate } from 'class-validator';
import { PostOdsDto } from './ods.dto';

describe('PostOdsDto', () => {
  it('accepts lowercase alphanumeric names', async () => {
    const dto = new PostOdsDto();
    dto.name = 'ods123';
    dto.templateName = 'TemplateNameValue';

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'name')).toBeUndefined();
  });

  it('accepts names containing uppercase letters, spaces, and underscores', async () => {
    const dto = new PostOdsDto();
    dto.name = 'My ODS_Name';
    dto.templateName = 'TemplateNameValue';

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'name')).toBeUndefined();
  });

  it('rejects names containing unsupported characters', async () => {
    const dto = new PostOdsDto();
    dto.name = 'ODS-Name';
    dto.templateName = 'TemplateNameValue';

    const errors = await validate(dto);

    expect(errors.find((e) => e.property === 'name')).toBeDefined();
  });
});
