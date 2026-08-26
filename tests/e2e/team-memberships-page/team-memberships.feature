Feature: Team Memberships

  # @Before: Setup a teams for creation of team membership
  Scenario Outline: Create Team
    Given the user is logged with a valid user
    And the user click on Teams option
    And the user click on create new button
    And the user create this team name <team>
    When the user click on save the teams
    Then the new team created should be displayed

    Examples:
      | team        |
      | Uteam       |
      | teamMemberA |
      | teamMemberB |
      | teamMemberC |

  # @Before: Setup a users for creation of team membership
  Scenario Outline: Create user
    Given the user is logged with a valid user
    When the user click on user option
    And the user click on Create new button
    And the user fill all the required fields <username> <userType> <status> <role> <addToTeam>
    And the user click on save user button
    Then the new user details should be loaded

    Examples:
      | username    | userType | status | role                    | addToTeam |
      | userA       | Human    | true   | global admin            | yes       |
      | userB       | Human    | true   | global viewer           | yes       |
      | userC       | Human    | true   | tenant user global role | yes       |

  Rule: Team and User already created

    Scenario Outline: Create Team Memberships
      Given the user is logged with a valid user
      When the user click on Team Memberships option
      And the user click on Create new team memberships button
      And the user fill all the required fields for team memberships <team>, <user>, <role>
      And the user click on save team memberships button
      Then the new Team Memberships details should be loaded

      Examples:
        | team        | user  | role                   |
        | teamMemberA | userA | Standard tenant access |
        | teamMemberB | userB | Tenant Admin           |
        | teamMemberC | userC | Tenant viewer          |

    Scenario Outline: Cancel Team Memberships
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      And the user click on Create new team memberships button
      And the user fill all the required fields for team memberships <team>, <user>, <role>
      When the user click on cancel team memberships button
      Then the new Team Memberships not should be created

      Examples:
        | team        | user     | role                   |
        | teamMemberA | userC    | Standard tenant access |

    Scenario: View team Memberships
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      When the user click on View team membership option from three dots option
      Then the details from Team Memberships should be displayed

    Scenario: Edit team Memberships
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      And the user click on Edit team membership option from three dots option
      And the user update the information from the team memberships
      When the user click on save team memberships button
      Then the new changes should be applied and displayed

    Scenario: Edit team Memberships tab
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      And the user click on the first team memberships from the table
      And the user click on edit team membership tab
      And the user update the information from the team memberships
      When the user click on save team memberships button
      Then the new changes should be applied and displayed

    Scenario: Cancel Edit team memberships
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      And the user click on Edit team membership option from three dots option
      When the user click on cancel team memberships button
      Then the team information not should be updated

    Scenario: Cancel Delete team memberships
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      And the user click on Delete team membership option from three dots option
      When the user click on no button for team membership delete confirmation
      Then the team memberships should not be removed from the team table

    Scenario: Delete team memberships
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      And the user click on Delete team membership option from three dots option
      When the user click on yes button for team membership delete confirmation
      Then the team memberships should be removed from the team table

    Scenario: Delete team memberships tab
      Given the user is logged with a valid user
      And the user click on Team Memberships option
      And the user click on the firsts team membership from the table
      And the user click on Delete team membership tab
      When the user click on yes button for team membership delete confirmation
      Then the team memberships should be removed from the team table
