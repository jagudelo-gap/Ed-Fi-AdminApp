# E2E Tests

BDD end-to-end tests using [playwright-bdd](https://github.com/vitalets/playwright-bdd) and [Allure](https://allurereport.org/).

## Commands

### Run All the Tests

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test
```

### Run one test or specific .feature file

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test teams.feature
npx bddgen --config=./playwright.config.ts && npx playwright test -g "Delete Team"
```

### Run Tests in Debug Mode

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test --debug
```

### Run Tests in Headed Mode

```bash
npx bddgen --config=./playwright.config.ts && npx playwright test --headed
```

### Generate and Open Allure Report

```bash
npx allure open test-results/allure-results
```

## Structure

```
tests/e2e/
├── core/              # Shared routes and constants
├── pages/             # Page Object Models (POMs)
├── login-page/        # Login feature and step definitions
├── main-page/         # Home page feature and step definitions
└── .features-gen/     # Auto-generated test specs (do not edit)
```

## Notes

- Feature files (`*.feature`) define scenarios using Gherkin syntax.
- Step definitions (`*.steps.ts`) implement the Given/When/Then steps.
- `bddgen` must run before `playwright test` to regenerate specs from feature files.
- Allure results are written to `test-results/allure-results` after each test run.
