Feature: Users

  # @Before: Setup a team for creation of users
  Scenario Outline: Create Team
    Given the user is logged with a valid user
    And the user click on Teams option
    And the user click on create new button
    And the user fill the required fields
    When the user click on save the teams
    Then the new team created should be displayed

  Scenario Outline: Create user
    Given the user is logged with a valid user
    When the user click on user option
    And the user click on Create new button
    And the user fill all the required fields <username> <userType> <status> <role> <addToTeam>
    And the user click on save user button
    Then the new user details should be loaded

    Examples:
      | username    | userType | status | role                    | addToTeam |
      | userZ       | Human    | true   | global admin            | yes       |
      | userW       | Human    | true   | global viewer           | yes       |
      | userX       | Human    | true   | tenant user global role | yes       |
      | userY       | Human    | true   | global admin            | no        |
      | userE       | Human    | true   | global viewer           | no        |
      | userF       | Human    | true   | tenant user global role | no        |
      | userG       | Human    | false  | global admin            | no        |
      | userH       | Human    | false  | global viewer           | no        |
      | userI       | Human    | false  | tenant user global role | no        |
      | userO       | Human    | false  | global admin            | yes       |
      | userP       | Human    | false  | global viewer           | yes       |
      | userQ       | Human    | false  | tenant user global role | yes       |
      | machineA    | Machine  | true   | global admin            | yes       |
      | machineB    | Machine  | true   | global viewer           | yes       |
      | machineC    | Machine  | true   | tenant user global role | yes       |
      | machineD    | Machine  | true   | global admin            | no        |
      | machineE    | Machine  | true   | global viewer           | no        |
      | machineF    | Machine  | true   | tenant user global role | no        |
      | machineG    | Machine  | false  | global admin            | no        |
      | machineH    | Machine  | false  | global viewer           | no        |
      | machineI    | Machine  | false  | tenant user global role | no        |
      | machineJ    | Machine  | false  | global admin            | yes       |
      | machineK    | Machine  | false  | global viewer           | yes       |
      | machineL    | Machine  | false  | tenant user global role | yes       |

  Scenario Outline: Cancel user
    Given the user is logged with a valid user
    When the user click on user option
    And the user click on Create new button
    And the user fill all the required fields <username> <userType> <familyName> <status> <role> <addToTeam>
    And the user click on cancel user button
    Then the new user <userType> not should be created

    Examples:
      | username       | userType | familyName | status | role         | addToTeam |
      | cancelUserA    | Human    | familyA    | true   | global admin | yes       |
      | cancelMachineB | Machine  | familyB    | true   | global admin | yes       |

  Scenario: User human type Required Fields
    Given the user is logged with a valid user
    When the user click on user option
    And the user click on Create new button
    And the user click on save user button without to fill any field
    Then only required fields will be highlighted username, given name , family name

  Scenario: User machine type Required Fields
    Given the user is logged with a valid user
    When the user click on user option
    And the user click on Create new button
    And the user click on machine user type
    And the user click on save user button without to fill any field
    Then only required fields will be highlighted username, description, client id

  Rule: User already has a user created

    Scenario: View user
      Given the user is logged with a valid user
      And the user click on user option
      When the user click on View user option from three dots option
      Then the details of current user should be displayed

    Scenario: Add to Team User
      Given the user is logged with a valid user
      And the user click on user option
      When the user click on Add to Team option from three dots option
      Then the teams forms should be loaded for create a new team

    Scenario: Edit User
      Given the user is logged with a valid user
      And the user click on user option
      When the user click on Edit option from three dots option
      Then the teams forms should be loaded for edit current user

    Scenario: Edit tab User
      Given the user is logged with a valid user
      And the user click on user option
      And the user click on the firsts user from the table
      When the user click on Edit tab
      Then the teams forms should be loaded for edit current user

    Scenario: Cancel Edit User
      Given the user is logged with a valid user
      And the user click on user option
      And the user click on Edit option from three dots option
      When the user click on cancel user edit button
      Then table user should be loaded without to change some data

    Scenario: Delete User
      Given the user is logged with a valid user
      And the user click on user option
      And the user click on Delete option from three dots option
      When the user click on yes button for user delete confirmation
      Then the user created should be removed from table user

    Scenario: Delete tab Users
      Given the user is logged with a valid user
      And the user click on user option
      And the user click on the first user from the table
      And the user click on Delete tab
      When the user click on yes button for user delete confirmation
      Then the user created should be removed from table user

    Scenario: Cancel Delete User
      Given the user is logged with a valid user
      And the user click on user option
      And the user click on Delete option from three dots option
      When the user click on no button for user delete confirmation
      Then the user created not should be removed from the user table loaded

    # @After: Remove the team created
    Scenario Outline: Delete Team
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on delete option using three dots option
      And the user click on yes button on popup message
      Then the environment should removed from the list of environments
