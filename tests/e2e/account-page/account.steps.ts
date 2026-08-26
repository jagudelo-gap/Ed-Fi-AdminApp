// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import AccountPage from '../pages/account-page'

const { When, Then } = createBdd()

let accountPage: AccountPage

When('the user click on Account option', async ({ page }) => {
  accountPage = new AccountPage(page)
  await accountPage.clickAccountOption()
})

Then('the information from the current user should be displayed', async () => {
  await accountPage.userInformationIsDisplayed()
})

Then(
  /^contains the username (.+) and user role (.+) with account management (.+)$/,
  async ({}, username: string, role: string, accountManagement: string) => {
    await accountPage.containsUsernameRoleAndAccountManagement(username, role, accountManagement)
  }
)
