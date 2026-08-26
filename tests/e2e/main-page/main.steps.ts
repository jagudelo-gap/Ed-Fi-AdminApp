// SPDX-License-Identifier: Apache-2.0
// Licensed to the Ed-Fi Alliance under one or more agreements.
// The Ed-Fi Alliance licenses this file to you under the Apache License, Version 2.0.
// See the LICENSE and NOTICES files in the project root for more information.

import { createBdd } from 'playwright-bdd'
import MainPage from '../pages/main-page'

const { When } = createBdd()

When(/^the user click on (\S+) Home option$/, async ({ page }, option: string) => {
  const mainPage = new MainPage(page)
  await mainPage.clickHomeOption(option)
})
