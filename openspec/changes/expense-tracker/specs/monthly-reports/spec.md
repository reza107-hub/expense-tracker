## Purpose

Shows the user how much they spent in a month and where, how their wallets and debts stand, and how this month compares with the last, using a month that starts on a day the user chooses.

## ADDED Requirements

### Requirement: Month start day
The system SHALL define a reporting month as running from a start day to the day before the next start day. The start day SHALL be a separate setting for each user, SHALL default to 1, SHALL be changeable in that user's settings to any day from 1 to 28, and SHALL use the Bangladesh time zone. Changing it SHALL change how entries are grouped into months and SHALL NOT change any entry.

#### Scenario: Default month
- **WHEN** the start day is 1
- **THEN** the October report covers 1 October to 31 October

#### Scenario: Salary-day month
- **WHEN** the user sets the start day to 25
- **THEN** the report named for October covers 25 October to 24 November, and the "this month" view contains the period that includes today

#### Scenario: Start day out of range
- **WHEN** the user enters a start day of 31
- **THEN** the system rejects it and explains that the day must be from 1 to 28

### Requirement: Spending total
The system SHALL show total spending for a month as the sum of the signed-in user's expense entries in that month. Every figure in every report SHALL use only that user's data. Income, transfers, adjustments and loan principal movements SHALL NOT be included.

#### Scenario: Only expenses counted
- **WHEN** a month has 6,000 of expenses, a 20,000 income, a 5,000 transfer and a 50,000 loan received
- **THEN** total spending shows 6,000

### Requirement: Breakdown by category and wallet
The system SHALL show spending for the month by category and by wallet, with each category's share of total spending, ordered from largest to smallest.

#### Scenario: Category shares
- **WHEN** Food is 8,000 of 20,000 total spending
- **THEN** Food shows 8,000 and 40%

### Requirement: Comparison with the previous month
The system SHALL show the change in total spending and in each category compared with the previous month, as an amount and a percentage. When the previous month has no spending the percentage SHALL be shown as not available.

#### Scenario: Higher than last month
- **WHEN** this month's Food is 9,000 and last month's was 7,500
- **THEN** the report shows Food up by 1,500 (20%)

### Requirement: Recent trend
The system SHALL show total spending for the last six months, including the current one.

#### Scenario: New user
- **WHEN** only the current month has entries
- **THEN** earlier months show 0

### Requirement: Dashboard overview
The system SHALL show on the home page the balance of each active wallet, the total balance, the total owed and owed to the user, the net position, and this month's spending. The net position SHALL be the total balance plus money owed to the user minus money the user owes.

#### Scenario: Net position
- **WHEN** the total balance is 48,200, the user owes 40,000 and others owe 0
- **THEN** the net position shows 8,200

### Requirement: Empty month
The system SHALL show a clear empty state when a month has no entries, without errors or misleading zeros in percentages.

#### Scenario: No entries
- **WHEN** the user opens a month with no entries
- **THEN** the report says there is nothing recorded and offers to add an entry

### Requirement: Dark, responsive display
The system SHALL present all screens in a dark colour scheme and SHALL remain fully usable on a phone-sized screen.

#### Scenario: Phone screen
- **WHEN** the user opens the dashboard on a 360 pixel wide screen
- **THEN** all content is reachable without sideways scrolling and entry forms are usable
