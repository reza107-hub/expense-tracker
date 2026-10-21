## Purpose

Groups expenses into categories so reports and advice show where money goes, with a ready default list that the user can extend.

## ADDED Requirements

### Requirement: Default categories
The system SHALL provide these categories to every account from the moment it is created: Food, Transport, Bills, Shopping, Health, Mobile recharge, Rent and Other. The system SHALL also provide each account a reserved category "Loan interest and fees" that is used only for loan costs. Each user's categories SHALL be their own copy, so changes by one user never affect another.

#### Scenario: First use
- **WHEN** the user adds their first expense
- **THEN** the category list already contains the default categories

#### Scenario: Reserved category in forms
- **WHEN** the user records a normal expense
- **THEN** "Loan interest and fees" is not offered in the category list

### Requirement: Add custom categories
The system SHALL let the user add categories with a name. Names SHALL be unique within that user's categories, ignoring letter case, and MAY match another user's category.

#### Scenario: Add a category
- **WHEN** the user adds "Education"
- **THEN** it appears in the category list for new expenses

#### Scenario: Duplicate name
- **WHEN** the user adds "food" while "Food" exists
- **THEN** the system rejects it and explains that the name is already used

### Requirement: Rename and archive categories
The system SHALL let the user rename a category and archive it. The system SHALL NOT delete categories. An archived category SHALL NOT be offered for new expenses, SHALL stay on past entries and in past reports, and SHALL be restorable. The reserved loan category SHALL NOT be archivable.

#### Scenario: Archive a used category
- **WHEN** the user archives "Shopping", which has past expenses
- **THEN** past reports still show those expenses under "Shopping" and new expenses cannot use it

#### Scenario: Rename a category
- **WHEN** the user renames "Other" to "Misc"
- **THEN** past entries and reports show "Misc"

#### Scenario: Restore a category
- **WHEN** the user restores an archived category
- **THEN** it is offered for new expenses again
