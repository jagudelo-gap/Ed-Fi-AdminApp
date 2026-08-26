import { readdir, readFile, writeFile, access } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsRoot = join(__dirname, '..', 'src', 'database', 'migrations');
const dirs = ['pgsql', 'mssql'];

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function processDir(dirName) {
  const dirPath = join(migrationsRoot, dirName);
  const files = (await readdir(dirPath)).filter(
    (f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')
  );

  let created = 0;
  let skipped = 0;

  for (const file of files) {
    const filePath = join(dirPath, file);
    const specPath = filePath.replace('.ts', '.spec.ts');

    if (await fileExists(specPath)) {
      console.log(`  SKIP (already exists): ${file}`);
      skipped++;
      continue;
    }

    const content = await readFile(filePath, 'utf8');
    const match = content.match(/export\s+class\s+(\w+)/);
    if (!match) {
      console.warn(`  WARN: Could not find exported class in ${file}`);
      continue;
    }

    const className = match[1];
    const moduleName = basename(file, '.ts');

    const specContent = `import 'reflect-metadata';\nimport { ${className} } from './${moduleName}';\nimport { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';\n\nrunMigrationSmokeTest(${className});\n`;

    await writeFile(specPath, specContent, { encoding: 'utf8' });
    console.log(`  CREATED: ${basename(specPath)}`);
    created++;
  }

  return { created, skipped };
}

async function main() {
  let totalCreated = 0;
  let totalSkipped = 0;

  for (const dir of dirs) {
    console.log(`\nProcessing ${dir}...`);
    const { created, skipped } = await processDir(dir);
    totalCreated += created;
    totalSkipped += skipped;
  }

  console.log(`\nDone. Created: ${totalCreated}, Skipped: ${totalSkipped}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
