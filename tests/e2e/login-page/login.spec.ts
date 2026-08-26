// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import {
  test, Page
} from '@playwright/test'
import { routes } from '../core/routes'
import LoginPage  from '../pages/login-page'

let page: Page
let loginPage: LoginPage

test.describe('Login Page', () => {

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage()
    loginPage = new LoginPage(page)
    await page.goto(routes.home)
    await page.waitForLoadState('networkidle', { timeout: 35000 })
  })

  test('User login page right corner', async () => {
    await loginPage.clickLoginCornerButton()
    await loginPage.loginPageIsLoaded()
  })

  test('User login page', async () => {
    await loginPage.clickLoginMainButton()
    await loginPage.loginPageIsLoaded()
  })

  test('User can go Learn More page', async () => {
    await loginPage.clickOnLearningMoreButton()
    await loginPage.referencePageIsLoaded()
  })

  test('User can report an issue', async () => {
    await loginPage.clickOnReportIssue()
    await loginPage.communityPageIsLoaded()
  })

  test('User footer page', async () => {
    await loginPage.reviewFooter()
    await loginPage.footerYearsMatch()
  })

})
