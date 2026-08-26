Feature: Login Page

  Scenario Outline: User login page right corner
    Given the user is on login page
    When the user clicks on Login button in the right corner
    Then page should be redirect to keycloak login page

  Scenario Outline: User login page
    Given the user is on login page
    When the user clicks on Login button
    Then page should be redirect to keycloak login page

  Scenario Outline: User can go Learn More page
    Given the user is on login page
    When the user clicks on Learn more button
    Then page should be redirect to education analytics page

  Scenario Outline: User can report an issue
    Given the user is on login page
    When the user clicks on report an issue
    Then the community page should be opened

  Scenario Outline: User footer page
    Given the user is on login page
    When the user review the footer page
    Then the years shown must match the year of creation and the current year
