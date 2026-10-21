## Purpose

Lets the user record money going out, coming in, moving between wallets and changing in value, so every wallet balance and every monthly total is correct.

## ADDED Requirements

### Requirement: Entries use only the user's own wallets and categories
Every entry SHALL belong to the signed-in user. The wallets, destination wallets and categories an entry names SHALL all belong to that same user.

#### Scenario: Wallet from another account
- **WHEN** the user submits an entry that names a wallet or category belonging to a different user
- **THEN** the system rejects it and creates no entry

#### Scenario: Entry list is private
- **WHEN** two users have recorded entries and one of them opens the entry list
- **THEN** only that user's entries appear

### Requirement: Record an expense
The system SHALL let the user record an expense with an amount, a wallet to pay from, a category, a date and an optional note. The expense SHALL lower the chosen wallet's balance and SHALL count as spending.

#### Scenario: Expense from bKash
- **WHEN** the user enters 450 for Food, chooses bKash as the wallet and saves
- **THEN** the bKash balance drops by 450 and the month's spending rises by 450

#### Scenario: Wallet must be chosen
- **WHEN** the user saves an expense without choosing a wallet
- **THEN** the system rejects it and asks the user to choose a wallet

### Requirement: Record income
The system SHALL let the user add money to a wallet with an amount, a date and an optional note. Income SHALL raise the wallet balance and SHALL NOT count as spending.

#### Scenario: Salary into the bank
- **WHEN** the user adds 20,000 to the Bank wallet
- **THEN** the Bank balance rises by 20,000 and the month's spending does not change

### Requirement: Transfer between wallets
The system SHALL let the user move an amount from one wallet to a different wallet. A transfer SHALL lower the source balance and raise the destination balance by the same amount, and SHALL NOT count as spending or income.

#### Scenario: Cash in to bKash
- **WHEN** the user transfers 5,000 from Bank to bKash
- **THEN** Bank drops by 5,000, bKash rises by 5,000 and the month's spending does not change

#### Scenario: Same wallet chosen twice
- **WHEN** the user picks the same wallet as source and destination
- **THEN** the system rejects the transfer

### Requirement: Adjust a wallet balance
The system SHALL let the user set a wallet to a new balance. The system SHALL record the difference as an adjustment that changes only that wallet's balance and SHALL NOT count as income or spending.

#### Scenario: Crypto value changes
- **WHEN** the Crypto wallet shows 50,000 and the user adjusts it to 52,000
- **THEN** the Crypto balance shows 52,000 and neither income nor spending changes

### Requirement: Amount and date validation
The system SHALL accept only amounts greater than zero with at most two decimal places, in Bangladeshi taka. The system SHALL reject dates in the future.

#### Scenario: Zero amount
- **WHEN** the user saves an entry with an amount of 0
- **THEN** the system rejects it with a clear message

#### Scenario: Future date
- **WHEN** the user saves an entry dated tomorrow
- **THEN** the system rejects it with a clear message

### Requirement: Low balance warns but does not block
The system SHALL warn when an expense or transfer would take a wallet below zero, and SHALL still save it if the user confirms.

#### Scenario: Expense above balance
- **WHEN** the user saves an expense of 5,000 from a wallet with a balance of 3,000 and confirms the warning
- **THEN** the system saves it and the wallet shows a balance of -2,000

#### Scenario: User cancels at the warning
- **WHEN** the user does not confirm the warning
- **THEN** nothing is saved

### Requirement: Edit and delete entries
The system SHALL let the user edit or delete any entry. Wallet balances and reports SHALL reflect the change immediately.

#### Scenario: Edit an amount
- **WHEN** the user changes an expense from 450 to 500
- **THEN** the wallet balance drops by a further 50 and the month's spending rises by 50

#### Scenario: Delete an entry
- **WHEN** the user confirms deleting an expense
- **THEN** the entry no longer appears and the balance and totals are restored

### Requirement: Entry list
The system SHALL list entries for a chosen month, newest first, showing type, amount, wallet, category and note. The user SHALL be able to filter by wallet and by category.

#### Scenario: Filter by wallet
- **WHEN** the user filters the list by bKash
- **THEN** the list shows only entries that touch bKash
