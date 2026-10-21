## Purpose

Uses an AI model to explain a month's spending and suggest which categories to cut to save money, while keeping the user's notes and names private and the arithmetic exact.

## ADDED Requirements

### Requirement: Advice for a month
The system SHALL let the user request saving advice for a chosen month. The advice SHALL contain a short summary and a list of suggestions, each naming a category, giving a plain-language tip and an estimated monthly saving in taka.

#### Scenario: Request advice
- **WHEN** the user requests advice for a month that has expenses
- **THEN** the system shows a summary and suggestions that each name a category, a tip and an estimated saving

#### Scenario: No expenses
- **WHEN** the user requests advice for a month with no expenses
- **THEN** the system says there is nothing to analyse and makes no request to the AI service

### Requirement: Only totals are shared
The system SHALL send to the AI service only aggregated figures: spending per category for the month and the previous month, total spending, the monthly limit if set, the total owed and loan interest and fees for the month. The system SHALL NOT send notes, wallet names, counterparty names, individual entries, email addresses, account names or any identifier. The figures SHALL come only from the signed-in user's own data.

#### Scenario: Notes stay private
- **WHEN** an expense has the note "Lunch with Rahim"
- **THEN** that text is not part of anything sent to the AI service

#### Scenario: No identity is sent
- **WHEN** a user requests advice
- **THEN** their email and any account identifier are not part of anything sent to the AI service

### Requirement: Figures come from the system, not the AI
The system SHALL calculate all totals, shares and comparisons itself and show them from its own data. A suggested saving for a category SHALL NOT exceed that category's spending for the month, and suggestions that break this rule SHALL NOT be shown.

#### Scenario: Impossible saving
- **WHEN** the AI suggests saving 5,000 on a category where the user spent 3,000
- **THEN** that suggestion is not shown

### Requirement: Advice is saved and refreshed on request
The system SHALL save the advice for each user and month, and show a user only their own saved advice when they return, with the time it was made. The system SHALL make a new AI request only when the user chooses to refresh. If the figures have not changed since the saved advice was made, a refresh SHALL reuse the saved advice and say so.

#### Scenario: Return to a month
- **WHEN** the user opens advice for a month that already has saved advice
- **THEN** the saved advice appears with its creation time and no AI request is made

#### Scenario: Refresh with new spending
- **WHEN** the user adds an expense and chooses refresh
- **THEN** the system makes a new request and replaces the saved advice

#### Scenario: Refresh with nothing new
- **WHEN** the user chooses refresh and the figures are the same as before
- **THEN** the system keeps the saved advice and says nothing has changed

### Requirement: Fresh requests are limited per user
The system SHALL allow each user at most 5 requests to the AI service per day, counted in Bangladesh time. Showing saved advice, and a refresh that reuses saved advice because the figures are unchanged, SHALL NOT count. One user reaching the limit SHALL NOT affect any other user.

#### Scenario: Limit reached
- **WHEN** a user has made 5 requests to the AI service today and asks for a sixth
- **THEN** the system makes no request, keeps their saved advice and tells them to try again tomorrow

#### Scenario: Reused advice is free
- **WHEN** a user chooses refresh and the figures have not changed
- **THEN** the system reuses the saved advice and the daily count does not change

#### Scenario: Other users are unaffected
- **WHEN** one user has reached the daily limit
- **THEN** another user can still request advice

### Requirement: Failures do not break the app
The system SHALL handle AI service errors, including free-tier rate limits and invalid responses, by showing a clear message and keeping any previously saved advice. All other features SHALL keep working.

#### Scenario: Rate limit reached
- **WHEN** the AI service refuses a request because the free limit is reached
- **THEN** the system tells the user to try again later and keeps the old advice

#### Scenario: Invalid response
- **WHEN** the AI service returns a response that cannot be read as suggestions
- **THEN** the system shows an error message and does not save it

### Requirement: Key stays on the server
The system SHALL keep the AI service key out of anything sent to the browser.

#### Scenario: Page source
- **WHEN** the user inspects the page and its scripts
- **THEN** the AI service key is not present
