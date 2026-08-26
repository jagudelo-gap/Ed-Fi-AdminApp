# Admin App 4.0 Functional Test

Below are the test cases for Admin App and using Gherkin to define the test cases. This first definition will use [Markdown With Gherkin](https://github.com/cucumber/gherkin/blob/main/MARKDOWN_WITH_GHERKIN.md) to define the test cases in a readable manner and future iterations may convert this into other formats to be used with automation in our C#, Playwright and other tools in the future.

> [!TIP]
> Some scenarios may change depending on future changes planned for the application.

## Feature: Login Page (Automated)

#### Scenario Outline: User login page right corner

- Given the user is on login page
- When the user clicks on Login button in the right corner
- Then page should be redirect to keycloak login page

#### Scenario Outline: User login page

- Given the user is on login page
- When the user clicks on Login button
- Then page should be redirect to keycloak login page

#### Scenario Outline: User can go Learn More page

- Given the user is on login page
- When the user clicks on Learn more button
- Then page should be redirect to education analytics page

#### Scenario Outline: User can report an issue

- Given the user is on login page
- When the user clicks on report an issue
- Then a new email page should be opened

#### Scenario Outline: User footer page

- Given the user is on login page
- When the user review the footer page
- Then the years shown must match the year of creation and the current year.

## Feature: Home Page (Automated)

#### Scenario Outline: Home Page

- Given the user is logged with a valid user
- When the user click on Home option
- Then the main page should be loaded
- And a welcome message displayed

## Feature: Account Page (Automated)

#### Scenario Outline: Account Page Information

- Given the user is logged with a valid user
- When the user click on Account option
- Then the information from the current user should be displayed
- And contains the username and user role

## Feature: Environments (Inprogress)

#### Scenario Outline: Create Environment Management v1 (Automated)

- Given the user is logged with a valid user
- When the user click on Environment option
- And the user click on Connect button
- And the user fill all the required fields <name><edfiApi><edfiManagement><label><orgIdentifier>
- And the user click on save button
- Then the new environment details should be loaded in the main page
- And contains the Team with Tenants sections displayed
- And the API version is detected according to the edfi api version

##### Examples

| name | edfiApi                  | edfiManagement                     | label      | orgIdentifier |
| ---- | ------------------------ | ---------------------------------- | ---------- | ------------- |
| EnvA | https://localhost/v6-api | https://localhost/v6-adminapi      | production | 1             |
| EnvB | https://localhost/v6-api | https://localhost/v6-adminapi      | production | 1010, 2540    |

#### Scenario Outline: Create Environment Management v2 (Automated)

- Given the user is logged with a valid user
- When the user click on Environment option
- And the user click on Connect button
- And the user fill all the required fields <name><edfiApi><edfiManagement><label>
- And the user click on save button
- Then the new environment details should be loaded in the main page
- And contains the Team with Tenants sections displayed
- And the API version is detected according to the edfi api version

##### Examples

| name           | edfiApi                                    | edfiManagement                                  | label      |
| -------------- | ------------------------------------------ | ----------------------------------------------- | ---------- |
| SingleTenantv2 | https://localhost/odsv7-adminv2-single-api | https://localhost/odsv7-adminv2-single-adminapi | production |
| MultiTenantv2  | https://localhost/odsv7-adminv2-multi-api  | https://localhost/odsv7-adminv2-multi-adminapi  | production |


#### Scenario Outline: Cancel Environment Creation (Automated)

- Given the user is logged with a valid user
- When the user click on Environment option
- And the user click on Connect button
- And the user fill all the required fields
- And the user click on cancel button
- Then the environment main page should be loaded without the environment created

#### Scenario Outline: Environment Required Fields v1 (Automated)

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on Connect button
- And the user fill the field <fieldName>
- When the user click on save button
- Then the required field <highlighted> should be highlighted

##### Examples

| fieldName        | highlighted                                               |
| ---------------- | --------------------------------------------------------- |
|                  | name, ed-fi api, ed-fi management, Envlabel, EducOrgIdent |
| name             | ed-fi api, ed-fi management, Envlabel, EducOrgIdent       |
| ed-fi api        | name, ed-fi management, Envlabel, EducOrgIdent            |
| ed-fi management | name, ed-fi api, Envlabel, EducOrgIdent                   |
| Env label        | name, ed-fi api, ed-fi management, EducOrgIdent           |
| EducOrgIdent     | name, ed-fi api, ed-fi management, Envlabel               |

#### Scenario Outline: Environment Required Fields v2 (Automated)

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user fill the field <fieldName>
- When the user click on save button
- Then the required field <highlighted> should be highlighted

##### Examples

| fieldName                                                      | highlighted  |
| -------------------------------------------------------------- | ------------ |
| name, ed-fi api, ed-fi management, label                       | label        |
| name, ed-fi api, ed-fi management, label, tenant               | ODS Instance |
| name, ed-fi api, ed-fi management, label, tenant, ODS Instance | EducOrgIdent |

#### Scenario Outline: Save Environment Starting from Education Analytics (TBD)

- Given the user is logged with a valid user
- When the user click on Environment option
- And the user click on Connect button
- And the user enable the option Starting Blocks from Education Analytics
- And the user fill the required fields
- When the user click on save button
- Then the environment information should be loaded
- And contains the Tenants, Sync queue sections displayed

#### Scenario Outline: Fields Environment Starting from Education Analytics (TBD)

- Given the user is logged with a valid user
- When the user click on Environment option
- And the user click on Connect button
- And the user enable the option Starting Blocks from Education Analytics
- And the user fill the field <fieldName>
- When the user click on save button
- Then the required field <highlighted> should be highlighted

##### Examples

| fieldName    | highlighted        |
| ------------ | ------------------ |
| -            | name, metadata arn |
| name         | metadata arn       |
| metadata arn | name               |

#### Scenario Outline: Cancel Environment Starting from Education Analytics (TBD)

- Given the user is logged with a valid user
- When the user click on Environment option
- And the user click on Connect button
- And the user enable the option Starting Blocks from Education Analytics
- And the user fill the required fields
- When the user click on cancel button
- Then the environment main page should be loaded

### Rule: User already has a Environment created (Pending)

#### Scenario Outline: Sorting/Filter Environment (Pending)

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on More Options button
- When the user add a <filterCriteria> criteria <columnName>
- Then the environment table should be sort according the <columnName> criteria

##### Examples

| filterCriteria | columnName    |
| -------------- | ------------- |
| sort           | name          |
| sort           | api version   |
| sort           | data standard |
| sort           | modified by   |
| sort           | created       |
| sort           | created by    |
| filter         | name          |
| filter         | api version   |
| filter         | data standard |
| filter         | modified by   |
| filter         | created       |
| filter         | created by    |

### Rule: User already has a Environment created (Pending)

#### Scenario Outline: Search Environments (Pending)

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user search a environment <environmentName> on search filed
- Then the environment <environmentName> should be loaded in the table

##### Examples

| environmentName                                  |
| ------------------------------------------------ |
| \*.                                              |
| //                                               |
| SmallName                                        |
| LongLongLongLongLongLongLongLongLongLongLongName |

### Rule: User already has a Environment, Teams created (Automated)

#### Scenario Outline: Grant Ownership Environment (Automated)

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on Grant Ownership Environment option from the firsts environment
- Then the ownership form should be loaded

### Rule: User already has a Environment, Teams created (Automated)

#### Scenario Outline: Grant Ownership Environment Tab (Automated)

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on the first environment from the table
- And the user click on Grant ownership tab option
- Then the ownership form should be loaded

### Rule: User already has a Environment created (Automated)

#### Scenario Outline: View Environment 

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on View option
- Then the environment information should be loaded
- And contains the Tenants, Sync queue sections displayed

### Rule: User already has a Environment created (Invalid)

#### Scenario Outline: Setup Block Metadata Environment (Invalid)

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on Setup connection to Starting Blocks Metadata option
- Then the environment information should be loaded on tab Connect SB Meta
- And a section of Metadata ARN should be displayed

### Rule: User already has a Environment created (Invalid)

#### Scenario Outline: Cancel Setup Block Metadata Environment (Invalid)

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on Setup connection to Starting Blocks Metadata option
- And the user click on cancel button
- Then the environment information should be loaded

### Rule: User already has a Environment created (Automated)

#### Scenario Outline: Rename Environment

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on rename option from three dots option
- When the user update the name of the environment
- And the user click on save button
- Then the environment name should be updated

### Rule: User already has a Environment created (Automated)

#### Scenario Outline: Rename Environment Tab

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on the first environment from the table
- And the user click on rename tab option
- When the user update the name of the environment
- And the user click on save button
- Then the environment name should be updated

### Rule: User already has a Environment created (Automated)

#### Scenario Outline: Cancel Rename Environment

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on rename option from three dots option
- When the user click on cancel button
- Then the environment name should be updated

### Rule: User already has a Environment created  (Automated)

#### Scenario Outline: Delete Environment

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on delete option from three dots option
- When the user click on yes button from popup message
- Then the environment should removed from the table of environments

### Rule: User already has a Environment created (Automated)

#### Scenario Outline: Delete Environment Tab

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on the first environment from the table
- And the user click on delete tab option
- When the user click on yes button from popup message
- Then the environment should removed from the table of environments

### Rule: User already has a Environment created (Automated)

#### Scenario Outline: Cancel Delete Environment

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on delete option from three dots option
- When the user click on no button from popup message
- Then the environment should still be available in the list of environments

### Rule: User already has a Environment created (TBD)

#### Scenario Outline: Sync with SB Environment (Invalid)

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on Sync with SB option from three dots option
- Then a warning message should be displayed in the top of the page if the operation was successful or failed

### Rule: User already has a Environment created (TBD)

#### Scenario Outline: Sync with SB Environment Tab (Invalid)

- Given the user is logged with a valid user
- And the user click on Environment option
- And the user click on the first environment from the table
- When the user click on sync with SB tab option
- Then the synchronization should be start until the process complete

## Feature: Teams (Automated)

#### Scenario Outline: Create Team (Automated)

- Given the user is logged with a valid user
- And the user click on Teams option
- And the user click on create new button
- And the user fill the required fields
- When the user click on save button
- Then the new team created should be displayed
- And contains the ownerships with user memberships

#### Scenario Outline: Cancel Team (Automated)

- Given the user is logged with a valid user
- And the user click on Teams option
- And the user click on create new button
- And the user fill the required fields
- When the user click on cancel button
- Then new team not should be created

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Assume <team> team scope

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on Assume team scope option from three dots option
- Then the home page from the team created should be loaded

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Add existing user to <team> 

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on Add existing user to option from three dots option
- Then the Create new team membership form should be loaded

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Give <team> New resource ownership

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on Give New resource ownership option from three dots option
- Then the new Grant new resource ownership form should be loaded

### Rule: User already has a Team created (Automated)

#### Scenario Outline: View Team

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on view option from three dots option
- Then the details of the team created should be displayed
- And contains the ownerships with user memberships

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Edit Team

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on edit option from three dots option
- And the user sets a new name
- And the user click on save button
- Then the new name team should be updated

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Cancel Edit Team

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on edit option from three dots option
- And the user sets a new name
- And the user click on cancel button
- Then the team name should not be changed
- And the details of the team created should be displayed
- And contains the ownerships with user memberships

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Delete Team

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on delete option from three dots option
- When the user click on yes button from popup message
- Then the environment should removed from the list of environments

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Cancel Delete Team

- Given the user is logged with a valid user
- And the user click on Environment option
- When the user click on delete option from three dots option
- When the user click on no button from popup message
- Then the environment should not removed from the list of environments

### Rule: User already has a Team created (Pending)

#### Scenario Outline: Sorting/Filter Teams (Pending)

- Given the user is logged with a valid user
- And the user click on Teams option
- And the user click on More Options button
- When the user add a <filterCriteria> criteria <columnName>
- Then the team table should be sort according the <columnName> criteria

##### Examples

| filterCriteria | columnName  |
| -------------- | ----------- |
| sort           | name        |
| sort           | modified by |
| sort           | created     |
| sort           | created by  |
| filter         | name        |
| filter         | modified by |
| filter         | created     |
| filter         | created by  |

### Rule: User already has a Team created (Pending)

#### Scenario Outline: Search Teams (Pending)

- Given the user is logged with a valid user
- And the user click on Teams option
- When the user search a team <teamName> on search filed
- Then the team <teamName> should be loaded in the table

##### Examples

| teamName                                         |
| ------------------------------------------------ |
| \*.                                              |
| //                                               |
| SmallName                                        |
| LongLongLongLongLongLongLongLongLongLongLongName |

## Feature: Users (Automated)

#### Scenario Outline: Create user (Automated)

- Given the user is logged with a valid user
- When the user click on user option
- And the user click on Create new button
- And the user fill all the required fields <username><userType><status><role><addToTeam>
- And the user click on save button
- Then the new user details should be loaded

##### Examples

| username | userType | status | role                    | addToTeam |
| -------- | -------- | ------ | ----------------------- | --------- |
| userA    | Human    | true   | global admin            | yes       |
| userB    | Human    | true   | global viewer           | yes       |
| userC    | Human    | true   | tenant user global role | yes       |
| userD    | Human    | true   | global admin            | no        |
| userE    | Human    | true   | global viewer           | no        |
| userF    | Human    | true   | tenant user global role | no        |
| userG    | Human    | false  | global admin            | no        |
| userH    | Human    | false  | global viewer           | no        |
| userI    | Human    | false  | tenant user global role | no        |
| userO    | Human    | false  | global admin            | yes       |
| userP    | Human    | false  | global viewer           | yes       |
| userQ    | Human    | false  | tenant user global role | yes       |
| userA    | Machine  | true   | global admin            | yes       |
| userB    | Machine  | true   | global viewer           | yes       |
| userC    | Machine  | true   | tenant user global role | yes       |
| userD    | Machine  | true   | global admin            | no        |
| userE    | Machine  | true   | global viewer           | no        |
| userF    | Machine  | true   | tenant user global role | no        |
| userG    | Machine  | false  | global admin            | no        |
| userH    | Machine  | false  | global viewer           | no        |
| userI    | Machine  | false  | tenant user global role | no        |
| userJ    | Machine  | false  | global admin            | yes       |
| userK    | Machine  | false  | global viewer           | yes       |
| userL    | Machine  | false  | tenant user global role | yes       |

#### Scenario Outline: Cancel user (Automated)

- Given the user is logged with a valid user
- When the user click on user option
- And the user click on Create new button
- And the user fill all the required fields <username><userType><familyName><status><role><addToTeam>
- And the user click on cancel button
- Then the new user not should be created
- And the user table details should be loaded

##### Examples

| username | userType | familyName | status | role         | addToTeam |
| -------- | -------- | ---------- | ------ | ------------ | --------- |
| userA    | Human    | familyA    | true   | global admin | yes       |
| userA    | Machine  | familyA    | true   | global admin | yes       |

#### Scenario Outline: User human type Required Fields (Automated)

- Given the user is logged with a valid user
- When the user click on user option
- And the user click on Create new button
- And the user click on save button without to fill any field
- Then only required fields will be highlighted username, given name , family name

#### Scenario Outline: User machine type Required Fields (Automated)

- Given the user is logged with a valid user
- When the user click on user option
- And the user click on Create new button
- And the user click on save button without to fill any field
- Then only required fields will be highlighted username, description, client id

### Rule: User already has a user created

#### Scenario Outline: Sorting/Filter user (Pending)

- Given the user is logged with a valid user
- And the user click on user option
- And the user click on More Options button from user type <userType>
- When the user add a <filterCriteria> criteria <columnName>
- Then the team table should be sort according the <columnName> criteria

##### Examples

| userType | filterCriteria | columnName |
| -------- | -------------- | ---------- |
| human    | sort           | name       |
| human    | sort           | username   |
| human    | sort           | role       |
| human    | sort           | created    |
| human    | filter         | name       |
| human    | filter         | username   |
| human    | filter         | role       |
| human    | filter         | created    |
| machine  | sort           | name       |
| machine  | sort           | username   |
| machine  | sort           | role       |
| machine  | sort           | created    |
| machine  | filter         | name       |
| machine  | filter         | username   |
| machine  | filter         | role       |
| machine  | filter         | created    |

### Rule: User already has a user created (Automated)

#### Scenario Outline: View user

- Given the user is logged with a valid user
- And the user click on user option
- When the user click on View user option from three dots option
- Then the details of current user should be displayed

### Rule: User already has a user created (Automated)

#### Scenario Outline: Add to Team User

- Given the user is logged with a valid user
- And the user click on user option
- When the user click on Add to Team option from three dots option
- Then the teams forms should be loaded for create a new team

### Rule: User already has a user created (Automated)

#### Scenario Outline: Edit User

- Given the user is logged with a valid user
- And the user click on user option
- When the user click on Edit option from three dots option
- Then the teams forms should be loaded for create a new team

### Rule: User already has a user created (Automated)

#### Scenario Outline: Edit tab User

- Given the user is logged with a valid user
- And the user click on user option
- And the user click on the firsts user from the table
- When the user click on Edit tab
- Then the teams forms should be loaded for create a new team

### Rule: User already has a user created (Automated)

#### Scenario Outline: Cancel Edit User

- Given the user is logged with a valid user
- And the user click on user option
- And the user click on Edit option from three dots option
- When the user click on cancel button
- Then table user should be loaded without to change some data

### Rule: User already has a user created (Automated)

#### Scenario Outline: Delete User

- Given the user is logged with a valid user
- And the user click on user option
- And the user click on Delete option from three dots option
- When the user click on yes button
- Then the user created should be removed from table user

### Rule: User already has a user created (Automated)

#### Scenario Outline: Delete tab User

- Given the user is logged with a valid user
- And the user click on user option
- And the user click on the first user from the table
- And the user click on Delete tab
- When the user click on yes button
- Then the user created should be removed from table user

### Rule: User already has a user created (Automated)

#### Scenario Outline: Cancel Delete User

- Given the user is logged with a valid user
- And the user click on user option
- And the user click on Delete option from three dots option
- When the user click on no button
- Then the user created not should be removed from the user table loaded

## Feature: Team Memberships (Pending)

### Rule: Team and User already created

#### Scenario Outline: Create Team Memberships

- Given the user is logged with a valid user
- When the user click on Team Memberships option
- And the user click on Create new button
- And the user fill all the required fields <team><user><role>
- And the user click on save button
- Then the new Team Memberships details should be loaded

##### Examples

| team  | user  | role                   |
| ----- | ----- | ---------------------- |
| teamA | userA | Standard tenant access |
| teamB | userB | Tenant Admin           |
| teamC | userC | Tenant viewer          |

### Rule: Team and User already created

#### Scenario Outline: Cancel Team Memberships

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on Create new button
- And the user fill all the required fields <team><user><role>
- When the user click on cancel button
- Then the new Team Memberships not should be created

##### Examples

| team  | user  | role                   |
| ----- | ----- | ---------------------- |
| teamA | userA | Standard tenant access |

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Sorting/Filter Team Memberships

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on More Options button
- When the user add a <filterCriteria> criteria <columnName>
- Then the team table should be sort according the <columnName> criteria

##### Examples

| filterCriteria | columnName |
| -------------- | ---------- |
| sort           | team       |
| sort           | user       |
| sort           | username   |
| sort           | role       |
| sort           | created    |
| filter         | team       |
| filter         | user       |
| filter         | username   |
| filter         | role       |
| filter         | created    |

### Rule: User already has a Team created (Automated)

#### Scenario Outline: View team Memberships

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- When the user click on View option from three dots option
- Then the details from Team Memberships should be displayed

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Edit team Memberships

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on Edit option from three dots option
- And the user update the information from the team memberships
- When the user click on save button
- Then the new changes should be applied and displayed

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Edit team Memberships tab

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on the first team memberships from the table
- And the user click on edit tab
- And the user update the information from the team memberships
- When the user click on save button
- Then the new changes should be applied and displayed

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Cancel Edit team memberships

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on Edit option from three dots option
- When the user click on cancel button
- Then the team information not should be updated

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Delete team memberships

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on Delete option from three dots option
- When the user click on yes button
- Then the team memberships should be removed from the team table

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Delete team memberships tab

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on the firsts team membership from the table
- And the user click on Delete tab
- When the user click on yes button
- Then the team memberships should be removed from the team table

### Rule: User already has a Team created (Automated)

#### Scenario Outline: Cancel Delete team memberships

- Given the user is logged with a valid user
- And the user click on Team Memberships option
- And the user click on Delete option from three dots option
- When the user click on no button
- Then the team memberships should not be removed from the team table


## Feature: Roles (Pending)

#### Scenario Outline: Create role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on Create new button
- When the user fill the required fields <name><descriptions><type><privileges>
- Then the detail from the new role should be displayed <name><<type><privileges>

##### Examples

| name  | description  | type               | privileges     |
| ----- | ------------ | ------------------ | -------------- |
| roleA | descriptionA | User team          | All            |
| roleB | descriptionB | User global        | All            |
| roleC | descriptionC | Resource ownership | All            |
| roleD | descriptionD | User team          | team           |
| roleE | descriptionE | User global        | ownership      |
| roleF | descriptionF | Resource ownership | team           |
| roleG | descriptionG | User team          | ownership      |
| roleH | descriptionH | User global        | me             |
| roleI | descriptionI | Resource ownership | sb-environment |

#### Scenario Outline: Cancel role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on Create new button
- When the user fill the required fields <name><descriptions><type><privileges>
- And the user click on cancel button
- Then the role not should be created
- And the role list should be loaded

##### Examples

| name  | description  | type               | privileges |
| ----- | ------------ | ------------------ | ---------- |
| roleA | descriptionA | User team          | All        |
| roleB | descriptionB | User global        | All        |
| roleC | descriptionC | Resource ownership | All        |

### Rule: User already has a Role created

#### Scenario Outline: View role

- Given the user is logged with a valid user
- And the user click on Roles option
- When the user click on View option from three dots option
- Then the details of the current role should be displayed description, type, privileges

### Rule: User already has a Role created

#### Scenario Outline: Edit role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on Edit option from three dots option
- When the user update the required fields <name><descriptions><privileges>
- And the user click on save button
- Then the detail from the new role should be displayed <name><type><privileges>

##### Examples

| name        | description        | privileges |
| ----------- | ------------------ | ---------- |
| roleUpdateA | updateDescriptionA | All        |
| roleUpdateB | updateDescriptionB | All        |
| roleUpdateC | updateDescriptionC | All        |

### Rule: User already has a Role created

#### Scenario Outline: Edit role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on the role <roleName>
- And the user click on edit tab
- When the user update the required fields <name><descriptions><privileges>
- And the user click on save button
- Then the detail from the new role should be displayed <name><type><privileges>

##### Examples

| roleName | name        | description        | privileges |
| -------- | ----------- | ------------------ | ---------- |
| roleA    | roleUpdateA | updateDescriptionA | All        |
| roleB    | roleUpdateB | updateDescriptionB | All        |
| roleC    | roleUpdateC | updateDescriptionC | All        |

### Rule: User already has a Role created

#### Scenario Outline: Delete role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on the role <roleName>
- And the user click on Delete tab
- When the user click on yes button
- Then the role created should be removed from the role table

##### Examples

| roleName                |
| ----------------------- |
| Tenant user global role |
| Global admin            |
| Global viewer           |

### Rule: User already has a Role created

#### Scenario Outline: Delete role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on Delete option from three dots option
- When the user click on yes button
- Then the role created should be removed from the role table

### Rule: User already has a Role created

#### Scenario Outline: Cancel Delete role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on Delete option from three dots option
- When the user click on no button
- Then the role created not should be removed from the role table

### Rule: User already has a Role created

#### Scenario Outline: Links actions role

- Given the user is logged with a valid user
- And the user click on Roles option
- When the user click on link option <optionName> from the first team memberships
- Then action should be redirect to edit the role selected
- And display the details of the role selected

##### Examples

| optionName |
| ---------- |
| name       |
| created    |

### Rule: User already has a Role created

#### Scenario Outline: Sorting/Filter Role

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on More Options button
- When the user add a <filterCriteria> criteria <columnName>
- Then the environment table should be sort according the <columnName> criteria

##### Examples

| filterCriteria | columnName  |
| -------------- | ----------- |
| sort           | name        |
| sort           | type        |
| sort           | owned by    |
| sort           | modified by |
| sort           | created     |
| sort           | created by  |
| filter         | name        |
| filter         | type        |
| filter         | owned by    |
| filter         | modified by |
| filter         | created     |
| filter         | created by  |

## Feature: Ownerships (Pending)

### Rule: User already has a Environment, Team, Role created

#### Scenario Outline: Create Ownerships

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on Grant new button
- When the user fill the required fields <resourceType><environment><team><role><ods>
- And the user click on save button
- Then the new ownerships details should be displayed

##### Examples

| resourceType         | environment | team  | role                      | ods      |
| -------------------- | ----------- | ----- | ------------------------- | -------- |
| Ed-Org               | EnvA        | TeamA | Full ownership            | EdFi-ODS |
| Ods                  | EnvA        | TeamA | Full ownership            | EdFi-ODS |
| Tenant               | EnvA        | TeamA | Full ownership            | EdFi-ODS |
| Whole environment    | EnvA        | TeamA | Full ownership            | EdFi-ODS |
| Integration provider | EnvA        | TeamA | Full ownership            | EdFi-ODS |
| Ed-Org               | EnvA        | TeamA | Shared-instance ownership | EdFi-ODS |
| Ods                  | EnvA        | TeamA | Shared-instance ownership | EdFi-ODS |
| Tenant               | EnvA        | TeamA | Shared-instance ownership | EdFi-ODS |
| Whole environment    | EnvA        | TeamA | Shared-instance ownership | EdFi-ODS |
| Integration provider | EnvA        | TeamA | Shared-instance ownership | EdFi-ODS |

### Rule: User already has a Environment, Team, Role created

#### Scenario Outline: Cancel Create Ownerships

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on Grant new button
- When the user fill the required fields <resourceType><environment><team><role><ods>
- And the user click on cancel button
- Then the resource ownerships table should be displayed

##### Examples

| resourceType | environment | team  | role           | ods      |
| ------------ | ----------- | ----- | -------------- | -------- |
| Ed-Org       | EnvA        | TeamA | Full ownership | EdFi-ODS |

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: View Ownerships

- Given the user is logged with a valid user
- And the user click on Ownerships option
- When the user click on View option from three dots option
- Then the ownerships details should be displayed

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Edit Ownerships

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on Edit option from three dots option
- When the user change the role for a different role
- And the user click on save button
- Then the ownerships details should be displayed with the latest change

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Edit Ownerships Tab

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on the first resource ownership in the table
- And the user click on Edit tab option
- When the user change the role for a different role
- And the user click on save button
- Then the ownerships details should be displayed with the latest change

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Cancel Edit Ownerships

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on Edit option from three dots option
- When the user change the role for a different role
- And the user click on cancel button
- Then the ownerships not should be changed
- And the details of current ownerships should be displayed

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Delete Ownerships

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on Delete option from three dots option
- When the user click on yes button
- Then the ownerships should be removed from the current table

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Delete Ownerships Tab

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on the first resource ownership in the table
- And the user click on Delete tab option
- When the user click on yes button
- Then the ownerships should be removed from the current table

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Cancel Delete Ownerships

- Given the user is logged with a valid user
- And the user click on Ownerships option
- And the user click on Delete option from three dots option
- When the user click on no button
- Then the ownerships should be not removed from the current table

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Sorting/Filter Ownerships

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on More Options button
- When the user add a <filterCriteria> criteria <columnName>
- Then the environment table should be sort according the <columnName> criteria

##### Examples

| filterCriteria | columnName |
| -------------- | ---------- |
| sort           | name       |
| sort           | team       |
| sort           | role       |
| sort           | type       |
| sort           | resource   |
| filter         | name       |
| filter         | team       |
| filter         | role       |
| filter         | type       |
| filter         | resource   |

## Feature: Sync Queue (Pending)

### Rule: User already has a Team Ownership, Environment, Team, Role created

#### Scenario Outline: Sorting/Filter Sync queue

- Given the user is logged with a valid user
- And the user click on Roles option
- And the user click on More Options button
- When the user add a <filterCriteria> criteria <columnName>
- Then the environment table should be sort according the <columnName> criteria

##### Examples

| filterCriteria | columnName   |
| -------------- | ------------ |
| sort           | name         |
| sort           | trigger data |
| sort           | type         |
| sort           | state        |
| sort           | output       |
| sort           | created      |
| sort           | completed    |
| filter         | name         |
| filter         | team         |
| filter         | role         |
| filter         | type         |
| filter         | resource     |

## Feature: Load Environments Team Data (Pending)

### Rule: User already has a Environment, Teams, Users, Roles, Vendors and Applications created

#### Scenario Outline: Load Data from Environments created

- Given the user is logged with a valid user
- And the user select a environment from no team global option
- And the user click on environment under the search filter option
- And the user click on the <optionName> option
- And the user click on the first <optionName> loaded in the table
- Then the details from the <optionName> selected should be loaded

##### Examples

| optionName   |
| ------------ |
| ODSs         |
| Ed-Orgs      |
| Vendors      |
| Applications |
| Claimsets    |

### Rule: User already has a Environment, Teams, Users, Roles, Vendors and Applications created

#### Scenario Outline: Sort/Filter the Data from Environments created

- Given the user is logged with a valid user
- And the user select a environment from no team global option
- And the user click on environment under the search filter option
- And the user click on the <optionName> option
- And the user click on More Options button
- When the user add a <filterCriteria> criteria <columnName>
- Then the environment table should be sort according the <columnName> criteria

##### Examples

| optionName   | filterCriteria | columnName             |
| ------------ | -------------- | ---------------------- |
| ODSs         | sort           | name                   |
| Ed-Orgs      | sort           | name                   |
| Ed-Orgs      | sort           | short name             |
| Ed-Orgs      | sort           | parent ed-org          |
| Ed-Orgs      | sort           | education ord id       |
| Ed-Orgs      | sort           | ODS                    |
| Ed-Orgs      | sort           | type                   |
| Ed-Orgs      | filter         | parent ed-org          |
| Ed-Orgs      | filter         | education ord id       |
| Ed-Orgs      | filter         | ODS                    |
| Ed-Orgs      | filter         | type                   |
| Vendors      | sort           | company                |
| Vendors      | sort           | namespace              |
| Vendors      | sort           | contact                |
| Applications | sort           | name                   |
| Applications | sort           | education organization |
| Applications | sort           | ods                    |
| Applications | sort           | vendor                 |
| Applications | sort           | claimset               |
| Applications | filter         | education organization |
| Applications | filter         | ods                    |
| Applications | filter         | vendor                 |
| Applications | filter         | claimset               |
| Claimsets    | sort           | name                   |
| Claimsets    | sort           | is system-reserved     |
| Claimsets    | sort           | applications count     |
| Claimsets    | filter         | is system-reserved     |
| Claimsets    | filter         | applications count     |
