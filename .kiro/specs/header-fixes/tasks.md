
# Implementation Plan: Header Fixes

## Overview

All changes are confined to `AppLayout.tsx`. The plan removes three dead UI stubs, imports the pre-built panel components in their place, and adds an inline theme-toggle button. No new files are created beyond optional test files.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1"] },
    { "wave": 2, "tasks": ["2.1", "2.2", "2.3", "3.1"] },
    { "wave": 3, "tasks": ["2.4", "3.2"] },
    { "wave": 4, "tasks": ["3.3"] },
    { "wave": 5, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Clean up dead imports and dead code in AppLayout.tsx
  - Remove `Bell` and `HelpCircle` from the `lucide-react` import line (keep `Search`).
  - Remove `const { user } = useUser()` (the `useUser` import can be dropped too).
  - Remove `const initials = user ? ...` — it is only used by the avatar div being replaced.
  - Leave `useAuth`, `useRouter`, `usePathname`, `motion`, `Sidebar`, and `Search` imports intact.
  - _Requirements: 1.2, 2.2, 3.2, 3.5_

- [x] 2. Wire up the three pre-built panel components
  - [x] 2.1 Import and render NotificationsPanel
    - Add `import NotificationsPanel from './NotificationsPanel';` at the top of the file.
    - Replace the inline bell `<button>` (including its red-dot `<span>`) with `<NotificationsPanel />`.
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 2.2 Import and render HelpPanel
    - Add `import HelpPanel from './HelpPanel';` at the top of the file.
    - Replace the inline HelpCircle `<button>` with `<HelpPanel />`.
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 2.3 Import and render ProfileDropdown
    - Add `import ProfileDropdown from './ProfileDropdown';` at the top of the file.
    - Replace the entire `<div className="flex items-center gap-3 ...">` avatar div with `<ProfileDropdown />`.
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 2.4 Write component tests for panel wiring
    - Assert `getByLabelText('Notifications')` is present in the rendered header.
    - Assert `getByLabelText('Help & Support')` is present in the rendered header.
    - Assert `getByLabelText('User profile')` is present in the rendered header.
    - Assert no orphaned inline bell button or HelpCircle button remains in the DOM.
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2_

- [x] 3. Add the ThemeToggle button
  - [x] 3.1 Add useTheme hook and isMounted guard
    - Add `import { useTheme } from 'next-themes';` and `import { Sun, Moon } from 'lucide-react';`.
    - Add `const [isMounted, setIsMounted] = useState(false);` inside the component body.
    - Add `useEffect(() => { setIsMounted(true); }, []);` to set the flag after hydration.
    - Retrieve `const { theme, setTheme } = useTheme();` inside the component body.
    - _Requirements: 4.7_

  - [x] 3.2 Render the ThemeToggle button in the header
    - In the `<div className="ml-auto flex items-center gap-4">` block, insert the toggle between `<HelpPanel />` and `<NotificationsPanel />`.
    - When `!isMounted`, render `<div className="w-10 h-10" />` as a same-size placeholder.
    - When mounted and `theme === 'dark'`, render a button showing `<Sun className="h-5 w-5" />`.
    - When mounted and `theme !== 'dark'`, render a button showing `<Moon className="h-5 w-5" />`.
    - On click, call `setTheme(theme === 'dark' ? 'light' : 'dark')`.
    - Apply button classes: `p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all`.
    - Set `aria-label` to `"Switch to dark mode"` (light) or `"Switch to light mode"` (dark).
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [x] 3.3 Write component tests for ThemeToggle
    - Mock `useTheme` to return `{ theme: 'light', setTheme: mockFn }`. Assert `getByLabelText('Switch to dark mode')` is present and contains a Moon icon.
    - Mock `useTheme` to return `{ theme: 'dark', setTheme: mockFn }`. Assert `getByLabelText('Switch to light mode')` is present and contains a Sun icon.
    - Fire a click event in light-mode mock. Assert `mockFn` was called with `'dark'`.
    - Fire a click event in dark-mode mock. Assert `mockFn` was called with `'light'`.
    - Assert the toggle button appears between HelpPanel and NotificationsPanel in the DOM order.
    - Assert the toggle button element has the class `p-2.5` and `rounded-xl`.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run `npm test --run` (or `npx vitest --run`) from the `frontend/` directory.
  - Verify no TypeScript errors with `npx tsc --noEmit`.
  - Ensure all tests pass; ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster rollout.
- The design has no property-based tests — all acceptance criteria are example-based.
- `providers.tsx` requires no changes; `ThemeProvider` is already configured correctly.
- The `useUser` hook import can be removed entirely from `AppLayout.tsx` once `initials` is deleted.
