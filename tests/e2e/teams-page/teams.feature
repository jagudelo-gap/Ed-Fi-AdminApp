Feature: Teams

  Scenario Outline: Create Team
    Given the user is logged with a valid user
    And the user click on Teams option
    And the user click on create new button
    And the user fill the required fields
    When the user click on save the teams
    Then the new team created should be displayed

  Scenario Outline: Cancel Team
    Given the user is logged with a valid user
    And the user click on Teams option
    And the user click on create new button
    And the user fill the required fields
    When the user click on cancel the teams
    Then new team not should be created

  Rule: User already has a Team created

    Scenario Outline: Assume team scope
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on Assume team scope option using three dots option
      Then the home page from the team created should be loaded

    Scenario Outline: Add existing user to team
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on Add existing user to option using three dots option
      Then the Create new team membership form should be loaded

    Scenario Outline: Give team New resource ownership
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on Give New resource ownership option using three dots option
      Then the new Grant new resource ownership form should be loaded

    Scenario Outline: View Team
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on view option using three dots option
      Then the details of the team created should be displayed

    Scenario Outline: Edit Team
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on edit option using three dots option
      And the user sets a new name
      And the user click on save the teams
      Then the new name team should be updated

    Scenario Outline: Cancel Edit Team
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on edit option using three dots option
      And the user sets a new name
      And the user click on cancel the teams
      Then the team name should not be changed

    Scenario Outline: Cancel Delete Team
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on delete option using three dots option
      And the user click on no button on popup message
      Then the environment should not removed from the list of environments

    Scenario Outline: Delete Team
      Given the user is logged with a valid user
      And the user click on Teams option
      When the user click on delete option using three dots option
      And the user click on yes button on popup message
      Then the environment should removed from the list of environments
