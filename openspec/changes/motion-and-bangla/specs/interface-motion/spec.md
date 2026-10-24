## Purpose

Makes moving around the app and pressing controls feel smooth and clear, so the user can see that a click worked and that a page is loading, without slowing real work or bothering people who prefer less motion.

## ADDED Requirements

### Requirement: Smooth page transitions
The system SHALL animate the change from one page to another with a soft fade and a small upward movement. The animation SHALL take about 350 milliseconds from start to finish. The animation SHALL NOT delay the page: content that is ready SHALL appear as soon as the animation ends, and the user SHALL be able to click again at any time.

#### Scenario: Open another page from the menu
- **WHEN** the user selects "Wallets" while on Home
- **THEN** Home fades out and Wallets fades in over about 350 milliseconds

#### Scenario: Browser back button
- **WHEN** the user presses the browser's back button
- **THEN** the previous page appears with the same transition

#### Scenario: Browser without support
- **WHEN** the browser cannot animate page changes
- **THEN** the page changes at once and every feature still works

### Requirement: Loading placeholders
While a page or a section of a page is loading, the system SHALL show a pulsing placeholder shaped like the content it stands in for, and SHALL NOT show only the word "Loading". When the content is ready it SHALL replace the placeholder with a fade. A placeholder SHALL NOT show another user's data or any figure.

#### Scenario: Slow page
- **WHEN** the user opens Reports and the figures are still being worked out
- **THEN** pulsing placeholder blocks are shown where the cards and lists will appear, and they fade into the real report when it is ready

#### Scenario: Placeholder does not shift the page
- **WHEN** the real content replaces the placeholder
- **THEN** the heading and the menu stay where they were

### Requirement: Click feedback
Every button, link, drop-down and menu item SHALL respond to a press with a short animation of about 120 milliseconds: a small shrink while pressed and a smooth change of colour on hover and focus. A button that is disabled or busy SHALL NOT shrink. The keyboard focus ring SHALL stay visible at all times.

#### Scenario: Press a button
- **WHEN** the user presses "Add wallet"
- **THEN** the button shrinks slightly while pressed and returns smoothly when released

#### Scenario: Disabled button
- **WHEN** a button is disabled while a save is running
- **THEN** it does not shrink and it looks dimmed

### Requirement: Progress while navigating
When the user selects a navigation link and the next page is not ready yet, the system SHALL show that link as busy with a gentle pulse until the page appears.

#### Scenario: Slow connection
- **WHEN** the user selects "Loans" on a slow connection
- **THEN** the "Loans" menu item pulses until the Loans page is shown

### Requirement: Panels open smoothly
A panel that opens in place, such as an edit form, a delete confirmation or a repayment form, SHALL appear with a short fade and a small upward movement of about 200 milliseconds.

#### Scenario: Open an edit form
- **WHEN** the user selects "Edit" on a wallet
- **THEN** the edit form fades in below the wallet name rather than appearing at once

### Requirement: Reduced motion
When the user's device asks for reduced motion, the system SHALL NOT play page transitions, pulsing, shrinking or movement. Content SHALL still change correctly and colours MAY change at once.

#### Scenario: Reduced motion is on
- **WHEN** the device setting for reduced motion is on and the user opens another page
- **THEN** the page changes with no animation and no placeholder pulse

### Requirement: Motion uses theme values only
All motion timings SHALL come from shared settings in one place so they can be tuned together, and the animation SHALL NOT introduce any hard-coded colour.

#### Scenario: Change the page speed
- **WHEN** the page transition setting is changed from 350 to 500 milliseconds
- **THEN** every page transition uses the new time with no other edit
