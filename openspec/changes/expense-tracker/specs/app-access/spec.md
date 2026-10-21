## Purpose

Gives each person their own account on a publicly reachable web address, keeps them signed in on a trusted device, and makes sure each user can only ever see and change their own financial data.

## ADDED Requirements

### Requirement: Register with email and password
The system SHALL let a visitor create an account with an email address and a password. The email SHALL be treated as the same address regardless of letter case or surrounding spaces, and each address SHALL have at most one account. The password SHALL be 8 to 128 characters. The system SHALL NOT ask for a phone number. The system SHALL store only a one-way hash of the password.

#### Scenario: Successful registration
- **WHEN** a visitor submits a new email and a password of 8 or more characters
- **THEN** the system creates the account, signs the visitor in and opens the dashboard

#### Scenario: Email already registered
- **WHEN** a visitor registers with an email that already has an account, in any letter case
- **THEN** the system rejects it and says the email is already registered

#### Scenario: Invalid email or weak password
- **WHEN** a visitor submits a malformed email, or a password shorter than 8 characters
- **THEN** the system rejects it, explains which field is wrong and creates no account

#### Scenario: Passwords do not match
- **WHEN** the password and its confirmation differ
- **THEN** the system rejects the form and creates no account

### Requirement: Optional sign-up allow-list
The system SHALL accept registrations from any email unless an allow-list of emails is configured. When an allow-list is configured, the system SHALL reject registration for any email not on it, without creating an account.

#### Scenario: Open sign-up
- **WHEN** no allow-list is configured and a visitor registers
- **THEN** the system creates the account

#### Scenario: Email not on the allow-list
- **WHEN** an allow-list is configured and a visitor registers with an email that is not on it
- **THEN** the system rejects the registration with a clear message and creates no account

#### Scenario: Email on the allow-list
- **WHEN** an allow-list is configured and a visitor registers with an email on it, in any letter case
- **THEN** the system creates the account

### Requirement: Sign in with email and password
The system SHALL sign a user in when the email and password match an account. When they do not match, the system SHALL show the same generic "incorrect email or password" message whether the email is unknown or the password is wrong.

#### Scenario: Correct credentials
- **WHEN** a user submits the correct email and password
- **THEN** the system starts a session and opens the dashboard

#### Scenario: Wrong password
- **WHEN** a user submits a registered email with a wrong password
- **THEN** the system shows "incorrect email or password" and starts no session

#### Scenario: Unknown email
- **WHEN** a visitor submits an email that has no account
- **THEN** the system shows the same "incorrect email or password" message

### Requirement: Session persists across visits
The system SHALL keep a user signed in for 90 days after sign-in, across browser restarts, without asking for the password again. The session SHALL NOT be readable by page scripts.

#### Scenario: Returning within the session period
- **WHEN** a user returns 30 days after signing in on the same browser
- **THEN** the system opens the dashboard without asking for the password

#### Scenario: Session expired
- **WHEN** a user returns more than 90 days after signing in
- **THEN** the system redirects them to the sign-in page

### Requirement: Sign out
The system SHALL let the user end the session from any page. A session that was ended SHALL no longer open any page or allow any action.

#### Scenario: User signs out
- **WHEN** the user chooses sign out
- **THEN** the system ends the session and shows the sign-in page, and the ended session no longer opens any page

### Requirement: Every page and action requires a signed-in user
The system SHALL require a valid session for every page and every data-changing or data-reading action, except the sign-in and registration pages. A page request without a valid session SHALL be redirected to the sign-in page. An action without a valid session SHALL be rejected and change nothing.

#### Scenario: Visitor without a session opens a page
- **WHEN** a visitor with no session opens any page other than sign-in and registration
- **THEN** the system redirects them to the sign-in page and shows no financial data

#### Scenario: Action sent without a session
- **WHEN** a data-changing action is submitted without a valid session
- **THEN** the system rejects it and no data is created, changed or deleted

#### Scenario: Signed-in user opens sign-in or registration
- **WHEN** a signed-in user opens the sign-in or registration page
- **THEN** the system sends them to the dashboard

### Requirement: Each user's data is private
The system SHALL show and change only the data that belongs to the signed-in user: wallets, categories, entries, loans, settings and saved advice. A request that names a record belonging to another user SHALL behave exactly as if the record does not exist, and SHALL change nothing. The system SHALL NOT allow an entry or loan to use another user's wallet or category.

#### Scenario: Lists show only own data
- **WHEN** user A has 3 wallets and user B has 2 wallets, and user B opens the wallets page
- **THEN** the page shows only user B's 2 wallets

#### Scenario: Reading another user's record
- **WHEN** user B requests a wallet, entry or loan that belongs to user A
- **THEN** the system responds as if it does not exist

#### Scenario: Changing another user's record
- **WHEN** user B submits an edit or delete for a record that belongs to user A
- **THEN** the system rejects it and user A's record is unchanged

#### Scenario: Using another user's wallet
- **WHEN** user B records an expense that names user A's wallet
- **THEN** the system rejects it and no entry is created

#### Scenario: Same names in different accounts
- **WHEN** user A and user B each create a wallet named "bKash"
- **THEN** both succeed and neither sees the other's wallet

### Requirement: New accounts start ready to use
The system SHALL give each new account the default categories and default settings (month start day 1, alerts off) when the account is created. A new account SHALL have no wallets, entries or loans.

#### Scenario: First sign-in
- **WHEN** a user signs in for the first time after registering
- **THEN** they see the default categories, no wallets and a zero balance

#### Scenario: Separate defaults
- **WHEN** user B registers after user A has renamed and archived categories
- **THEN** user B sees the original default categories

### Requirement: Repeated failures lock one email
The system SHALL reject further sign-in attempts for an email for 15 minutes after 5 failed attempts for that email within 15 minutes, including attempts with the correct password. A lock on one email SHALL NOT affect any other email. The system SHALL apply the same lock and the same message to emails that have no account.

#### Scenario: Too many wrong attempts
- **WHEN** 5 incorrect passwords are submitted for one email within 15 minutes
- **THEN** the system rejects the next attempt for that email, even with the correct password, and tells the user to try again later

#### Scenario: Other users are not affected
- **WHEN** one email is locked
- **THEN** every other email can still sign in normally

#### Scenario: Unknown email locks the same way
- **WHEN** 5 attempts are made for an email that has no account
- **THEN** the system shows the same lock message as for a real account

#### Scenario: Lock period ends
- **WHEN** 15 minutes have passed since the lock began
- **THEN** the system accepts the correct password for that email again

#### Scenario: Success clears the count
- **WHEN** a user signs in successfully after some failed attempts
- **THEN** the failed attempts for that email no longer count toward a lock
