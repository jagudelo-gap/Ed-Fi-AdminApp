Feature: Home Page
Scenario Outline: Home Page

Given the user is logged with a valid user
When the user click on <option> on Home option
Then the main page should be loaded
And a welcome message displayed

Examples:

| option |
| menu   |
| logo   |
| main   |
