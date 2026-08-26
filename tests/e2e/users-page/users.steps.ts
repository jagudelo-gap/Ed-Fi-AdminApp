// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import UsersPage from '../pages/users-page'

const { When, Then } = createBdd()

let usersPage: UsersPage

When('the user click on user option', async ({ page }) => {
  usersPage = new UsersPage(page)
  await usersPage.clickUsersOption()
})

When('the user click on Create new button', async () => {
  await usersPage.clickCreateNewButton()
})

When(
  /^the user fill all the required fields (.+) (Human|Machine) (true|false) (global admin|global viewer|tenant user global role) (yes|no)$/,
  async ({}, username: string, userType: string, status: string, role: string, addToTeam: string) => {
    await usersPage.fillCreateRequiredFields({
      username,
      userType,
      status: status === 'true',
      role,
      addToTeam: addToTeam === 'yes',
    })
  }
)

When(
  /^the user fill all the required fields (.+) (Human|Machine) (.+) (true|false) (global admin|global viewer|tenant user global role) (yes|no)$/,
  async (
    {},
    username: string,
    userType: string,
    familyName: string,
    status: string,
    role: string,
    addToTeam: string
  ) => {
    await usersPage.fillCancelRequiredFields({
      username,
      userType,
      familyName,
      status: status === 'true',
      role,
      addToTeam: addToTeam === 'yes',
    })
  }
)

When('the user click on save user button', async () => {
  await usersPage.clickSaveButton()
})

When('the user click on cancel user button', async () => {
  await usersPage.clickCancelButton()
})

When('the user click on machine user type', async () => {
  await usersPage.selectUserType('machine')
})

When('the user click on save user button without to fill any field', async () => {
  await usersPage.clickSaveButton()
})

Then('the new user details should be loaded', async () => {
  await usersPage.newUserDetailsShouldBeLoaded()
})

Then(/^the new user (.+) not should be created$/, async ({}, usertype: string) => {
  await usersPage.newUserShouldNotBeCreated(usertype)
})

Then('the user table details should be loaded', async () => {
  await usersPage.usersTableDetailsShouldBeLoaded()
})

Then('only required fields will be highlighted username, given name , family name', async () => {
  await usersPage.requiredFieldsShouldBeHighlighted('human')
})

Then('only required fields will be highlighted username, description, client id', async () => {
  await usersPage.requiredFieldsShouldBeHighlighted('machine')
})

When('the user click on View user option from three dots option', async () => {
  await usersPage.clickOptionFromUserActions('view')
})

When('the user click on Add to Team option from three dots option', async () => {
  await usersPage.clickOptionFromUserActions('add team')
})

When('the user click on Edit option from three dots option', async () => {
  await usersPage.clickOptionFromUserActions('edit')
})

When('the user click on Delete option from three dots option', async () => {
  await usersPage.prepareDeleteFromTable()
  await usersPage.clickOptionFromUserActions('delete')
})

When('the user click on the firsts user from the table', async () => {
  await usersPage.clickFirstUserFromTable()
})

When('the user click on the first user from the table', async () => {
  await usersPage.clickFirstUserFromTable()
})

When('the user click on Edit tab', async () => {
  await usersPage.clickEditTab()
})

When('the user click on Delete tab', async () => {
  await usersPage.clickDeleteTab()
})

When('the user click on cancel user edit button', async () => {
  await usersPage.clickCancelButton()
})

When('the user click on yes button for user delete confirmation', async () => {
  await usersPage.clickDeleteConfirmationButton('yes')
})

When('the user click on no button for user delete confirmation', async () => {
  await usersPage.clickDeleteConfirmationButton('no')
})

Then('the details of current user should be displayed', async () => {
  await usersPage.currentUserDetailsShouldBeDisplayed()
})

Then('the teams forms should be loaded for create a new team', async () => {
  await usersPage.teamMembershipCreateFormShouldBeLoaded()
})

Then('the teams forms should be loaded for edit current user', async () => {
  await usersPage.userEditFormShouldBeLoaded()
})

Then('table user should be loaded without to change some data', async () => {
  await usersPage.usersTableDetailsShouldBeLoaded()
})

Then('the user created should be removed from table user', async () => {
  await usersPage.selectedUserShouldBeRemovedFromTable()
})

Then('the user created not should be removed from the user table loaded', async () => {
  await usersPage.selectedUserShouldStillExistInTable()
})
