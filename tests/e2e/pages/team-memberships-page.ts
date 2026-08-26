// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { expect, Page } from '@playwright/test'

class TeamMembershipsPage {
  private readonly teamMembershipsOption
  private readonly createNewButton
  private readonly saveButton
  private readonly cancelButton
  private readonly pageHeading
  private readonly firstMembershipLink
  private readonly firstMembershipTeam

  private selectedMembershipName: string | null = null
  private selectedRoleBeforeEdit: string | null = null
  private lastLinkOptionUsed: string | null = null

  constructor(private readonly page: Page) {
    this.teamMembershipsOption = this.page.locator('a[title="Team memberships"]')
    this.createNewButton = this.page.locator('a[title="Create new team membership."]')
    this.saveButton = this.page.getByRole('button', { name: 'Save' })
    this.cancelButton = this.page.getByRole('button', { name: 'Cancel' })
    this.pageHeading = this.page.locator('main h2')
    this.firstMembershipLink = this.page.locator('tbody td span').first()
    this.firstMembershipTeam = this.page.locator('a[title="Go to team"]').first()
  }

  async clickTeamMembershipsOption() {
    await this.teamMembershipsOption.click()
  }

  async clickCreateNewButton() {
    await this.createNewButton.click()
  }

  async fillRequiredFields(team: string, user: string, role: string) {
    await this.selectComboboxOption('Team', team)
    await this.selectComboboxOption('User', user)
    await this.selectComboboxOption('Role', role)
  }

  async clickSaveButton() {
    await this.saveButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  async clickCancelButton() {
    await this.cancelButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  async newTeamMembershipDetailsShouldBeLoaded() {
    await expect(this.page).toHaveURL(/\/user-team-memberships\/\d+\/?$/)
    await this.teamMembershipDetailsShouldBeDisplayed()
  }

  async newTeamMembershipShouldNotBeCreated() {
    await expect(this.page).toHaveURL(/\/user-team-memberships\/?$/)
    await expect(this.page.getByRole('heading', { name: 'Team memberships' })).toBeVisible()
  }

  async clickOptionFromActions(option: 'view' | 'edit' | 'delete') {
    const firstRow = this.page.locator('tbody td span').first()
    await firstRow.hover()

    switch (option.trim().toLowerCase()) {
      case 'view':
        await this.page.getByRole('link', { name: 'View', exact: true }).click()
        break
      case 'edit':
        await this.page.getByRole('link', { name: 'Edit', exact: true }).click()
        break
      case 'delete':
        await this.page.getByRole('button', { name: 'Delete', exact: true }).click()
        break
      default:
        throw new Error(`Unsupported option name: ${option}`)
    }
  }

  async clickFirstTeamMembershipFromTable() {
    await this.page.getByRole('textbox', { name: 'Search' }).first().fill('teamMember')
    await this.page.getByRole('textbox', { name: 'Search' }).first().press('Enter')
    await this.captureFirstMembershipName()
    await this.firstMembershipLink.click()
    await this.page.waitForLoadState('networkidle')
  }

  async clickEditTab() {
    await this.captureCurrentRole()
    await this.page.getByRole('link', { name: 'Edit' }).click()
  }

  async clickDeleteTab() {
    await this.page.getByRole('button', { name: 'Delete' }).click()
  }

  async updateTeamMembershipRole() {
    await this.captureCurrentRole()
    const roleCombo = this.page.getByRole('combobox', { name: 'Role' })
    await roleCombo.click()
    await this.page.keyboard.press('ArrowDown')
    await this.page.keyboard.press('Enter')
  }

  async clickDeleteConfirmationButton(option: 'yes' | 'no') {
    if (option === 'yes') {
      await this.page.getByRole('button', { name: 'Yes' }).click()
      return
    }
    await this.page.getByRole('button', { name: 'No' }).click()
  }

  async teamMembershipDetailsShouldBeDisplayed() {
    await expect(this.page.getByText('Team', { exact: true })).toBeVisible()
    await expect(this.page.getByText('User', { exact: true })).toBeVisible()
    await expect(this.page.getByText('Role', { exact: true })).toBeVisible()
    await expect(this.page.getByText('UserName', { exact: true })).toBeVisible()
  }

  async newChangesShouldBeAppliedAndDisplayed() {
    await expect(this.page).toHaveURL(/\/user-team-memberships\/\d+\/?$/)
    await this.teamMembershipDetailsShouldBeDisplayed()
  }

  async teamInformationShouldNotBeUpdated() {
    await expect(this.page).toHaveURL(/\/user-team-memberships\/\d+\/?$/)
    await this.teamMembershipDetailsShouldBeDisplayed()
    if (this.selectedRoleBeforeEdit) {
      await expect(this.page.getByText(this.selectedRoleBeforeEdit, { exact: true })).toBeVisible()
    }
  }

  async prepareDeleteFromTable() {
    await this.page.getByRole('textbox', { name: 'Search' }).first().fill('teamMember')
    await this.page.getByRole('textbox', { name: 'Search' }).first().press('Enter')
    await this.page.waitForLoadState('networkidle')
    await this.captureFirstMembershipName()
  }

  async prepareDeleteFromDetail() {
    await this.captureCurrentMembershipName()
  }

  async selectedTeamMembershipShouldBeRemoved() {
    await expect(this.page).toHaveURL(/\/user-team-memberships\/?$/)
    await expect(this.page.getByRole('heading', { name: 'Team memberships' })).toBeVisible()
    if (this.selectedMembershipName) {
      await expect(this.page.locator('tbody')).not.toContainText(this.selectedMembershipName)
    }
  }

  async selectedTeamMembershipShouldNotBeRemoved() {
    this.clickTeamMembershipsOption()
    await expect(this.page).toHaveURL(/\/user-team-memberships\/?$/)
    await expect(this.page.getByRole('heading', { name: 'Team memberships' })).toBeVisible()
    if (this.selectedMembershipName) {
      await expect(this.page.locator('tbody')).toContainText(this.selectedMembershipName)
    }
  }

  async clickLinkOptionFromFirstRow(optionName: string) {
    this.lastLinkOptionUsed = optionName
    switch (optionName) {
      case 'team':
        await this.page.locator('a[title="Go to team"]').first().click()
        break
      case 'user':
      case 'username':
        await this.page.locator('a[title="Go to user"]').first().click()
        break
      case 'role':
        await this.page.locator('a[title="Go to role"]').first().click()
        break
      case 'created':
        await this.firstMembershipLink.click()
        break
      default:
        throw new Error(`Unsupported optionName: ${optionName}`)
    }
  }

  async redirectForLinkOptionShouldBeCorrect(optionName: string) {
    switch (optionName) {
      case 'team':
        await expect(this.page).toHaveURL(/\/teams\/\d+\/?$/)
        break
      case 'user':
      case 'username':
        await expect(this.page).toHaveURL(/\/users\/\d+\/?$/)
        break
      case 'role':
        await expect(this.page).toHaveURL(/\/roles\/\d+\/?$/)
        break
      case 'created':
        await expect(this.page).toHaveURL(/\/user-team-memberships\/\d+\/?$/)
        break
      default:
        throw new Error(`Unsupported optionName: ${optionName}`)
    }
  }

  async relatedInformationShouldBeDisplayed() {
    if (this.lastLinkOptionUsed === null) {
      await expect(this.pageHeading).toBeVisible()
      return
    }

    switch (this.lastLinkOptionUsed) {
      case 'team':
        await expect(this.page.getByText('Name', { exact: true })).toBeVisible()
        break
      case 'user':
      case 'username':
        await expect(this.page.getByText('Username', { exact: true })).toBeVisible()
        break
      case 'role':
        await expect(this.page.getByText('Description', { exact: true })).toBeVisible()
        break
      case 'created':
        await this.teamMembershipDetailsShouldBeDisplayed()
        break
      default:
        await expect(this.pageHeading).toBeVisible()
        break
    }
  }

  private mapActionLabel(option: 'view' | 'edit' | 'delete') {
    switch (option) {
      case 'view':
        return 'View'
      case 'edit':
        return 'Edit'
      case 'delete':
        return 'Delete'
      default:
        throw new Error(`Unsupported option: ${option}`)
    }
  }

  private async selectComboboxOption(label: string, preferredOptionText: string) {
    const combobox = this.page.getByText(label, { exact: true })
    await combobox.click()
    await this.page.keyboard.type(preferredOptionText)
    const preferredOption = this.page.getByRole('option', { name: preferredOptionText, exact: true })
    if (await preferredOption.isVisible().catch(() => false)) {
      await preferredOption.click()
      return
    }
    await this.page.keyboard.press('ArrowDown')
    await this.page.keyboard.press('Enter')
  }

  private async captureFirstMembershipName() {
    await expect(this.firstMembershipTeam).toBeVisible()
    this.selectedMembershipName = (await this.firstMembershipTeam.textContent())?.trim() ?? null
  }

  private async captureCurrentMembershipName() {
    await expect(this.firstMembershipTeam).toBeVisible()
    this.selectedMembershipName = (await this.firstMembershipTeam.textContent())?.trim() ?? null
  }

  private async captureCurrentRole() {
    const roleValue = this.page.getByText('Role', { exact: true }).locator('xpath=following::a[1]')
    if (await roleValue.isVisible().catch(() => false)) {
      this.selectedRoleBeforeEdit = (await roleValue.textContent())?.trim() ?? null
    }
  }
}

export default TeamMembershipsPage
