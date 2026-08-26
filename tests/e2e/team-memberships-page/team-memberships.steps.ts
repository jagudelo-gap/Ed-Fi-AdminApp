// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import TeamMembershipsPage from '../pages/team-memberships-page'

const { When, Then } = createBdd()

let teamMembershipsPage: TeamMembershipsPage

When('the user click on Team Memberships option', async ({ page }) => {
  teamMembershipsPage = new TeamMembershipsPage(page)
  await teamMembershipsPage.clickTeamMembershipsOption()
})

When('the user click on Create new team memberships button', async () => {
  await teamMembershipsPage.clickCreateNewButton()
})

When(
  /^the user fill all the required fields for team memberships ([^,]+), ([^,]+), (.+)$/,
  async ({}, team: string, user: string, role: string) => {
    await teamMembershipsPage.fillRequiredFields(team.trim(), user.trim(), role.trim())
  }
)

When('the user click on save team memberships button', async () => {
  await teamMembershipsPage.clickSaveButton()
})

When('the user click on cancel team memberships button', async () => {
  await teamMembershipsPage.clickCancelButton()
})

When('the user click on View team membership option from three dots option', async () => {
  await teamMembershipsPage.clickOptionFromActions('view')
})

When('the user click on Edit team membership option from three dots option', async () => {
  await teamMembershipsPage.clickOptionFromActions('edit')
})

When('the user click on Delete team membership option from three dots option', async () => {
  await teamMembershipsPage.prepareDeleteFromTable()
  await teamMembershipsPage.clickOptionFromActions('delete')
})

When('the user click on the first team memberships from the table', async () => {
  await teamMembershipsPage.clickFirstTeamMembershipFromTable()
})

When('the user click on the firsts team membership from the table', async () => {
  await teamMembershipsPage.clickFirstTeamMembershipFromTable()
})

When('the user click on edit team membership tab', async () => {
  await teamMembershipsPage.clickEditTab()
})

When('the user click on Delete team membership tab', async () => {
  //await teamMembershipsPage.prepareDeleteFromDetail()
  await teamMembershipsPage.clickDeleteTab()
})

When('the user update the information from the team memberships', async () => {
  await teamMembershipsPage.updateTeamMembershipRole()
})

When('the user click on yes button for team membership delete confirmation', async () => {
  await teamMembershipsPage.clickDeleteConfirmationButton('yes')
})

When('the user click on no button for team membership delete confirmation', async () => {
  await teamMembershipsPage.clickDeleteConfirmationButton('no')
})

When(/^the user click on link option (team|user|username|role|created) from the first team memberships$/, async ({}, optionName: string) => {
  await teamMembershipsPage.clickLinkOptionFromFirstRow(optionName)
})

Then('the new Team Memberships details should be loaded', async () => {
  await teamMembershipsPage.newTeamMembershipDetailsShouldBeLoaded()
})

Then('the new Team Memberships not should be created', async () => {
  await teamMembershipsPage.newTeamMembershipShouldNotBeCreated()
})

Then('the details from Team Memberships should be displayed', async () => {
  await teamMembershipsPage.teamMembershipDetailsShouldBeDisplayed()
})

Then('the new changes should be applied and displayed', async () => {
  await teamMembershipsPage.newChangesShouldBeAppliedAndDisplayed()
})

Then('the team information not should be updated', async () => {
  await teamMembershipsPage.teamInformationShouldNotBeUpdated()
})

Then('the team memberships should be removed from the team table', async () => {
  await teamMembershipsPage.selectedTeamMembershipShouldBeRemoved()
})

Then('the team memberships should not be removed from the team table', async () => {
  await teamMembershipsPage.selectedTeamMembershipShouldNotBeRemoved()
})

Then(/^action should be redirect to (team|user|username|role|created) main page$/, async ({}, optionName: string) => {
  await teamMembershipsPage.redirectForLinkOptionShouldBeCorrect(optionName)
})

Then('display the information from current team related', async () => {
  await teamMembershipsPage.relatedInformationShouldBeDisplayed()
})
