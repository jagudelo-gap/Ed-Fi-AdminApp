# Test Execution Guide

This document provides comprehensive guidance for executing tests across all levels of the Ed-Fi Admin App testing pyramid.

## 🎯 Quick Reference

| Test Type | Command | Duration | When to Run |
|-----------|---------|----------|-------------|
| **Unit Tests** | `npm run test:fe` / `npm run test:api` | 2-5 min | Every commit |
| **Integration Tests** | `npm run test:integration` | 5-10 min | Before PR |
| **E2E Tests** | `npm run test:e2e` | 10-15 min | Before merge |
| **API Tests** | `npm run bruno:test:local` | 3-5 min | API changes |
| **Visual Tests** | `npm run test:visual` | 5-8 min | UI changes |
| **Accessibility Tests** | `npm run test:accessibility` | 2-3 min | UI changes |
| **Performance Tests** | `npm run performance:test` | 10-30 min | Release prep |

## 🏗️ Environment Setup

### Prerequisites
```bash
# Install dependencies
npm ci --legacy-peer-deps

# Install Playwright browsers (for E2E testing)
npx playwright install

# Install Bruno CLI (for API testing)
npm install -g @usebruno/cli

# Start test environment
docker-compose -f compose/adminapp-services.yml up -d
```

### Environment Verification
```bash
# Verify frontend is running
curl -f http://localhost:4200

# Verify backend API is healthy
curl -f http://localhost:5000/health

# Verify Ed-Fi API is accessible
curl -f http://localhost:5443/health
```

## 📋 Test Execution Procedures

### 1. Unit Testing

#### Frontend Unit Tests
```bash
# Run all frontend unit tests
npm run test:fe

# Run with coverage
npm run test:fe -- --coverage

# Watch mode for development
npm run test:fe -- --watch

# Run specific test file
npm run test:fe -- VendorForm.test.tsx

# Debug mode
npm run test:fe -- --runInBand --detectOpenHandles
```

#### Backend Unit Tests
```bash
# Run all backend unit tests  
npm run test:api

# Run with coverage
npm run test:api -- --coverage

# Run specific test suite
npm run test:api -- --testNamePattern="VendorService"

# Run tests related to specific file
npm run test:api -- --findRelatedTests src/vendors/vendor.service.ts
```

### 2. Integration Testing

#### Database Integration Tests
```bash
# Ensure PostgreSQL is running
docker run --name test-postgres -e POSTGRES_PASSWORD=test -d -p 5432:5432 postgres:16

# Run integration tests
npm run test:integration

# Run specific integration test
npm run test:integration -- --testNamePattern="Vendor API Integration"
```

#### API Integration Tests
```bash
# Start full test environment
docker-compose -f compose/test-environment.yml up -d

# Wait for services to be ready
npm run wait-for-services

# Run API integration tests
npm run test:api:integration
```

### 3. End-to-End Testing

#### Playwright E2E Tests
```bash
# Run all E2E tests (headless)
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/environment-management.spec.ts

# Run tests in specific browser
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit

# Debug mode
npx playwright test --debug

# Run tests with trace
npx playwright test --trace on
```

#### Cross-Browser Testing
```bash
# Run on all browsers
npx playwright test --project=chromium --project=firefox --project=webkit

# Mobile testing
npx playwright test --project="Mobile Chrome" --project="Mobile Safari"

# Headed mode for debugging
npx playwright test --headed
```

### 4. API Testing with Bruno

#### Local Environment Testing
```bash
# Run all Bruno tests against local environment
bru run bruno-collections --env local

# Run specific collection
bru run bruno-collections/admin-api-v1 --env local

# Run with output to file
bru run bruno-collections --env local --output results.json
```

#### Docker Environment Testing
```bash
# Ensure Docker environment is running
docker-compose -f compose/adminapp-services.yml up -d

# Run Bruno tests against Docker environment
bru run bruno-collections --env docker

# Run with verbose output
bru run bruno-collections --env docker --verbose
```

#### Staging Environment Testing
```bash
# Run tests against staging (read-only tests)
bru run bruno-collections --env staging --folder read-only-tests
```

### 5. Visual Regression Testing

```bash
# Generate baseline screenshots
npx playwright test --grep "visual" --update-snapshots

# Run visual regression tests
npx playwright test --grep "visual"

# Update specific screenshots
npx playwright test tests/dashboard.visual.spec.ts --update-snapshots

# Compare with threshold
npx playwright test --grep "visual" --config=playwright.visual.config.ts
```

### 6. Accessibility Testing

```bash
# Run all accessibility tests
npx playwright test --grep "accessibility"

# Run accessibility audit on specific page
npx playwright test tests/accessibility.spec.ts --grep "dashboard"

# Generate accessibility report
npm run test:accessibility -- --reporter=html
```

### 7. Performance Testing

#### Frontend Performance
```bash
# Run Lighthouse CI
npm run lighthouse:ci

# Run performance tests
npm run test:performance

# Generate performance report
npm run performance:report
```

#### Backend Load Testing
```bash
# Run load tests with Artillery
artillery run performance-tests/load-test.yml

# Run stress tests
artillery run performance-tests/stress-test.yml

# Custom target and duration
artillery run performance-tests/load-test.yml --target=http://localhost:5000 --duration=300
```

## 📊 Test Result Interpretation

### Coverage Reports

#### Frontend Coverage
```bash
# Generate and open coverage report
npm run test:fe -- --coverage
open coverage/lcov-report/index.html
```

**Coverage Targets:**
- **Statements**: > 85%
- **Branches**: > 85%  
- **Functions**: > 85%
- **Lines**: > 85%

#### Backend Coverage
```bash
# Generate coverage report
npm run test:api -- --coverage
open coverage/lcov-report/index.html
```

**Coverage Targets:**
- **Statements**: > 80%
- **Branches**: > 80%
- **Functions**: > 80%
- **Lines**: > 80%

### Test Execution Reports

#### Playwright Reports
```bash
# Open HTML test report
npx playwright show-report

# View trace for specific test
npx playwright show-trace trace.zip
```

#### Jest Reports
```bash
# Generate JUnit XML report
npm run test:fe -- --reporters=jest-junit

# Generate JSON report
npm run test:api -- --json --outputFile=test-results.json
```

## 🚨 Troubleshooting

### Common Issues

#### 1. Port Conflicts
```bash
# Kill processes on specific ports
lsof -ti:4200 | xargs kill -9  # Frontend
lsof -ti:5000 | xargs kill -9  # Backend API
lsof -ti:5432 | xargs kill -9  # PostgreSQL
```

#### 2. Docker Issues
```bash
# Clean up Docker environment
docker-compose down --volumes --remove-orphans
docker system prune -f

# Restart Docker services
docker-compose -f compose/adminapp-services.yml down
docker-compose -f compose/adminapp-services.yml up -d --force-recreate
```

#### 3. Test Database Issues
```bash
# Reset test database
npm run migrations:revert
npm run migrations:run
npm run test:seed
```

#### 4. Browser Issues (Playwright)
```bash
# Reinstall browsers
npx playwright install --force

# Clear browser data
npx playwright test --project=chromium --headed --browser-cleanup
```

#### 5. Flaky Tests
```bash
# Run test multiple times to identify flakiness
npx playwright test tests/flaky-test.spec.ts --repeat-each=10

# Run with increased timeout
npx playwright test --timeout=60000

# Run in serial mode
npx playwright test --workers=1
```

### Performance Issues

#### Slow Test Execution
```bash
# Run tests in parallel
npm run test:fe -- --maxWorkers=4
npx playwright test --workers=4

# Profile test execution
npm run test:api -- --detectOpenHandles --forceExit

# Use test sharding
npx playwright test --shard=1/3
```

#### Memory Issues
```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Run tests with garbage collection
npm run test:fe -- --expose-gc --logHeapUsage
```

## 🔄 CI/CD Integration

### GitHub Actions Execution

Tests run automatically in GitHub Actions on:
- **Every push** to main/patch branches
- **Every pull request** 
- **Manual workflow dispatch**

#### Viewing Results
1. Navigate to **Actions** tab in GitHub
2. Select the workflow run
3. Review job results and artifacts
4. Download test reports and coverage data

#### Manual Workflow Trigger
```bash
# Trigger workflows manually via GitHub CLI
gh workflow run "On Pull Request" --ref feature-branch
```

### Local CI Simulation
```bash
# Run the same tests as CI locally
npm run ci:test

# Simulate PR checks
npm run pr:check

# Full release validation
npm run release:validate
```

## 📈 Test Metrics & Monitoring

### Key Metrics to Track

#### Test Execution Metrics
- **Total test count**: Unit + Integration + E2E
- **Test execution time**: Per test type and overall
- **Pass/fail rates**: Historical trend analysis
- **Flaky test percentage**: < 1% target

#### Coverage Metrics
- **Code coverage percentage**: By package and overall
- **Coverage trend**: Increasing over time
- **Uncovered critical paths**: High-priority areas

#### Performance Metrics
- **API response times**: Baseline and regression detection  
- **Page load times**: Frontend performance tracking
- **Memory usage**: Resource consumption monitoring

### Reporting Dashboard

Test results are automatically reported to:
- **GitHub Actions**: Job summaries and artifacts
- **Codecov**: Coverage reporting and trends
- **Test reports**: HTML reports with detailed results

## 🎯 Best Practices

### Test Execution Guidelines

1. **Run tests frequently**: Unit tests on every change
2. **Use appropriate test types**: Match test to purpose
3. **Monitor test performance**: Keep execution times reasonable
4. **Review failures promptly**: Don't let flaky tests accumulate
5. **Maintain test data**: Keep test fixtures up to date

### Quality Assurance

1. **Code coverage**: Maintain target thresholds
2. **Test isolation**: Each test should be independent
3. **Clear assertions**: Tests should have obvious pass/fail criteria
4. **Descriptive names**: Test names should explain the scenario
5. **Regular maintenance**: Remove obsolete tests, update scenarios

This execution guide ensures consistent, reliable test execution across all environments and team members.

> [!TIP]
> Some scenarios may change depending on future changes planned for the application.

# Admin App FrontEnd

> [!TIP]
> Execution and management for this first release will be done in a shared Excel spreadsheet.
