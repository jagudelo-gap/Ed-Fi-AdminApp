// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { Page, expect } from '@playwright/test'
import { routes } from '../core/routes'

class MainPage {
  private readonly homeNavOption
  private readonly homeLogoOption
  private readonly homeMainOption
  private readonly welcomeMessage

  constructor(private readonly page: Page) {
    this.homeNavOption = this.page.locator('a[title="Home"]')
    this.homeLogoOption = this.page.locator('//*[@id="borderGlobal"]/header/div[1]/a/img')
    this.homeMainOption = this.page.locator('//*[@id="borderGlobal"]/main/div[2]/div/div[2]/nav/ol/li/a')
    this.welcomeMessage = this.page.getByRole('heading', { name: 'Welcome' })
  }

  async navigate() {
    await this.page.goto(routes.home)
    await this.page.waitForLoadState('networkidle', { timeout: 35000 })
  }

  async clickHomeOption(option: string) {
    const normalizedOption = option.trim().toLowerCase()

    if (normalizedOption === 'menu') {
      await this.homeNavOption.click()
      return
    }

    if (normalizedOption === 'logo') {
      await this.homeLogoOption.click()
      return
    }

    if (normalizedOption === 'main') {
      await this.homeMainOption.click()
      return
    }

    throw new Error(`Unsupported Home option: ${option}`)
  }

  async mainPageIsLoaded() {
    await expect(this.page).toHaveURL(new RegExp(routes.home))
  }

  async welcomeMessageIsDisplayed() {
    await expect(this.welcomeMessage).toBeVisible()
  }
}

export default MainPage
