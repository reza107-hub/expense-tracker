## Purpose

Warns the user inside the app when total monthly spending nears or passes a limit they set, and when a loan is due, with alerts off until the user turns them on.

## ADDED Requirements

### Requirement: Alerts are opt-in
The system SHALL keep spending alerts off for each user until that user turns them on. While off for a user, no spending alert SHALL be shown to that user. Each user's alert setting and limit SHALL be independent of every other user's.

#### Scenario: New user
- **WHEN** the user has not enabled alerts and spends above any amount
- **THEN** no spending alert is shown

### Requirement: Total monthly limit
The system SHALL let the user set one monthly spending limit greater than zero. The limit SHALL apply to that user's total spending across all of their wallets and SHALL NOT be tied to any single wallet.

#### Scenario: Spending across wallets
- **WHEN** the limit is 30,000 and the user spent 18,000 from Bank and 13,000 from bKash
- **THEN** the system treats total spending as 31,000 and the limit as exceeded

#### Scenario: Enabled without a limit
- **WHEN** the user turns alerts on without entering a limit
- **THEN** the system asks for a limit and keeps alerts off

### Requirement: Warning and exceeded alerts
When alerts are on, the system SHALL show a warning in the app once the month's spending reaches 80% of the limit, and an exceeded alert once it passes 100%. The alert SHALL be shown right after the entry that causes it is saved, and on every page load while the condition holds in the current month.

#### Scenario: Reaches 80%
- **WHEN** the limit is 30,000 and a saved expense takes spending to 24,000
- **THEN** the system shows a warning that 80% of the limit is used

#### Scenario: Passes the limit
- **WHEN** a saved expense takes spending from 29,500 to 30,500
- **THEN** the system shows an exceeded alert with the amount over the limit

#### Scenario: Deleting an expense clears the alert
- **WHEN** the user deletes an expense and spending falls under 80% of the limit
- **THEN** no alert is shown

#### Scenario: New month
- **WHEN** a new reporting month begins
- **THEN** spending starts from zero and earlier alerts no longer show

### Requirement: Loan due alerts
When alerts are on, the system SHALL show an alert for each open loan that is overdue or due within 7 days, naming the counterparty, the outstanding amount and the due date. Wording SHALL differ for borrowed and lent loans. These alerts SHALL be worked out when the app is opened.

#### Scenario: Borrowed loan due soon
- **WHEN** a borrowed loan from "Rahim bhai" with 40,000 outstanding is due in 5 days
- **THEN** the system shows that the user owes 40,000 to Rahim bhai, due in 5 days

#### Scenario: Closed loan
- **WHEN** a loan is closed
- **THEN** no due alert is shown for it

### Requirement: In-app only
The system SHALL show alerts only inside the web app. It SHALL NOT send email, SMS or push messages.

#### Scenario: App closed
- **WHEN** the limit is passed and the user does not open the app
- **THEN** no message is sent anywhere, and the alert shows the next time the app is opened
