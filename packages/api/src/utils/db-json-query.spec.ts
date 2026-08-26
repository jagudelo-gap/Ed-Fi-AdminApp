import { jsonValue } from './db-json-query';

describe('jsonValue', () => {
  describe('pgsql engine', () => {
    it('generates a PostgreSQL JSON extract expression', () => {
      expect(jsonValue('data', 'name', 'pgsql')).toBe(`"data"->>'name'`);
    });

    it('wraps column name in double quotes', () => {
      const result = jsonValue('metadata', 'type', 'pgsql');
      expect(result).toMatch(/^"metadata"/);
    });

    it('uses the ->> operator for JSON field extraction', () => {
      const result = jsonValue('payload', 'status', 'pgsql');
      expect(result).toContain('->>');
    });
  });

  describe('mssql engine', () => {
    it('generates a MSSQL JSON_VALUE expression', () => {
      expect(jsonValue('data', 'name', 'mssql')).toBe(`JSON_VALUE(data, '$.name')`);
    });

    it('uses the JSON_VALUE function', () => {
      const result = jsonValue('data', 'status', 'mssql');
      expect(result).toContain('JSON_VALUE');
    });

    it('uses the correct dollar-dot path syntax', () => {
      const result = jsonValue('payload', 'status', 'mssql');
      expect(result).toContain('$.status');
    });
  });
});
