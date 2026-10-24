## Purpose

Lets each person use the whole app in English or Bangla, switched with one control and remembered on their device, while keeping money figures and saved data exact.

## ADDED Requirements

### Requirement: Language switch
The system SHALL offer a language switch with the choices "EN" and "বাং" in the top header on a phone, at the top of the sidebar on a larger screen, and on the sign-in and registration pages. The current language SHALL be marked. Selecting the other language SHALL change the whole screen without the user signing in again or losing a form's page.

#### Scenario: Switch on a phone
- **WHEN** a signed-in user on a 360 pixel wide screen selects "বাং" in the header
- **THEN** the menu, headings, labels, buttons and messages on the screen change to Bangla

#### Scenario: Switch before signing in
- **WHEN** a visitor selects "বাং" on the sign-in page
- **THEN** the sign-in page is shown in Bangla

#### Scenario: Switch back
- **WHEN** the user selects "EN" again
- **THEN** the screen returns to English

### Requirement: Choice is remembered
The system SHALL remember the chosen language on that device, across pages, reloads, sign-out and sign-in, for one year. English SHALL be used when no choice has been made. The remembered value SHALL be only "en" or "bn", and any other value SHALL be treated as English. The choice SHALL NOT change any other user's screen.

#### Scenario: Return later
- **WHEN** the user chose Bangla, closed the browser and opened the app the next day
- **THEN** the app opens in Bangla

#### Scenario: Unknown value
- **WHEN** the remembered language is any value other than "en" or "bn"
- **THEN** the app is shown in English

### Requirement: Screens are fully translated
When Bangla is chosen, the system SHALL show in Bangla all navigation, page titles and descriptions, form labels, hints and placeholders, button text, empty-state messages, confirmation questions, status labels, alert banners, the saving-advice section's fixed text, and month names in dates and reports. English and Bangla text SHALL have exactly the same set of entries, so no screen can show a blank or a raw key.

#### Scenario: Wallets page in Bangla
- **WHEN** Bangla is chosen and the user opens Wallets
- **THEN** the title, the "Add a wallet" form, its hints and buttons, and the archive and restore controls are in Bangla

#### Scenario: Month names
- **WHEN** Bangla is chosen and the user opens the report for October 2026
- **THEN** the month is shown with its Bangla name and the dates around it use Bangla month names

#### Scenario: Missing translation
- **WHEN** a text entry exists in English but not in Bangla
- **THEN** the automated checks fail before the change is released

### Requirement: Numbers and money stay the same
The system SHALL show amounts, dates and counts with the same digits in both languages (for example 12,345, with only the month names of a date changing), SHALL keep the taka sign, and SHALL NOT change any stored value when the language changes.

#### Scenario: Balance in Bangla
- **WHEN** a wallet holds ৳ 1,25,000 and the user switches to Bangla
- **THEN** the balance is still shown as ৳ 1,25,000

### Requirement: Bangla text is readable
The system SHALL draw Bangla text with a font that supports Bangla letters and SHALL keep every screen usable at 360 pixels wide in Bangla, with no sideways scrolling and no text cut off in buttons, tabs or the menu.

#### Scenario: Long Bangla labels on a phone
- **WHEN** Bangla is chosen on a 360 pixel wide screen and the user opens Entries
- **THEN** the entry type tabs, form labels and buttons are fully visible

### Requirement: Page language is declared
The system SHALL declare the page language ("en" or "bn") so screen readers and browsers use the right voice and hyphenation, and SHALL update it when the language changes.

#### Scenario: Screen reader
- **WHEN** Bangla is chosen
- **THEN** the page declares Bangla as its language

### Requirement: What stays in English for now
In this version the system SHALL keep in English: messages returned by the server after a form is sent (for example a failed check), names the user or the system saved (wallet and category names, including the default categories and "Loan interest and fees"), the browser tab title, and the text of Gemini saving advice. The system SHALL NOT mix Bangla into saved data, and SHALL NOT send the chosen language or any translated text to the advice service.

#### Scenario: Saved names
- **WHEN** Bangla is chosen and the user has a wallet named "bKash" and a category "Food"
- **THEN** both names are shown exactly as saved

#### Scenario: Form error
- **WHEN** Bangla is chosen and the user enters an amount of zero
- **THEN** the error message is shown in English, and the label and button around it are in Bangla
