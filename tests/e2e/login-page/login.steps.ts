// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'
import { routes } from '../core/routes'
import LoginPage from '../pages/login-page'

const { Given, When, Then } = createBdd()

let loginPage: LoginPage

Given('the user is on login page', async ({ page }) => {
  loginPage = new LoginPage(page)
  await page.goto(routes.home)
  await page.waitForLoadState('networkidle', { timeout: 35000 })
})

When('the user clicks on Login button in the right corner', async () => {
  await loginPage.clickLoginCornerButton()
})

When('the user clicks on Login button', async () => {
  await loginPage.clickLoginMainButton()
})

When('the user clicks on Learn more button', async () => {
  await loginPage.clickOnLearningMoreButton()
})

When('the user clicks on report an issue', async () => {
  await loginPage.clickOnReportIssue()
})

When('the user review the footer page', async () => {
  await loginPage.reviewFooter()
})

Then('page should be redirect to keycloak login page', async ({ page }) => {
  await expect(page).toHaveURL(/\/auth\/realms\/edfi\/protocol\/openid-connect\/auth/)
})

Then('page should be redirect to education analytics page', async () => {
  await loginPage.referencePageIsLoaded()
})

Then('the community page should be opened', async () => {
  await loginPage.communityPageIsLoaded()
})

Then('the years shown must match the year of creation and the current year', async () => {
  await loginPage.footerYearsMatch()
})
