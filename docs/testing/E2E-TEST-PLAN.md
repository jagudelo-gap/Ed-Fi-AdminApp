# End-to-End Testing Plan for Ed-Fi Admin App 4.0

## Executive Summary

This document outlines a comprehensive E2E testing strategy for Ed-Fi Admin App 4.0, recommending Playwright as the primary testing framework and defining critical testing paths to ensure system reliability and user experience quality.

## Framework Selection Analysis

### Playwright vs Jest for E2E Testing

| Criteria | Playwright | Jest |
|----------|------------|------|
| **Browser Automation** | ✅ Native support for Chrome, Firefox, Safari, Edge | ❌ Requires additional tools (Puppeteer/Selenium) |
| **Auto-waiting** | ✅ Built-in smart waiting for elements | ❌ Manual waits required |
| **Network Interception** | ✅ Built-in API mocking and network control | ⚠️ Limited, requires additional setup |
| **Parallel Execution** | ✅ Built-in parallel test execution | ⚠️ Limited parallel capabilities for E2E |
| **Visual Testing** | ✅ Screenshot comparison and visual regression | ❌ Not supported natively |
| **Mobile Testing** | ✅ Device emulation built-in | ❌ Limited mobile testing support |
| **Debugging** | ✅ Trace viewer, video recording, step-by-step debugging | ⚠️ Basic debugging for E2E scenarios |
| **Learning Curve** | ⚠️ Moderate - new for team | ✅ Already familiar to team |

### **Recommendation: Playwright**

**Rationale:**
- Superior browser automation capabilities
- Better suited for modern web application testing
- Excellent developer experience with debugging tools
- Strong community and Microsoft backing
- Future-proof technology stack

## Critical Code Paths Identification

### 1. Authentication & Authorization Flow

```typescript
// Priority: HIGH
// Frequency: Every user session
// Risk: Application unusable if broken

describe('Authentication Flow', () => {
  test('User can login with valid credentials', async ({ page }) => {
    // Navigate to login page
    // Enter valid credentials (demo/123)
    // Verify successful redirect to dashboard
    // Verify user context is established
  });

  test('User cannot access protected routes without authentication', async ({ page }) => {
    // Attempt to access protected route directly
    // Verify redirect to login page
    // Verify appropriate error messaging
  });

  test('User session expires appropriately', async ({ page }) => {
    // Login successfully
    // Wait for session timeout
    // Verify automatic logout
    // Verify redirect to login page
  });
});
```

### 2. Environment Management

```typescript
// Priority: HIGH
// Core functionality of Admin App

describe('Environment Management', () => {
  test('Create new environment configuration', async ({ page }) => {
    // Navigate to environments page
    // Click create environment
    // Fill required fields (name, API URL, credentials)
    // Submit form
    // Verify environment appears in list
  });

  test('Connect to existing environment', async ({ page }) => {
    // Select environment from list
    // Click connect button
    // Verify connection status updates
    // Verify access to environment-specific features
  });

  test('Edit environment configuration', async ({ page }) => {
    // Select existing environment
    // Click edit button
    // Modify configuration fields
    // Save changes
    // Verify updates are persisted
  });
});
```

### 3. Multi-Tenant Operations

```typescript
// Priority: HIGH
// Critical for Ed-Fi multi-tenant scenarios

describe('Multi-Tenant Operations', () => {
  test('Switch between tenants', async ({ page }) => {
    // Login to environment with multiple tenants
    // Verify tenant selector is available
    // Switch to different tenant
    // Verify data context changes
    // Verify UI updates appropriately
  });

  test('Tenant data isolation', async ({ page }) => {
    // Access tenant A
    // Create resource (vendor, application, etc.)
    // Switch to tenant B
    // Verify resource is not visible
    // Verify separate data contexts
  });
});
```

### 4. Admin API Integration

```typescript
// Priority: MEDIUM-HIGH
// Core CRUD operations

describe('Admin API Integration', () => {
  test('Vendor management workflow', async ({ page }) => {
    // Navigate to vendors section
    // Create new vendor
    // Edit vendor details
    // Verify vendor appears in listing
    // Delete vendor
    // Verify vendor removed from listing
  });

  test('Application management workflow', async ({ page }) => {
    // Create vendor first
    // Navigate to applications
    // Create application linked to vendor
    // Configure application settings
    // Test application functionality
  });

  test('Claim set operations', async ({ page }) => {
    // Navigate to claim sets
    // Create custom claim set
    // Configure permissions
    // Assign to application
    // Verify permissions work correctly
  });
});
```

### 5. Error Handling & Edge Cases

```typescript
// Priority: MEDIUM
// Ensures robust user experience

describe('Error Handling', () => {
  test('Handles API server unavailable', async ({ page }) => {
    // Mock API server failure
    // Attempt operations
    // Verify appropriate error messages
    // Verify graceful degradation
  });

  test('Handles network connectivity issues', async ({ page }) => {
    // Simulate network interruption
    // Verify offline behavior
    // Verify recovery when network restored
  });

  test('Handles invalid form submissions', async ({ page }) => {
    // Submit forms with invalid data
    // Verify validation messages
    // Verify form state preservation
  });
});
```

## Implementation Architecture

### Project Structure

```
e2e/
├── config/
│   └── playwright.config.ts          # Playwright configuration
├── fixtures/
│   ├── test-data.ts                  # Test data and constants
│   └── database-setup.ts             # Database seeding utilities
├── pages/
│   ├── base.page.ts                  # Base page object class
│   ├── login.page.ts                 # Login page object
│   ├── dashboard.page.ts             # Dashboard page object
│   ├── environments.page.ts          # Environment management
│   └── admin-api/
│       ├── vendors.page.ts           # Vendor management
│       ├── applications.page.ts      # Application management
│       └── claimsets.page.ts         # Claim set management
├── utils/
│   ├── auth.helpers.ts               # Authentication utilities
│   ├── api.helpers.ts                # API interaction helpers
│   └── data.helpers.ts               # Test data management
├── specs/
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── session-management.spec.ts
│   ├── environments/
│   │   ├── crud-operations.spec.ts
│   │   └── connection-management.spec.ts
│   ├── multi-tenant/
│   │   └── tenant-switching.spec.ts
│   └── admin-api/
│       ├── vendors.spec.ts
│       ├── applications.spec.ts
│       └── claimsets.spec.ts
└── reports/                          # Test execution reports
```

### Configuration Setup

```typescript
// e2e/config/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '../specs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'results.xml' }],
    ['github']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'npm run start:dev',
    port: 4200,
    reuseExistingServer: !process.env.CI,
  },
});
```

## Existing E2E Directory Migration Strategy

### Current State Assessment

The existing `e2e` directory likely contains:
- Legacy Protractor or Cypress configurations
- Outdated test files
- Different project structure
- Potentially conflicting dependencies

### Migration Approach: Phased Transition

#### Phase 1: Preservation and Backup
```bash
# Create backup of existing e2e directory
git checkout -b backup/legacy-e2e
git add e2e/
git commit -m "Backup legacy e2e tests before Playwright migration"

# Rename existing directory to avoid confusion
mv e2e e2e-legacy
```

#### Phase 2: Parallel Implementation
```bash
# Create new Playwright-based E2E structure
mkdir e2e-playwright
cd e2e-playwright

# Initialize Playwright
npm init playwright@latest
```

#### Phase 3: Gradual Migration
```typescript
// Create migration tracking document
// e2e-migration-status.md

## E2E Test Migration Status

### Completed Migrations
- [ ] Authentication tests
- [ ] Environment management tests
- [ ] Basic navigation tests

### Legacy Tests Analysis
| Test File | Status | Playwright Equivalent | Notes |
|-----------|--------|----------------------|-------|
| login.e2e.ts | ✅ Migrated | auth/login.spec.ts | Updated for new auth flow |
| dashboard.e2e.ts | 🔄 In Progress | dashboard/navigation.spec.ts | Needs page object refactor |
| admin.e2e.ts | ❌ Pending | admin-api/vendors.spec.ts | Complex test, needs breakdown |
```

#### Phase 4: Cleanup and Standardization
```bash
# Once migration complete and validated
rm -rf e2e-legacy

# Rename new directory to standard name
mv e2e-playwright e2e

# Update package.json scripts
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug"
  }
}
```

## Test Data Management

### Environment-Specific Configuration

```typescript
// e2e/fixtures/test-data.ts
export const TestConfig = {
  users: {
    admin: {
      username: process.env.E2E_ADMIN_USER || 'demo',
      password: process.env.E2E_ADMIN_PASS || '123',
    },
    standardUser: {
      username: process.env.E2E_USER || 'testuser',
      password: process.env.E2E_USER_PASS || 'test123',
    }
  },
  environments: {
    test: {
      name: 'E2E Test Environment',
      apiUrl: process.env.E2E_API_URL || 'http://localhost:3333',
      adminApiUrl: process.env.E2E_ADMIN_API_URL || 'http://localhost:5000',
    }
  },
  timeouts: {
    short: 5000,
    medium: 15000,
    long: 30000,
  }
};
```

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main ]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chromium, firefox, webkit]
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps ${{ matrix.browser }}

      - name: Start test environment
        run: |
          docker-compose -f compose/docker-compose.yml up -d
          npx wait-on http://localhost:4200 --timeout 60000

      - name: Run E2E tests
        run: npx playwright test --project=${{ matrix.browser }}
        env:
          BASE_URL: http://localhost:4200
          E2E_ADMIN_USER: demo
          E2E_ADMIN_PASS: 123

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report-${{ matrix.browser }}
          path: playwright-report/
          retention-days: 30

      - name: Stop test environment
        if: always()
        run: docker-compose -f compose/docker-compose.yml down
```

## Test Execution Strategy

### Local Development

```json
// package.json scripts
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:headed": "playwright test --headed",
    "e2e:debug": "playwright test --debug",
    "e2e:smoke": "playwright test --grep '@smoke'",
    "e2e:regression": "playwright test --grep '@regression'",
    "e2e:auth": "playwright test specs/auth/",
    "e2e:report": "playwright show-report"
  }
}
```

### Test Categorization

```typescript
// Use test tags for categorization
test.describe('Authentication @smoke @critical', () => {
  test('successful login @happy-path', async ({ page }) => {
    // Test implementation
  });

  test('invalid credentials @error-handling', async ({ page }) => {
    // Test implementation
  });
});
```

## Monitoring and Reporting

### Test Metrics Dashboard

```typescript
// Custom reporter for metrics collection
class MetricsReporter {
  onTestEnd(test, result) {
    // Collect test execution data
    // Duration, status, browser, etc.
    // Send to monitoring system
  }

  onEnd() {
    // Generate summary metrics
    // Test coverage report
    // Performance benchmarks
  }
}
```

### Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Test Coverage** | 85% of critical paths | Manual assessment of user journeys |
| **Test Reliability** | <5% flaky test rate | Failed tests that pass on retry |
| **Execution Time** | <20 minutes full suite | CI pipeline duration |
| **Browser Coverage** | Chrome, Firefox, Safari | Cross-browser test execution |
| **Mobile Coverage** | Basic responsive testing | Mobile device emulation |

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- ✅ Framework selection and setup
- ✅ Project structure creation
- ✅ CI/CD pipeline configuration
- ✅ Basic page object models

### Phase 2: Core Functionality (Weeks 3-4)
- ✅ Authentication flow tests
- ✅ Environment management tests
- ✅ Basic navigation tests
- ✅ Error handling scenarios

### Phase 3: Advanced Features (Weeks 5-6)
- ✅ Multi-tenant operations
- ✅ Admin API integration tests
- ✅ Performance testing
- ✅ Visual regression tests

### Phase 4: Polish & Production (Weeks 7-8)
- ✅ Legacy test migration completion
- ✅ Documentation and training
- ✅ Production deployment
- ✅ Monitoring and alerting setup

## Risk Mitigation

### Identified Risks

1. **Learning Curve**: Team unfamiliarity with Playwright
   - **Mitigation**: Dedicated training sessions, pair programming
   
2. **Test Flakiness**: Timing-related test failures
   - **Mitigation**: Proper wait strategies, retry mechanisms
   
3. **Maintenance Overhead**: Tests becoming outdated
   - **Mitigation**: Regular review cycles, automated checks
   
4. **Environment Dependencies**: Tests failing due to external systems
   - **Mitigation**: Proper mocking, isolated test environments

## Conclusion

This E2E testing plan provides a comprehensive approach to ensuring Ed-Fi Admin App 4.0 quality through:

- **Modern tooling** with Playwright for superior testing capabilities
- **Critical path coverage** focusing on high-impact user scenarios  
- **Structured migration** from legacy testing approaches
- **CI/CD integration** for continuous quality assurance
- **Comprehensive monitoring** for ongoing test health

The implementation will deliver robust, maintainable E2E tests that provide confidence in application stability and user experience quality.
