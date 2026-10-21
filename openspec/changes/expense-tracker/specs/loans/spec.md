## Purpose

Tracks money the user borrows or lends, including who it is with, how much is still outstanding and when it is due, without distorting monthly spending.

## ADDED Requirements

### Requirement: Record a loan
The system SHALL let the user record a loan as either "I borrowed" or "I lent". A loan SHALL have a counterparty name, an amount, a wallet, a date, an optional due date and an optional note. The system SHALL NOT ask for a phone number or account number. A loan and everything recorded against it SHALL belong to the signed-in user and SHALL use only that user's wallets.

#### Scenario: Borrow money
- **WHEN** the user records "I borrowed" 50,000 from "Rahim bhai" into the Bank wallet
- **THEN** the Bank balance rises by 50,000, the user owes 50,000, and neither income nor spending changes

#### Scenario: Lend money
- **WHEN** the user records "I lent" 10,000 to "Karim" from the Cash wallet
- **THEN** the Cash balance drops by 10,000, Karim owes the user 10,000, and spending does not change

### Requirement: Record a repayment
The system SHALL let the user record repayments against a loan, each with a wallet, a date and a principal amount. For a borrowed loan the wallet SHALL be lowered, and for a lent loan the wallet SHALL be raised. The principal amount SHALL NOT exceed the amount still outstanding. A repayment SHALL NOT count as spending or income.

#### Scenario: Partial repayment of a borrowed loan
- **WHEN** the user repays 10,000 of a 50,000 borrowed loan from bKash
- **THEN** bKash drops by 10,000, the outstanding amount shows 40,000, and spending does not change

#### Scenario: Overpayment
- **WHEN** the user enters a principal amount larger than the outstanding amount
- **THEN** the system rejects it and shows the outstanding amount

### Requirement: Interest and fees
A repayment SHALL accept an optional interest or fee amount. For a borrowed loan this amount SHALL lower the wallet and count as spending in the reserved "Loan interest and fees" category. For a lent loan this amount SHALL raise the wallet and count as income. Interest or fees SHALL NOT change the outstanding principal.

#### Scenario: Fee on a borrowed loan
- **WHEN** the user repays 10,000 principal plus 500 interest from bKash
- **THEN** bKash drops by 10,500, the outstanding principal drops by 10,000 and the month's spending rises by 500

#### Scenario: Interest received on a lent loan
- **WHEN** the user records a repayment of 2,000 principal plus 100 interest received into Cash
- **THEN** Cash rises by 2,100, the outstanding principal drops by 2,000 and income rises by 100

### Requirement: Loan status
The system SHALL show for each loan the original amount, the principal repaid, the outstanding amount, the due date and a status of open or closed. A loan SHALL be closed when its outstanding amount is zero.

#### Scenario: Final repayment
- **WHEN** a repayment brings the outstanding amount to zero
- **THEN** the loan shows as closed

#### Scenario: Deleting a repayment reopens a loan
- **WHEN** the user deletes the final repayment of a closed loan
- **THEN** the loan shows as open with the restored outstanding amount

### Requirement: Loan totals
The system SHALL show the total the user owes and the total others owe the user, counting open loans only.

#### Scenario: Totals on the dashboard
- **WHEN** the user has one borrowed loan with 40,000 outstanding and no lent loans
- **THEN** the dashboard shows "You owe 40,000" and "Others owe you 0"

### Requirement: Edit and delete loans
The system SHALL let the user edit a loan's counterparty, due date and note, and delete a loan. Deleting a loan SHALL remove its repayments, interest and fees, and the wallet balances and reports SHALL reflect that after the user confirms.

#### Scenario: Delete a loan
- **WHEN** the user confirms deleting a loan that has two repayments
- **THEN** the loan, its repayments and their effects on wallets and spending are removed
