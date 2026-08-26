// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import TeamsPage from '../pages/teams-page'

const { When, Then } = createBdd()

let teamsPage: TeamsPage

When('the user click on Teams option', async ({ page }) => {
  teamsPage = new TeamsPage(page)
  await teamsPage.clickTeamsOption()
})

When('the user click on create new button', async () => {
  await teamsPage.clickCreateNewButton()
})

When('the user fill the required fields', async () => {
  await teamsPage.fillRequiredFields()
})

When(/^the user create this team name (.+)$/, async ({}, teamName: string) => {
  await teamsPage.fillTeamName(teamName)
})

When('the user click on save the teams', async () => {
  await teamsPage.clickSaveButton()
})

When('the user click on cancel the teams', async () => {
  await teamsPage.clickCancelButton()
})

When(/^the user click on (Assume team scope|Add existing user to|Give New resource ownership|view|edit|delete) option using three dots option$/, async ({}, option: string) => {
  await teamsPage.clickOptionFromThreeDots(option)
})

When('the user sets a new name', async () => {
  await teamsPage.setNewTeamName()
})

When(/^the user click on (yes|no) button on popup message$/, async ({}, option: string) => {
  const optionName = option.toLowerCase()
  await teamsPage.clickPopupButton(optionName)
})

Then('the new team created should be displayed', async () => {
  await teamsPage.teamDetailsShouldBeDisplayed()
})

Then('new team not should be created', async () => {
  await teamsPage.newTeamShouldNotBeCreated()
})

Then('the home page from the team created should be loaded', async () => {
  await teamsPage.homeScopePageShouldBeLoaded()
})

Then('the Create new team membership form should be loaded', async () => {
  await teamsPage.teamMembershipFormShouldBeLoaded()
})

Then('the new Grant new resource ownership form should be loaded', async () => {
  await teamsPage.grantResourceOwnershipFormShouldBeLoaded()
})

Then('the details of the team created should be displayed', async () => {
  await teamsPage.teamDetailsShouldBeDisplayed()
})

Then('the new name team should be updated', async () => {
  await teamsPage.teamNameShouldBeUpdated()
})

Then('the team name should not be changed', async () => {
  await teamsPage.teamNameShouldNotBeChanged()
})

Then('the environment should removed from the list of environments', async () => {
  await teamsPage.teamShouldBeRemoved()
})

Then('the environment should not removed from the list of environments', async () => {
  await teamsPage.teamShouldNotBeRemoved()
})
