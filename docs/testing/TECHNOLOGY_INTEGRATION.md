# Testing Technologies Integration Guide

This document provides detailed guidance on integrating Bruno and Playwright MCP into the Ed-Fi Admin App testing strategy, along with other modern testing technologies.

## Bruno Integration for API Testing

Bruno is a fast, git-friendly, open-source API client that allows for version-controlled API testing. It provides an excellent alternative to Postman for team-based API testing.

### Why Bruno for Ed-Fi Admin App

1. **Version Control Native** - Test collections stored in git alongside code
2. **Environment Management** - Multiple deployment targets (local, staging, production)
3. **Offline First** - Works without cloud dependencies
4. **Script Support** - Pre/post request scripting for complex scenarios
5. **Team Collaboration** - No account requirements, works locally

### Bruno Collection Structure

```
bruno-collections/
├── environments/
│   ├── local.bru               # Local development environment
│   ├── docker.bru              # Docker compose environment  
│   ├── staging.bru             # Staging environment
│   └── production.bru          # Production environment (read-only tests)
├── auth/
│   ├── keycloak-login.bru      # OIDC authentication flow
│   ├── machine-user-auth.bru   # M2M authentication
│   └── token-refresh.bru       # Token renewal
├── admin-api-v1/
│   ├── healthcheck.bru         # Health monitoring
│   ├── vendors/
│   │   ├── create-vendor.bru   # POST /vendors
│   │   ├── list-vendors.bru    # GET /vendors
│   │   ├── get-vendor.bru      # GET /vendors/:id
│   │   ├── update-vendor.bru   # PUT /vendors/:id
│   │   └── delete-vendor.bru   # DELETE /vendors/:id
│   ├── applications/
│   │   ├── create-application.bru
│   │   ├── list-applications.bru
│   │   ├── get-application.bru
│   │   ├── update-application.bru
│   │   └── delete-application.bru
│   ├── claimsets/
│   │   ├── create-claimset.bru
│   │   ├── list-claimsets.bru
│   │   ├── get-claimset.bru
│   │   ├── update-claimset.bru
│   │   └── delete-claimset.bru
│   └── ods-instances/
│       ├── create-ods-instance.bru
│       ├── list-ods-instances.bru
│       ├── get-ods-instance.bru
│       ├── update-ods-instance.bru
│       └── delete-ods-instance.bru
├── admin-api-v2/
│   └── [future v2 endpoints]
├── integration-tests/
│   ├── vendor-application-flow.bru    # Multi-step workflows
│   ├── tenant-management-flow.bru
│   └── certification-scenarios.bru
└── data/
    ├── test-vendors.json          # Test data sets
    ├── test-applications.json
    └── certification-data.json
```

### Environment Configuration Example

**Local Environment (local.bru):**
```javascript
vars {
  base_url: http://localhost:3000
  admin_api_url: http://localhost:5000
  keycloak_url: http://localhost:8080
  client_id: adminapp-local
  client_secret: local-secret
  username: admin@localhost
  password: admin123
}
```

**Docker Environment (docker.bru):**
```javascript
vars {
  base_url: http://localhost:4200
  admin_api_url: http://localhost:5443
  keycloak_url: http://localhost:8080
  client_id: adminapp-docker
  client_secret: docker-secret
  username: testuser@example.com
  password: Test123!
}
```

### Authentication Flow Implementation

**Keycloak Authentication (keycloak-login.bru):**
```javascript
meta {
  name: Keycloak OIDC Login
  type: http
  seq: 1
}

post {
  url: {{keycloak_url}}/realms/edfi/protocol/openid-connect/token
  body: formUrlEncoded
  auth: none
}

body:form-urlencoded {
  grant_type: password
  client_id: {{client_id}}
  client_secret: {{client_secret}}
  username: {{username}}
  password: {{password}}
  scope: openid profile email edfi_admin_api/full_access
}

script:post-response {
  if (res.status === 200) {
    bru.setVar("access_token", res.body.access_token);
    bru.setVar("refresh_token", res.body.refresh_token);
    bru.setVar("token_expires", Date.now() + (res.body.expires_in * 1000));
  }
}

tests {
  test("should authenticate successfully", function() {
    expect(res.status).to.equal(200);
    expect(res.body.access_token).to.be.a('string');
  });
}
```

### API Test Implementation Example

**Create Vendor Test (create-vendor.bru):**
```javascript
meta {
  name: Create Vendor
  type: http
  seq: 2
}

post {
  url: {{admin_api_url}}/api/teams/{{team_id}}/edfi-tenants/{{tenant_id}}/admin-api/v1/vendors
  body: json
  auth: bearer
}

auth:bearer {
  token: {{access_token}}
}

body:json {
  {
    "vendorName": "{{$randomCompanyName}}",
    "namespacePrefixes": ["uri://ed-fi.org/", "uri://example.org/"],
    "contactName": "{{$randomFullName}}",
    "contactEmailAddress": "{{$randomEmail}}"
  }
}

script:pre-request {
  // Ensure authentication token is valid
  if (!bru.getVar("access_token") || Date.now() > bru.getVar("token_expires")) {
    bru.sendRequest("auth/keycloak-login");
  }
}

script:post-response {
  if (res.status === 201) {
    bru.setVar("created_vendor_id", res.body.vendorId);
    bru.setVar("created_vendor_name", res.body.vendorName);
  }
}

tests {
  test("should create vendor successfully", function() {
    expect(res.status).to.equal(201);
    expect(res.body.vendorId).to.be.a('number');
    expect(res.body.vendorName).to.equal(req.body.vendorName);
  });

  test("should return valid vendor object", function() {
    expect(res.body).to.have.property('vendorId');
    expect(res.body).to.have.property('vendorName');
    expect(res.body).to.have.property('namespacePrefixes');
    expect(res.body.namespacePrefixes).to.be.an('array');
  });
}
```

### Data-Driven Testing with Bruno

**Vendor Data File (data/test-vendors.json):**
```json
[
  {
    "vendorName": "Test Education Solutions",
    "namespacePrefixes": ["uri://testedu.org/"],
    "contactName": "John Doe",
    "contactEmailAddress": "john.doe@testedu.org"
  },
  {
    "vendorName": "Ed-Fi Sample Vendor",
    "namespacePrefixes": ["uri://sample.ed-fi.org/", "uri://extensions.ed-fi.org/"],
    "contactName": "Jane Smith", 
    "contactEmailAddress": "jane.smith@ed-fi.org"
  }
]
```

## Playwright MCP Integration

Playwright MCP (Model Context Protocol) provides advanced automation capabilities for end-to-end testing with AI-enhanced test generation and maintenance.

### Why Playwright MCP for Ed-Fi Admin App

1. **Chrome Browser Testing** - Chromium-based testing for consistency
2. **AI Test Generation** - Automated test creation from user interactions
3. **Visual Regression** - Screenshot-based UI testing
4. **Accessibility Testing** - Built-in accessibility checks
5. **Parallel Execution** - Fast test execution across multiple workers

### Playwright Configuration

**playwright.config.ts:**
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['github']
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4200',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run start',
    url: 'http://localhost:4200',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Test Structure and Page Object Model

**Base Page Object:**
```typescript
// e2e/pages/base-page.ts
import { Page, Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly navigation: Locator;
  readonly userMenu: Locator;
  readonly loadingSpinner: Locator;

  constructor(page: Page) {
    this.page = page;
    this.navigation = page.getByTestId('main-navigation');
    this.userMenu = page.getByTestId('user-menu');
    this.loadingSpinner = page.getByTestId('loading-spinner');
  }

  async waitForLoad() {
    await this.loadingSpinner.waitFor({ state: 'hidden' });
  }

  async navigateTo(section: string) {
    await this.navigation.getByRole('link', { name: section }).click();
    await this.waitForLoad();
  }

  async logout() {
    await this.userMenu.click();
    await this.page.getByRole('button', { name: 'Logout' }).click();
  }
}
```

**Authentication Helper:**
```typescript
// e2e/utils/auth.ts
import { Page } from '@playwright/test';

export class AuthHelper {
  static async login(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Login' }).click();
    
    // Handle Keycloak redirect
    await page.waitForURL('**/auth/**');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    
    // Wait for redirect back to app
    await page.waitForURL('/dashboard');
  }

  static async setupAuthenticatedContext(page: Page) {
    await this.login(page, 'admin@example.com', 'Admin123!');
    
    // Save authentication state
    await page.context().storageState({ path: 'auth.json' });
  }
}
```

**Environment Management Page Object:**
```typescript
// e2e/pages/environments-page.ts
import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './base-page';

export class EnvironmentsPage extends BasePage {
  readonly addEnvironmentButton: Locator;
  readonly environmentNameInput: Locator;
  readonly edfiApiUrlInput: Locator;
  readonly adminApiUrlInput: Locator;
  readonly saveButton: Locator;
  readonly cancelButton: Locator;
  readonly environmentsTable: Locator;

  constructor(page: Page) {
    super(page);
    this.addEnvironmentButton = page.getByTestId('add-environment');
    this.environmentNameInput = page.getByTestId('environment-name');
    this.edfiApiUrlInput = page.getByTestId('edfi-api-url');
    this.adminApiUrlInput = page.getByTestId('admin-api-url');
    this.saveButton = page.getByTestId('save-environment');
    this.cancelButton = page.getByTestId('cancel-environment');
    this.environmentsTable = page.getByTestId('environments-table');
  }

  async goto() {
    await this.page.goto('/environments');
    await this.waitForLoad();
  }

  async createEnvironment(environment: {
    name: string;
    edfiApiUrl: string;
    adminApiUrl: string;
    label: string;
  }) {
    await this.addEnvironmentButton.click();
    await this.environmentNameInput.fill(environment.name);
    await this.edfiApiUrlInput.fill(environment.edfiApiUrl);
    await this.adminApiUrlInput.fill(environment.adminApiUrl);
    await this.saveButton.click();
    
    // Wait for success message or redirect
    await expect(this.page.getByText('Environment created successfully')).toBeVisible();
  }

  async getEnvironmentByName(name: string) {
    return this.environmentsTable.getByRole('row').filter({ hasText: name });
  }

  async deleteEnvironment(name: string) {
    const row = await this.getEnvironmentByName(name);
    await row.getByTestId('delete-environment').click();
    await this.page.getByTestId('confirm-delete').click();
  }
}
```

### Comprehensive E2E Test Example

**Environment Management Tests:**
```typescript
// e2e/tests/environment-management.spec.ts
import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth';
import { EnvironmentsPage } from '../pages/environments-page';

test.describe('Environment Management', () => {
  let environmentsPage: EnvironmentsPage;

  test.beforeEach(async ({ page }) => {
    await AuthHelper.login(page, 'admin@example.com', 'Admin123!');
    environmentsPage = new EnvironmentsPage(page);
    await environmentsPage.goto();
  });

  test('should create new environment successfully', async ({ page }) => {
    const environmentData = {
      name: 'Test Environment',
      edfiApiUrl: 'https://localhost:5443/v7-api',
      adminApiUrl: 'https://localhost:5443/v7-adminapi',
      label: 'testing'
    };

    await environmentsPage.createEnvironment(environmentData);
    
    // Verify environment appears in table
    const environmentRow = await environmentsPage.getEnvironmentByName(environmentData.name);
    await expect(environmentRow).toBeVisible();
    
    // Verify environment details
    await expect(environmentRow).toContainText(environmentData.edfiApiUrl);
    await expect(environmentRow).toContainText('testing');
  });

  test('should validate required fields', async ({ page }) => {
    await environmentsPage.addEnvironmentButton.click();
    await environmentsPage.saveButton.click();
    
    // Check validation errors
    await expect(page.getByText('Environment name is required')).toBeVisible();
    await expect(page.getByText('Ed-Fi API URL is required')).toBeVisible();
    await expect(page.getByText('Admin API URL is required')).toBeVisible();
  });

  test('should handle API connection errors gracefully', async ({ page }) => {
    const invalidEnvironment = {
      name: 'Invalid Environment',
      edfiApiUrl: 'https://invalid.url:9999/api',
      adminApiUrl: 'https://invalid.url:9999/adminapi',
      label: 'testing'
    };

    await environmentsPage.createEnvironment(invalidEnvironment);
    
    // Should show connection error
    await expect(page.getByText('Unable to connect to Ed-Fi API')).toBeVisible();
  });

  test('should search and filter environments', async ({ page }) => {
    // Create multiple environments for testing
    await environmentsPage.createEnvironment({
      name: 'Production Environment',
      edfiApiUrl: 'https://prod.example.com/api',
      adminApiUrl: 'https://prod.example.com/adminapi',
      label: 'production'
    });

    // Test search functionality
    await page.getByTestId('environment-search').fill('Production');
    await expect(environmentsPage.environmentsTable).toContainText('Production Environment');
    await expect(environmentsPage.environmentsTable).not.toContainText('Test Environment');

    // Test filter functionality
    await page.getByTestId('environment-filter').selectOption('production');
    await expect(environmentsPage.environmentsTable).toContainText('Production Environment');
  });
});
```

### Visual Regression Testing

**Visual Tests Configuration:**
```typescript
// e2e/tests/visual-regression.spec.ts
import { test, expect } from '@playwright/test';
import { AuthHelper } from '../utils/auth';

test.describe('Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    await AuthHelper.login(page, 'admin@example.com', 'Admin123!');
  });

  test('dashboard page layout', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Take full page screenshot
    await expect(page).toHaveScreenshot('dashboard-full-page.png');
    
    // Take component screenshots
    await expect(page.getByTestId('environment-summary')).toHaveScreenshot('environment-summary.png');
    await expect(page.getByTestId('recent-activities')).toHaveScreenshot('recent-activities.png');
  });

  test('responsive layout at smaller viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/environments');
    await page.waitForLoadState('networkidle');
    
    await expect(page).toHaveScreenshot('environments-tablet.png');
  });

  test('dark mode theme', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Switch to dark mode
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(500); // Wait for theme transition
    
    await expect(page).toHaveScreenshot('dashboard-dark-mode.png');
  });
});
```

### Accessibility Testing Integration

**Accessibility Tests:**
```typescript
// e2e/tests/accessibility.spec.ts
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('dashboard should be accessible', async ({ page }) => {
    await page.goto('/dashboard');
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('environment form should be accessible', async ({ page }) => {
    await page.goto('/environments');
    await page.getByTestId('add-environment').click();
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .include('[data-testid="environment-form"]')
      .analyze();
    
    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('keyboard navigation should work', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Environments' })).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Teams' })).toBeFocused();
    
    // Test Enter key activation
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('/teams');
  });
});
```

## GitHub Actions Integration

### Updated Workflow for Testing

**Enhanced Testing Workflow (.github/workflows/comprehensive-testing.yml):**
```yaml
name: Comprehensive Testing

on:
  push:
    branches: [main, "patch-v*"]
  pull_request:
    branches: [main, "patch-v*"]

concurrency:
  group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  unit-tests:
    name: Unit Tests (${{ matrix.package }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        package: [fe, api, models-server, utils]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Run unit tests with coverage
        run: npm run test:${{ matrix.package }} -- --coverage --watchAll=false
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          flags: ${{ matrix.package }}

  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Run database migrations
        run: npm run migrations:run
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/testdb
      
      - name: Run integration tests
        run: npm run test:integration

  bruno-api-tests:
    name: Bruno API Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      
      - name: Install Bruno CLI
        run: npm install -g @usebruno/cli
      
      - name: Start test environment
        run: docker-compose -f compose/adminapp-services.yml up -d
      
      - name: Wait for services
        run: |
          timeout 300 bash -c 'until curl -f http://localhost:5000/health; do sleep 5; done'
      
      - name: Run Bruno tests
        run: bru run bruno-collections --env docker
      
      - name: Upload test results
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: bruno-test-results
          path: bruno-collections/results/

  playwright-e2e-tests:
    name: Playwright E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Install Playwright Browsers
        run: npx playwright install chromium --with-deps
      
      - name: Start application
        run: npm run start &
        
      - name: Wait for application
        run: npx wait-on http://localhost:4200
      
      - name: Run Playwright tests
        run: npx playwright test
      
      - name: Upload Playwright report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/

  visual-regression-tests:
    name: Visual Regression Tests
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Install Playwright
        run: npx playwright install chromium
      
      - name: Run visual regression tests
        run: npx playwright test --grep "visual" --project=chromium
      
      - name: Upload visual differences
        uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: visual-regression-diffs
          path: test-results/

  accessibility-tests:
    name: Accessibility Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci --legacy-peer-deps
      
      - name: Install Playwright
        run: npx playwright install chromium
      
      - name: Run accessibility tests
        run: npx playwright test --grep "accessibility" --project=chromium
      
      - name: Upload accessibility report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: accessibility-report
          path: accessibility-results/
```

This comprehensive testing technology integration provides the Ed-Fi Admin App with modern, reliable, and maintainable testing infrastructure that supports rapid development cycles while ensuring quality.
