Feature: Account Page

  Scenario Outline: Account Page Information

    Given the user is logged with a valid user
    When the user click on Account option
    Then the information from the current user should be displayed
    And contains the username <username> and user role <role> with account management <accountManagement>

    Examples:
    | username          | role         | accountManagement                        |
    | admin@example.com | Global admin | Manage your account in Identity Provider |
