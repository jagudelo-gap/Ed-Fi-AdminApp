# Admin App - Coding Agent Instructions

## Overview

The Admin App is a centralized management system for Ed-Fi Technology Suite deployments. It provides a unified interface for managing multiple Ed-Fi API instances across on-premises, cloud, or Starting Blocks environments.

## Project Structure

```none
packages/
├── api/           # NestJS backend application
├── fe/            # React frontend application
├── common-ui/     # Shared UI components with Storybook
├── models/        # Shared TypeScript models/types
├── models-server/ # Server-side specific models
└── utils/         # Shared utilities
```

## Key Technologies & Dependencies

### Frontend Stack

- **React** with TypeScript
- **Chakra UI** for component library
- **Vite** for build tooling
- **TanStack Query** for data fetching
- **React Router DOM** for routing
- **React Hook Form** for form management
- **Jotai** for state management

### Backend Stack

- **NestJS** framework
- **TypeORM** for database ORM
- **PostgreSQL** as primary database, or alternatively **Microsoft SQL Server**
- **Express Session** for session management
- **Passport** for authentication

### Development Tools

- **Nx** for monorepo management
- **ESLint** with TypeScript support
- **Prettier** for code formatting
- **Jest** for testing
- **Storybook** for component development
- **Node.js >=24.0.0** required (see `.nvmrc` for the exact pinned version)

### Key Commands

- `npm run build:fe` - Build frontend
- `npm run build:api` - Build API
- `npm run migrations:generate -- MigrationName` - Generate database migration
- `npm run migrations:run` - Run pending migrations
- `npm run migrations:run:mssql` - Run pending migrations against MSSQL
- `npm run test:api` - Run API tests
- `npm run test:fe` - Run frontend tests
- `npm run test:e2e:bdd` - Run the Playwright BDD E2E suite (requires the stack already running — see below for the full provisioning runner)
- `npm run lint:check` - Check linting
- `npm run storybook` - Start Storybook

## Development Guidelines

### Code Organization

- **Monorepo**: Use Nx workspace structure with clear package boundaries
- **Shared Code**: Common utilities in `utils/`, UI components in `common-ui/`
- **Models**: Separate client (`models/`) and server (`models-server/`) models
- **TypeScript**: Strict typing throughout the codebase

### Database Management

- **Migrations**: Always generate migrations for schema changes
- **TypeORM**: Use decorators and entities for database modeling
- **Multiple DBs**: Support for both PostgreSQL and MSSQL

### Authentication & Security

- **OIDC Integration**: Configurable identity providers
- **Session Management**: Express sessions with database storage
- **Machine Users**: Support for M2M authentication via OAuth
- **Encryption**: Sensitive data encrypted at rest

### Testing Strategy

- **Unit Tests**: Jest for both frontend and backend
- **E2E Tests**: Playwright (with `playwright-bdd`) for browser UI integration testing; see [Running Playwright E2E Tests](#running-playwright-e2e-tests) below
- **Storybook**: Component testing and documentation
- **Test Coverage**: Maintain good coverage across packages

### Code Quality

- **REQUIRED**: Obey the `.editorconfig` file settings at all times. The project uses:
  - UTF-8 character encoding
  - 2-space indentation
  - Spaces for indentation style
  - Final newlines required
  - Trailing whitespace must be trimmed
- **REQUIRED**: LF line endings are enforced repo-wide via `.gitattributes` (`* text=auto eol=lf`)
- **ESLint**: Enforce coding standards with TypeScript rules
- **Husky pre-commit hook**: A `husky` pre-commit hook runs `lint-staged`, which runs `eslint --max-warnings 0` on staged `.ts`/`.tsx`/`.js`/`.jsx` files. Commits with lint errors or warnings are blocked — fix them instead of bypassing the hook (`git commit --no-verify`).
- **Prettier**: Consistent code formatting
- **Semantic Release**: Automated versioning based on commit messages
- **PR Guidelines**: Use semantic commit messages (feat:, fix:, docs:, etc.)
- **REQUIRED**: Execute `npm run build` before submitting any changes and correct any build errors
 
## Common Development Tasks

### Adding New Features

1. **Plan**: Break down into smaller concepts
2. **Models**: Define TypeScript interfaces in appropriate packages
3. **Database**: Create migrations if schema changes needed
4. **Backend**: Implement NestJS controllers, services, DTOs
5. **Frontend**: Create React components, hooks, and pages
6. **Tests**: Add unit and integration tests
7. **Documentation**: Update relevant docs

### Working with Database

```bash
# Generate migration
npm run migrations:generate -- AddNewFeature

# Run migrations on PostgreSQL
npm run migrations:run

# Revert last migration
npm run migrations:revert
```

### Component Development

```bash
# Start Storybook
npm run storybook

# Build Storybook
npm run build-storybook:common-ui
```

### Running Playwright E2E Tests

The full Playwright BDD suite (`npm run test:e2e:bdd`) needs the whole stack running against it — Docker Compose services, the Admin App API/frontend, and Keycloak. Use `eng/testing/run-e2e-ui.ps1` to provision everything and run the suite in one step:

```bash
# Provision the stack (PostgreSQL for the Admin App database) and run the suite
pwsh ./eng/testing/run-e2e-ui.ps1

# Same, but against SQL Server for the Admin App database
pwsh ./eng/testing/run-e2e-ui.ps1 -DbEngine mssql

# Rebuild Admin App images first, then stop all services after the run
pwsh ./eng/testing/run-e2e-ui.ps1 -Rebuild -StopServices
```

The script checks prerequisites (Node dependencies, Playwright Chromium, TLS certificate) up front and tells you exactly what's missing. See [UI Playwright E2E Tests](eng/testing/README.md#ui-playwright-e2e-tests) for full options, what each step does, and troubleshooting. CI runs this same script against both `pgsql` and `mssql` via a matrix in `.github/workflows/run-e2e-ui.yml`.

If the stack is already running (e.g. via `eng/helpers/start-services-target.ps1`), you can run the suite directly:

```bash
npm run test:e2e:bdd
```

## Contributing

### Commit Message Format

Use semantic commit messages for automated versioning (see `release.config.mjs`):

- `feat:` / `feature:` - New features (minor version bump)
- `fix:` - Bug fixes (patch version bump)
- `docs:` - Documentation updates (no version bump)
- `refactor:` - Code improvements (patch version bump)
- `perf:` / `performance:` - Performance improvements (patch version bump)
- `test:` - Test updates (no version bump)
- `chore:` - Maintenance tasks (no version bump)
- `build:` / `ci:` - Build system or CI changes (no version bump)

### Pull Request Process

1. Create feature branch from `main`
2. Use semantic commit messages
3. Include unit tests for new functionality
4. Update documentation as needed
5. Ensure all checks pass
