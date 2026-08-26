import { JsonSecret, SecretFields } from '@edanalytics/common-ui';

export function getSecretJson(secret: string | null, fields: SecretFields): JsonSecret | null {
  if (!secret) return null;

  try {
    const secretJson = JSON.parse(secret);
    const isValid = fields.every(({ key }) => secretJson && typeof secretJson[key] === 'string');
    if (!isValid) throw new Error('Retrieved secret not valid');
    return secretJson;
  } catch {
    return null;
  }
}
