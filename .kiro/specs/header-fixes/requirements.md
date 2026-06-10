# Requirements Document

## Introduction

The AppLayout header in the WorkWise SaaS frontend contains three non-functional stub buttons (a plain bell icon, a plain HelpCircle icon, and a plain avatar div) and is missing a dark/light theme toggle. This feature replaces all three stubs with their already-built counterparts — `NotificationsPanel`, `HelpPanel`, and `ProfileDropdown` — and adds a `Sun`/`Moon` theme-toggle button powered by `useTheme()` from `next-themes`. The only file that changes is `AppLayout.tsx`. All four items must render correctly in both light and dark modes, and the user's theme choice must persist to `localStorage` across browser sessions.

## Glossary

- **AppLayout**: The `AppLayout.tsx` React component that wraps every authenticated dashboard page, providing the sidebar and top header.
- **Header**: The sticky `<header>` element rendered inside `AppLayout` that contains the global search bar, action icons, and the user profile control.
- **NotificationsPanel**: The pre-built component at `./NotificationsPanel` that renders a bell-icon button and an animated dropdown listing notifications.
- **HelpPanel**: The pre-built component at `./HelpPanel` that renders a HelpCircle-icon button and an animated help-resource dropdown.
- **ProfileDropdown**: The pre-built component at `./ProfileDropdown` that renders the user avatar and an animated profile/settings dropdown.
- **ThemeToggle**: A single `<button>` added to `AppLayout` that switches between light and dark themes using `useTheme()` from `next-themes`.
- **ThemeProvider**: The `next-themes` `<ThemeProvider>` already configured in `providers.tsx` with `attribute="class"` and `defaultTheme="light"`.

## Requirements

### Requirement 1

**User Story:** As a signed-in user, I want the notification bell in the header to open a real notifications panel, so that I can view and manage my in-app notifications.

#### Acceptance Criteria

1. THE `AppLayout` SHALL render the `NotificationsPanel` component in place of the dead bell `<button>` element.
2. WHEN `AppLayout` mounts, THE `AppLayout` SHALL import `NotificationsPanel` from `./NotificationsPanel` and include no inline bell button of its own.
3. WHEN a user clicks the bell icon, THE `NotificationsPanel` SHALL open its dropdown and display the list of notifications.
4. WHILE the notifications dropdown is open, THE `NotificationsPanel` SHALL display the unread-count badge on the bell icon.
5. IF the user clicks outside the `NotificationsPanel` dropdown, THEN THE `NotificationsPanel` SHALL close the dropdown.

### Requirement 2

**User Story:** As a signed-in user, I want the help icon in the header to open a real help panel, so that I can access documentation, support links, and FAQs.

#### Acceptance Criteria

1. THE `AppLayout` SHALL render the `HelpPanel` component in place of the dead HelpCircle `<button>` element.
2. WHEN `AppLayout` mounts, THE `AppLayout` SHALL import `HelpPanel` from `./HelpPanel` and include no inline HelpCircle button of its own.
3. WHEN a user clicks the help icon, THE `HelpPanel` SHALL open its dropdown and display help resources and FAQs.
4. IF the user clicks outside the `HelpPanel` dropdown, THEN THE `HelpPanel` SHALL close the dropdown.

### Requirement 3

**User Story:** As a signed-in user, I want the header avatar to open a real profile dropdown, so that I can navigate to my profile, settings, and sign out.

#### Acceptance Criteria

1. THE `AppLayout` SHALL render the `ProfileDropdown` component in place of the plain avatar `<div>`.
2. WHEN `AppLayout` mounts, THE `AppLayout` SHALL import `ProfileDropdown` from `./ProfileDropdown` and include no inline avatar div of its own.
3. WHEN a user clicks the avatar, THE `ProfileDropdown` SHALL open its dropdown and display profile links and the sign-out button.
4. IF the user clicks outside the `ProfileDropdown` dropdown, THEN THE `ProfileDropdown` SHALL close the dropdown.
5. THE `AppLayout` SHALL remove the `initials` calculation and the `user` variable that were only used by the now-replaced inline avatar div, WHERE those variables are no longer referenced elsewhere in the component.

### Requirement 4

**User Story:** As a signed-in user, I want a Sun/Moon toggle button in the header, so that I can switch between light and dark themes and have my preference remembered across sessions.

#### Acceptance Criteria

1. THE `AppLayout` SHALL render a `ThemeToggle` button in the header between the `HelpPanel` and the `NotificationsPanel`.
2. WHEN the active theme is `"light"`, THE `ThemeToggle` SHALL display a `Moon` icon from `lucide-react`.
3. WHEN the active theme is `"dark"`, THE `ThemeToggle` SHALL display a `Sun` icon from `lucide-react`.
4. WHEN a user clicks the `ThemeToggle` button, THE `AppLayout` SHALL call `setTheme` from `useTheme()` to switch to the opposite theme.
5. THE `ThemeToggle` button SHALL use the same visual style as the adjacent icon buttons (`p-2.5 rounded-xl text-slate-500 hover:...`).
6. WHEN the page reloads, THE `ThemeProvider` SHALL restore the previously selected theme from `localStorage` so that the user's choice persists across browser sessions.
7. WHEN the `ThemeToggle` renders on the server, THE `AppLayout` SHALL suppress the hydration mismatch by rendering the button only after the component is mounted on the client.
