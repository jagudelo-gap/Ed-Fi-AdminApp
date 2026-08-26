Feature: Environments V1

  Scenario Outline: Create Environment Management
    Given the user is logged with a valid user
    When the user click on Environment option
    And the user click on Connect button
    And the user fill all the required fields on v1 <name>, <edfiApi>, <edfiManagement>, <label>, <odsName>, <dbName>, <eduOrgIdentifier>
    And the user click on save button
    Then the new environment details should be loaded in the main page
    And contains the Team with Tenants sections displayed
    And the API version is detected according to the edfi api version

    Examples:
      | name | edfiApi                  | edfiManagement                | label      | odsName | dbName | eduOrgIdentifier |
      | EnvA | https://localhost/v6-api | https://localhost/v6-adminapi | production | ODS     | ODS    | 1                |
      | EnvB | https://localhost/v6-api | https://localhost/v6-adminapi | production | ODS     | ODS    | 1010, 2540       |

  Scenario Outline: Rename Environment Tab
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on the first environment from the table
    And the user click on edit tab option
    When the user update the name of the environment
    And the user click on save button
    Then the environment name should be updated

  Scenario Outline: Rename Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on edit option from three dots option
    When the user update the name of the environment
    And the user click on save button
    Then the environment name should be updated

  Scenario Outline: Cancel Rename Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on edit option from three dots option
    When the user click on cancel button
    Then the environment name not should be updated

  Scenario Outline: Cancel Delete Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on delete option from three dots option
    When the user click on no button from popup message
    Then the environment should still be available in the list of environments

  Scenario Outline: Delete Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on delete option from three dots option
    When the user click on yes button from popup message
    Then the environment updated should removed from the table of environments

  Scenario Outline: Delete Environment Tab
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on the first environment from the table
    And the user click on delete tab option
    When the user click on yes button from popup message
    Then the environment created should removed from the table of environments

  Scenario Outline: Cancel Environment Creation
    Given the user is logged with a valid user
    When the user click on Environment option
    And the user click on Connect button
    And the user fill all the required fields for environment of type <type>
    And the user click on cancel button
    Then the environment main page should be loaded without the environment created

    Examples:
    | type |
    | v1   |

  Scenario Outline: Environment Individual Required Fields
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on Connect button
    And the user fill the field <fieldName>
    When the user click on save button
    Then the fields other than <fieldName> should be highlighted

    Examples:
      | fieldName        |
      | none             |
      | name             |
      | ed-fi api        |
      | ed-fi management |
      | env label        |
      | educorgident     |
