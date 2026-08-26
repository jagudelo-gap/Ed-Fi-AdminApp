type DbEngine = 'mssql' | 'pgsql';

/**
 * Returns a SQL fragment for accessing a JSON field value.
 * - MSSQL:      JSON_VALUE(column, '$.path')
 * - PostgreSQL: "column"->>'path'
 */
export function jsonValue(column: string, path: string, engine: DbEngine): string {
  return engine === 'mssql'
    ? `JSON_VALUE(${column}, '$.${path}')`
    : `"${column}"->>'${path}'`;
}
