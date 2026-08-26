// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { expect, Page } from '@playwright/test'

type CreateUserInput = {
  username: string
  userType: 'Human' | 'Machine'
  status: boolean
  role: string
  addToTeam: boolean
}

type CancelUserInput = CreateUserInput & {
  familyName: string
}

class UsersPage {
  private readonly usersOption
  private readonly createNewButton
  private readonly usernameInput
  private readonly userTypeHumanRadio
  private readonly userTypeMachineRadio
  private readonly givenNameInput
  private readonly familyNameInput
  private readonly descriptionInput
  private readonly clientIdInput
  private readonly statusCheckbox
  private readonly saveButton
  private readonly cancelButton
  private readonly addToTeamYesRadio
  private readonly addToTeamNoRadio
  private readonly usersHeading
  private readonly humanUsersHeading
  private readonly machineUsersHeading
  private readonly userDisplayNameHeading
  private readonly firstUserNameLink
  private readonly addTeamFormHeading

  private selectedUserDisplayName: string | null = null

  constructor(private readonly page: Page) {
    this.usersOption = this.page.locator('a[title="Users"]')
    this.createNewButton = this.page.locator('a[title="Create new application user."]')
    this.usernameInput = this.page.getByLabel('Username')
    this.userTypeHumanRadio =   this.page.locator('.chakra-radio__control').first()
    this.userTypeMachineRadio = page.locator('label:nth-child(2) > .chakra-radio__control').first()
    this.givenNameInput = this.page.getByLabel('Given Name')
    this.familyNameInput = this.page.getByLabel('Family name')
    this.descriptionInput = this.page.getByLabel('Description')
    this.clientIdInput = this.page.getByLabel('Client ID')
    this.statusCheckbox = this.page.locator('.chakra-checkbox__control')
    this.saveButton = this.page.getByRole('button', { name: 'Save' })
    this.cancelButton = this.page.getByRole('button', { name: 'Cancel' })
    this.addToTeamYesRadio = this.page.getByText('Yes', { exact: true })
    this.addToTeamNoRadio = this.page.getByText('No', { exact: true })
    this.usersHeading = this.page.getByText('UsersCreate new')
    this.humanUsersHeading = this.page.getByRole('heading', { name: 'Human Users' })
    this.machineUsersHeading = this.page.getByRole('heading', { name: 'Machine Users' })
    this.userDisplayNameHeading = this.page.locator('main h1')
    this.firstUserNameLink = this.page.locator('a[title="Go to user"]').first()
    this.addTeamFormHeading = this.page.getByRole('heading', { name: 'Create new team membership' })
  }

  async clickUsersOption() {
    await this.usersOption.click()
  }

  async clickCreateNewButton() {
    await this.createNewButton.click()
  }

  async selectUserType(userType: 'human' | 'machine') {
    if (userType === 'human') {
      await this.userTypeHumanRadio.click()
      return
    }

    await this.userTypeMachineRadio.click()
  }

  async fillCreateRequiredFields(input: CreateUserInput) {
    await this.fillCommonRequiredFields(input)
  }

  async fillCancelRequiredFields(input: CancelUserInput) {
    await this.fillCommonRequiredFields(input)
  }

  async clickSaveButton() {
    await this.saveButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  async clickCancelButton() {
    await this.cancelButton.click()
    await this.page.waitForLoadState('networkidle')
  }

  async newUserDetailsShouldBeLoaded() {
    await expect(this.page).toHaveURL(/\/users\/\d+\/?$/)
    await expect(this.page.getByText('Create new user')).not.toBeVisible()
    await expect(this.page.getByText('Username')).toBeVisible()
    await expect(this.page.getByText('Role', { exact: true })).toBeVisible()
  }

  async newUserShouldNotBeCreated(userType: string) {
    await expect(this.page).toHaveURL(/\/users\/?$/)
    if (userType === 'Human') {
      await this.page.getByRole('textbox', { name: 'Search' }).first().fill('UserACopy')
      await this.page.getByRole('textbox', { name: 'Search' }).first().press('Enter')
      await this.page.waitForLoadState('networkidle')
      const table = this.page.locator('table').nth(0)
      await expect(table.locator('td')).not.toBeVisible()

    }
    if (userType === 'Machine') {
      await this.page.getByRole('textbox', { name: 'Search' }).nth(1).click()
      await this.page.getByRole('textbox', { name: 'Search' }).nth(1).fill('MachineCopy')
      await this.page.getByRole('textbox', { name: 'Search' }).first().press('Enter')
      const table = this.page.locator('table').nth(1)
      await expect(table.locator('td')).not.toBeVisible()
    }
  }

  async usersTableDetailsShouldBeLoaded() {
    await this.usersOption.click()
    await expect(this.usersHeading).toBeVisible()
    await expect(this.humanUsersHeading).toBeVisible()
    await expect(this.machineUsersHeading).toBeVisible()
  }

  async clickOptionFromUserActions(option: 'view' | 'add team' | 'edit' | 'delete') {
    const optionLabel = this.mapUserActionLabel(option)
    const firstRow = this.page.locator('tbody td').first()
    await firstRow.hover()
    const rowActionButton = this.page.getByRole('link', { name: optionLabel }).first()
    if (await rowActionButton.isVisible().catch(() => false)) {
      await rowActionButton.click()
      return
    }
    if (option === 'delete') {
      const deleteButton = this.page.getByRole('button', { name: optionLabel }).first()
      await deleteButton.click()
    }
  }

  async clickFirstUserFromTable() {
    await this.captureFirstUserNameFromTable()
    await this.firstUserNameLink.click()
    await this.page.waitForLoadState('networkidle')
  }

  async clickEditTab() {
    await this.page.getByRole('link', { name: 'Edit' }).click()
  }

  async clickDeleteTab() {
    await this.page.getByRole('button', { name: 'Delete' }).click()
  }

  async clickDeleteConfirmationButton(option: 'yes' | 'no') {
    if (option === 'yes') {
      await this.page.getByRole('button', { name: 'Yes' }).click()
      return
    }
    await this.page.getByRole('button', { name: 'No' }).click()
  }

  async currentUserDetailsShouldBeDisplayed() {
    await expect(this.page).toHaveURL(/\/users\/\d+\/?$/)
    await expect(this.page.getByText('Username')).toBeVisible()
    await expect(this.page.getByText('Status')).toBeVisible()
    await expect(this.page.getByText('Role', { exact: true })).toBeVisible()
  }

  async teamMembershipCreateFormShouldBeLoaded() {
    await expect(this.page).toHaveURL(/\/user-team-memberships\/create\?/)
    await expect(this.addTeamFormHeading).toBeVisible()
    await expect(this.page.getByText('Team', { exact: true })).toBeVisible()
    await expect(this.page.getByText('User', { exact: true })).toBeVisible()
    await expect(this.page.getByText('Role', { exact: true })).toBeVisible()
  }

  async userEditFormShouldBeLoaded() {
    await expect(this.page).toHaveURL(/\/users\/\d+\/?\?edit=true$/)
    await expect(this.page.getByLabel('Username')).toBeVisible()
    await expect(this.page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(this.page.getByRole('button', { name: 'Cancel' })).toBeVisible()
  }

  async prepareDeleteFromTable() {
    await this.page.getByRole('textbox', { name: 'Search' }).first().fill('User')
    await this.page.getByRole('textbox', { name: 'Search' }).first().press('Enter')
    await this.captureFirstUserNameFromTable()
  }

  async selectedUserShouldBeRemovedFromTable() {
    await expect(this.page).toHaveURL(/\/users\/?$/)
    await this.usersTableDetailsShouldBeLoaded()
    if (this.selectedUserDisplayName) {
      await expect(this.page.locator('tbody').nth(0)).not.toContainText(this.selectedUserDisplayName)
      await expect(this.page.locator('tbody').nth(1)).not.toContainText(this.selectedUserDisplayName)
    }
  }

  async selectedUserShouldStillExistInTable() {
    //await expect(this.page).toHaveURL(/\/users\/?$/)
    await this.usersTableDetailsShouldBeLoaded()
    if (this.selectedUserDisplayName) {
      await expect(this.page.locator('tbody').nth(0)).toContainText(this.selectedUserDisplayName)
    }
  }

  async requiredFieldsShouldBeHighlighted(userType: 'human' | 'machine') {
    await expect(this.usernameInput).toHaveAttribute('aria-invalid', 'true')

    if (userType === 'human') {
      await expect(this.givenNameInput).toHaveAttribute('aria-invalid', 'true')
      await expect(this.familyNameInput).toHaveAttribute('aria-invalid', 'true')
      await expect(this.descriptionInput).not.toBeVisible()
      await expect(this.clientIdInput).not.toBeVisible()
      return
    }

    await expect(this.descriptionInput).toHaveAttribute('aria-invalid', 'true')
    await expect(this.clientIdInput).toHaveAttribute('aria-invalid', 'true')
    await expect(this.givenNameInput).not.toBeVisible()
    await expect(this.familyNameInput).not.toBeVisible()
  }

  private async fillCommonRequiredFields(input: CreateUserInput) {
    await this.usernameInput.fill(input.username)
    await this.selectUserType(input.userType.toLowerCase() as 'human' | 'machine')

    if (input.userType === 'Human') {
      await this.givenNameInput.fill(`${input.username}-given`)
      await this.familyNameInput.fill(`${input.username}-family`)
    }

    if (input.userType === 'Machine') {
      await this.descriptionInput.fill(`${input.username} description`)
      await this.clientIdInput.fill(`${input.username}-client-id`)
    }

    if (input.status) {
      const isChecked = await this.statusCheckbox.isChecked()
      if (!isChecked) {
        await this.statusCheckbox.check()
      }
    } else {
      const isChecked = await this.statusCheckbox.isChecked()
      if (isChecked) {
        await this.statusCheckbox.uncheck()
      }
    }

    await this.selectComboboxOption('Role', input.role)

    if (input.addToTeam) {
      await this.addToTeamYesRadio.click()
      await this.selectFirstComboboxOption('Team')
      await this.selectFirstComboboxOption('Role')
    } else {
      await this.addToTeamNoRadio.click()
    }
  }

  private async selectComboboxOption(label: string, optionText: string) {
    const combobox = this.page.getByRole('combobox', { name: label }).first()
    await combobox.click()
    await this.page.keyboard.type(optionText)
    await this.page.keyboard.press('Enter')
  }

  private async selectFirstComboboxOption(label: string) {
    const combobox = this.page.getByText(label, { exact: true })
    switch (label) {
      case 'Team':
        await combobox.click()
        break
      case 'Role':
        await combobox.nth(1).click()
        break
      default:
        throw new Error(`Unsupported option name: ${label}`)
    }
    await this.page.keyboard.press('ArrowDown')
    await this.page.keyboard.press('Enter')
  }

  private mapUserActionLabel(option: 'view' | 'add team' | 'edit' | 'delete') {
    switch (option) {
      case 'view':
        return 'View'
      case 'add team':
        return 'Add team'
      case 'edit':
        return 'Edit'
      case 'delete':
        return 'Delete'
      default:
        throw new Error(`Unsupported option name: ${option}`)
    }
  }

  private async captureFirstUserNameFromTable() {
    await this.page.getByRole('textbox', { name: 'Search' }).first().fill('User')
    await this.page.getByRole('textbox', { name: 'Search' }).first().press('Enter')
    await expect(this.firstUserNameLink).toBeVisible()
    this.selectedUserDisplayName = (await this.firstUserNameLink.textContent())?.trim() ?? null
  }
}

export default UsersPage
