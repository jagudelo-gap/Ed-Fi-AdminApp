import 'reflect-metadata';
import { validate } from 'class-validator';
import {
  PostInstanceDtoV2,
  CopyClaimsetDtoV2,
  ImportClaimsetSingleDtoV2,
} from './edfi-admin-api.v2.dto';

describe('PostInstanceDtoV2', () => {
  it('requires name and databaseTemplate', async () => {
    const dto = new PostInstanceDtoV2();
    const result = await validate(dto);
    const fieldsWithErrors = result.map((error) => error.property);

    expect(fieldsWithErrors).toContain('name');
    expect(fieldsWithErrors).toContain('databaseTemplate');
  });

  it('accepts name and databaseTemplate', async () => {
    const dto = Object.assign(new PostInstanceDtoV2(), {
      name: 'My DB Instance',
      databaseTemplate: 'Minimal',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});

describe('V2 claim set name validation', () => {
  const namesOf = async (dto: object) => (await validate(dto)).map((e) => e.property);

  it('CopyClaimsetDtoV2 still ACCEPTS whitespace (V2 has no such rule)', async () => {
    const dto = Object.assign(new CopyClaimsetDtoV2(), {
      originalId: 1,
      name: 'AB Connect (copy)',
    });
    expect(await namesOf(dto)).not.toContain('name');
  });

  it('ImportClaimsetSingleDtoV2 still ACCEPTS whitespace', async () => {
    const dto = Object.assign(new ImportClaimsetSingleDtoV2(), {
      name: 'Bootstrap Descriptors and EdOrgs',
      resourceClaims: [],
    });
    expect(await namesOf(dto)).not.toContain('name');
  });

  it('CopyClaimsetDtoV2 rejects a name of 300 characters', async () => {
    const dto = Object.assign(new CopyClaimsetDtoV2(), {
      originalId: 1,
      name: 'A'.repeat(300),
    });
    expect(await namesOf(dto)).toContain('name');
  });

  it('ImportClaimsetSingleDtoV2 rejects a name of 300 characters', async () => {
    const dto = Object.assign(new ImportClaimsetSingleDtoV2(), {
      name: 'A'.repeat(300),
      resourceClaims: [],
    });
    expect(await namesOf(dto)).toContain('name');
  });
});
