Feature: Environments V2

  Scenario Outline: Create Environment Management v2
    Given the user is logged with a valid user
    When the user click on Environment option
    And the user click on Connect button
    And the user fill all the required fields on v2 <name>, <edfiApi>, <edfiManagement>, <label>
    And the user click on save button
    Then the new environment details should be loaded in the main page
    And contains the Team with Tenants sections displayed
    And the API version is detected according to the edfi api version

    Examples:
      | name           | edfiApi                                    | edfiManagement                                  | label      |
      | SingleTenantv2 | https://localhost/odsv7-adminv2-single-api | https://localhost/odsv7-adminv2-single-adminapi | production |
      | MultiTenantv2  | https://localhost/odsv7-adminv2-multi-api  | https://localhost/odsv7-adminv2-multi-adminapi  | production |

  Scenario Outline: Rename Environment Tab
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on the first environment from the table
    And the user click on edit tab option
    When the user update the name of the environment
    And the user click on save button
    Then the environment name should be updated

Scenario Outline: Grant Ownership Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    When the user click on grantownership option from more three dots option
    Then the ownership form should be loaded

Scenario Outline: Grant Ownership Environment Tab
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on the first environment from the table
    When the user click on grantownership tab option
    Then the ownership form should be loaded

  Scenario Outline: Cancel Rename Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on edit option from three dots option
    When the user click on cancel button
    Then the environment name not should be updated

  Scenario Outline: Cancel Delete Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on delete option from more three dots option
    When the user click on no button from popup message
    Then the environment should still be available in the list of environments

  Scenario Outline: Delete Environment
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on delete option from more three dots option
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
    | v2   |

  Scenario Outline: Environment Combination of Required Fields
    Given the user is logged with a valid user
    And the user click on Environment option
    And the user click on Connect button
    And the user fill a list of field <fieldName>
    When the user click on save button
    Then the required field <highlighted> should be highlighted

    Examples:
      | fieldName                                              | highlighted      |
      | name, ed-fi api, ed-fi management, label               | ODS Instance     |
      | ed-fi api, ed-fi management, label                     | name             |
      | name, ed-fi api, label.                                | ed-fi management |
