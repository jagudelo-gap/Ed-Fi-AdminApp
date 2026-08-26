import 'reflect-metadata';
import { FkOnDeleteFix1694446892889 } from './1694446892889-FkOnDeleteFix';
import { runMigrationSmokeTest } from '../../../test/helpers/migration-smoke-test.helper';

runMigrationSmokeTest(FkOnDeleteFix1694446892889);
