// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import HomePage from '../pages/home-page'
import { routes } from '../core/routes'

const { Given, When, Then } = createBdd()

let homePage: HomePage

Given('the user is logged with a valid user', async ({ page }) => {
  await page.goto(routes.home)
  homePage = new HomePage(page)
})

When(/^the user click on (.+) on Home option$/, async ({}, option: string) => {
  await homePage.clickHomeOption(option)
})

Then('the main page should be loaded', async () => {
  await homePage.homePageIsLoaded()
})

Then('a welcome message displayed', async () => {
  await homePage.welcomeMessageIsDisplayed()
})
