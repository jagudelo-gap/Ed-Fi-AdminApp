// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { Page, expect } from '@playwright/test'

class AccountPage {

  private readonly accountNavOption
  private readonly usernameDisplay
  private readonly userRoleDisplay
  private readonly accountManagementDisplay

  constructor(private readonly page: Page) {
    this.accountNavOption = this.page.locator('a[title="Account"]')
    this.usernameDisplay = this.page.locator('//*[@id="borderGlobal"]/main/div[2]/div/div[2]/div[1]/div/div[2]/div/div/div[1]/div/span')
    this.userRoleDisplay = this.page.locator('//*[@id="borderGlobal"]/main/div[2]/div/div[2]/div[1]/div/div[2]/div/div/div[2]/div/span')
    this.accountManagementDisplay = this.page.locator('//*[@id="borderGlobal"]/main/div[2]/div/div[2]/div[1]/div/div[2]/div/div/div[3]/a')
  }

  async clickAccountOption() {
    await this.accountNavOption.click()
  }

  async userInformationIsDisplayed() {
    await expect(this.usernameDisplay).toBeVisible()
    await expect(this.userRoleDisplay).toBeVisible()
    await expect(this.accountManagementDisplay).toBeVisible()
  }

  async containsUsernameRoleAndAccountManagement(
    expectedUsername: string,
    expectedRole: string,
    expectedAccountManagement: string
  ) {
    const usernameText = await this.usernameDisplay.textContent()
    const roleText = await this.userRoleDisplay.textContent()
    const accountManagementText = await this.accountManagementDisplay.textContent()

    expect(usernameText?.trim()).toContain(expectedUsername)
    expect(roleText?.trim()).toContain(expectedRole)
    expect(accountManagementText?.trim()).toContain(expectedAccountManagement)
  }
}

export default AccountPage
