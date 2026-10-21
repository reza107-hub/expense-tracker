## Purpose

Lets the user describe where their money sits (cash, bank, mobile wallets, crypto) with a name and a balance, without storing any phone number, account number or credential.

## ADDED Requirements

### Requirement: Create wallets without a limit
The system SHALL let each user create any number of wallets. Each wallet SHALL belong to the signed-in user only, and SHALL have a name and an opening balance of zero or more. The user SHALL be able to pick a preset name (Cash, Bank, bKash, Nagad, Rocket, Upay, Crypto) or type a custom name.

#### Scenario: Create from a preset
- **WHEN** the user picks the bKash preset and enters an opening balance of 3,200
- **THEN** the system creates a wallet named "bKash" with a balance of 3,200

#### Scenario: Create a custom wallet
- **WHEN** the user types the name "Savings jar" and an opening balance of 0
- **THEN** the system creates the wallet with a balance of 0

#### Scenario: Duplicate name
- **WHEN** the user creates a wallet whose name matches one of their own existing active wallets, ignoring letter case
- **THEN** the system rejects it and explains that the name is already used

#### Scenario: Same name as another user's wallet
- **WHEN** the user creates a wallet whose name matches a wallet that belongs to a different user
- **THEN** the system creates it normally

### Requirement: No personal identifiers stored
The system SHALL NOT ask for or store phone numbers, account numbers, card numbers or login credentials for any wallet.

#### Scenario: Wallet form fields
- **WHEN** the user opens the create or edit wallet form
- **THEN** the form offers only name, opening balance and the preset choice

### Requirement: Balance is calculated
The system SHALL show each wallet's balance as its opening balance plus every entry that affects it: income, expenses, transfers, adjustments, loan money received or paid, and loan repayments. The balance SHALL always reflect the current set of entries, including after an entry is edited or deleted.

#### Scenario: Expense lowers balance
- **WHEN** a wallet with balance 3,200 receives an expense entry of 450
- **THEN** its balance shows 2,750

#### Scenario: Deleting an entry restores the balance
- **WHEN** the user deletes that 450 expense
- **THEN** the wallet balance shows 3,200 again

### Requirement: Rename and archive wallets
The system SHALL let the user rename a wallet and change its opening balance. The system SHALL let the user archive a wallet only when its balance is zero. An archived wallet SHALL keep all past entries, SHALL NOT be offered when adding new entries, and SHALL be restorable.

#### Scenario: Archive an empty wallet
- **WHEN** the user archives a wallet with a balance of 0
- **THEN** the wallet disappears from entry forms and its past entries stay in reports

#### Scenario: Archive a wallet that holds money
- **WHEN** the user tries to archive a wallet with a balance of 1,000
- **THEN** the system refuses and tells the user to move or adjust the balance to zero first

#### Scenario: Restore a wallet
- **WHEN** the user restores an archived wallet
- **THEN** it appears in entry forms again with its calculated balance

### Requirement: Total balance
The system SHALL show the total of all of the signed-in user's active wallet balances.

#### Scenario: Total across wallets
- **WHEN** the user has Cash 5,000, Bank 40,000 and bKash 3,200
- **THEN** the total balance shows 48,200
