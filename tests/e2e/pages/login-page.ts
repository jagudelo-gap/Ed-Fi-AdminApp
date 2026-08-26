// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { Page, expect } from '@playwright/test'
import { routes } from '../core/routes'

class LoginPage {
  private readonly username
  private readonly password
  private readonly loginCornerButton
  private readonly loginMainButton
  private readonly signinButton
  private readonly learningMore
  private readonly reportIssueButton
  private readonly footerElement
  private communityPage: Page | null = null

  constructor(private readonly page: Page) {
    this.username = this.page.locator('#username')
    this.password = this.page.locator('#password')
    this.signinButton = this.page.locator('#kc-login')
    this.loginMainButton = this.page.locator('a[href="/adminapp/login"]')
    this.loginCornerButton = this.page.locator('a[href="/adminapp/login"]')
    this.learningMore = this.page.getByText('Learn more')
    this.reportIssueButton = this.page.locator('a[href="https://community.ed-fi.org"]')
    this.footerElement = this.page.locator('//*[@id="borderGlobal"]/main/div/div[2]')
  }

  async navigateToLogin() {
    await this.page.goto(routes.home)
    await this.loginMainButton.nth(0).click()
  }

  async clickLoginCornerButton() {
    await this.loginCornerButton.nth(0).click()
  }

  async clickLoginMainButton() {
    await this.loginMainButton.nth(1).click()
  }

  async loginPageIsLoaded() {
    await expect(this.username).toBeVisible()
    await expect(this.password).toBeVisible()
    await expect(this.signinButton).toBeVisible()
  }

  async clickOnLearningMoreButton() {
    await this.learningMore.click()
  }

  async referencePageIsLoaded() {
    await expect(this.page).toHaveURL('https://docs.ed-fi.org/reference/admin-app-v4')
  }

  async clickOnReportIssue() {
    const newPagePromise = this.page.context().waitForEvent('page')
    await this.reportIssueButton.click()
    this.communityPage = await newPagePromise
    await this.communityPage.waitForLoadState('domcontentloaded')
  }

  async reviewFooter() {
    await this.footerElement.scrollIntoViewIfNeeded()
  }

  async communityPageIsLoaded() {
    expect(this.communityPage).not.toBeNull()
    await expect(this.communityPage!).toHaveURL('https://community.ed-fi.org/s/')
  }

  async footerYearsMatch() {
    const currentYear = new Date().getFullYear()
    const footerText = await this.footerElement.textContent()
    expect(footerText).toContain(currentYear.toString())
  }

  async login(username: string, password: string) {
    await this.username.fill(username)
    await this.password.fill(password)
    await this.signinButton.click()

    // Wait for authentication to complete - wait for any URL that's NOT the login page
    await this.page.waitForURL(/^(?!.*login).*$/, { timeout: 30000 })
    await this.page.waitForLoadState('networkidle')
  }
}

export default LoginPage
