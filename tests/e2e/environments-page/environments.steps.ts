// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import EnvironmentsPage from '../pages/environments-page'

const { When, Then } = createBdd()

let environmentsPage: EnvironmentsPage

When('the user click on Environment option', async ({ page }) => {
  environmentsPage = new EnvironmentsPage(page)
  await environmentsPage.clickEnvironmentOption()
})

When('the user click on Connect button', async () => {
  await environmentsPage.clickConnectButton()
})

When(
  /^the user fill all the required fields on v1 ([^,]+), ([^,]+), ([^,]+), ([^,]+), ([^,]+), ([^,]+), (.+)$/,
  async ({}, name: string, edfiApi: string, edfiManagement: string, label: string, odsName: string, dbName: string, eduOrgIdentifier: string) => {
    await environmentsPage.fillAllRequiredFieldsV1(name, edfiApi, edfiManagement, label, odsName, dbName, eduOrgIdentifier)
  }
)

When(
  /^the user fill all the required fields on v2 ([^,]+), ([^,]+), ([^,]+), (.+)$/,
  async ({}, name: string, edfiApi: string, edfiManagement: string, label: string) => {
    await environmentsPage.fillAllRequiredFieldsV2(name, edfiApi, edfiManagement, label)
  }
)

When(/^the user fill all the required fields for environment of type (.+)$/, async ({}, type: string) => {
  await environmentsPage.fillAllRequiredFields(type)
})

When(/^the user fill the field (.*)$/, async ({}, fieldName: string) => {
  await environmentsPage.fillField(fieldName)
})

When(/^the user fill a list of field (.+)$/, async ({}, fieldNames: string) => {
  await environmentsPage.fillSeveralFields(fieldNames)
})

When('the user click on the first environment from the table', async () => {
  await environmentsPage.clickOnFirstEnvironment()
})

When(/^the user click on (edit|delete|grantownership) tab option$/, async ({}, option: string) => {
  const optionName = option.toLowerCase()
  await environmentsPage.clickOnTabOption(optionName)
})

When('the user update the name of the environment', async () => {
  await environmentsPage.renameEnvironment()
})

When('the user click on save button', async () => {
  await environmentsPage.clickSaveButton()
})

When('the user click on cancel button', async () => {
  await environmentsPage.clickCancelButton()
})

When(/^the user click on (edit|delete) option from three dots option$/, async ({}, option: string) => {
  const optionName = option.toLowerCase() === 'edit' ? 'Edit' : 'Delete'
  await environmentsPage.clickOnTheFirstOptionFromThreeDots(optionName)
})

When(/^the user click on (grantownership|delete) option from more three dots option$/, async ({}, option: string) => {
  const optionName = option.toLowerCase()
  await environmentsPage.clickOnTheOptionFromMoreThreeDots(optionName)
})

When(/^the user click on (no|yes) button from popup message$/, async ({}, option: string) => {
  const optionName = option.toLowerCase() === 'no' ? false : true
  await environmentsPage.clickOnDeletePopup(optionName)
})

When(/^the user set an eduction organization (.+)$/, async ({}, identifiers: string) => {
  await environmentsPage.setEducationOrganization(identifiers)
})

Then('the new environment details should be loaded in the main page', async () => {
  await environmentsPage.newEnvironmentDetailsLoaded()
})

Then('contains the Team with Tenants sections displayed', async () => {
  await environmentsPage.teamWithTenantsSectionsDisplayed()
})

Then('the API version is detected according to the edfi api version', async () => {
  await environmentsPage.apiVersionDetected()
})

Then('the environment main page should be loaded without the environment created', async () => {
  await environmentsPage.environmentMainPageLoadedWithoutEnvironmentCreated()
})

Then('the environment name not should be updated', async () => {
  await environmentsPage.environmentMainPageLoadedWithoutEnvironmentCreated()
})

Then(/^the fields other than (.+) should be highlighted$/, async ({}, highlighted: string) => {
  await environmentsPage.requiredFieldsHighlighted(highlighted)
})

Then(/^the required field (.+) should be highlighted$/, async ({}, highlighted: string) => {
  await environmentsPage.requiredFieldHighlighted(highlighted)
})

Then('the new environment should be loaded in the mains page of environments', async () => {
  await environmentsPage.newEnvironmentLoadedInMainPage()
})

Then('the environment name should be updated', async () => {
  await environmentsPage.environmentNameIsUpdated()
})

Then('the environment should still be available in the list of environments', async () => {
  await environmentsPage.environmentStillAvailableAfterCancel()
})

Then(/^the environment (updated|created) should removed from the table of environments$/, async ({}, option: string) => {
  const optionName = option.toLowerCase() === 'updated' ? 'UpdateNameV1' : 'EnvB'
  await environmentsPage.environmentShouldBeRemoved(optionName)
})

Then('the ownership form should be loaded', async () => {
  await environmentsPage.ownershipsFormIsDisplayed()
})
