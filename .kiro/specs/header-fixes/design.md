# Design Document: Header Fixes

## Overview

All four changes land in a single file: `AppLayout.tsx`. No new components are created. The work is:

1. Remove three dead inline UI elements (bell button, HelpCircle button, avatar div).
2. Import and render the three pre-built panel components in their place.
3. Add an inline `ThemeToggle` button using `useTheme()` from `next-themes`, placed between `HelpPanel` and `NotificationsPanel`.
4. Guard the `ThemeToggle` render with an `isMounted` flag to prevent a server/client hydration mismatch.

## Architecture

```
AppLayout.tsx  (only file modified)
│
├── imports: HelpPanel, NotificationsPanel, ProfileDropdown  (already built)
├── imports: useTheme from 'next-themes'
├── imports: Sun, Moon from 'lucide-react'
│
└── <header>
      <SearchBar />          ← unchanged
      <div.ml-auto>
        <HelpPanel />        ← replaces dead HelpCircle button
        <ThemeToggle />      ← new, inline button
        <NotificationsPanel />  ← replaces dead Bell button
        <divider />          ← unchanged
        <ProfileDropdown />  ← replaces dead avatar div
      </div>
    </header>
```

The `ThemeProvider` in `providers.tsx` is already configured correctly (`attribute="class"`, `defaultTheme="light"`, no `enableSystem`). No changes are needed there.

## Components

### HelpPanel, NotificationsPanel, ProfileDropdown

These are drop-in replacements. Each component encapsulates its own open/close state, click-outside listener, and animated dropdown. `AppLayout` renders them with no props — they are self-contained.

### ThemeToggle (inline in AppLayout)

Not extracted into a separate file; it's a single `<button>` inlined directly in the header JSX.

**State**:
- `isMounted: boolean` — React `useState(false)`, set to `true` inside `useEffect(() => setIsMounted(true), [])`. Guards against server/client HTML mismatch.
- `theme, setTheme` — from `useTheme()`.

**Render logic**:
```typescript
// Guard against hydration mismatch
if (!isMounted) return <div className="w-10 h-10" />;  // placeholder same size as button

const isDark = theme === 'dark';

return (
  <button
    onClick={() => setTheme(isDark ? 'light' : 'dark')}
    className="p-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
    aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  >
    {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
  </button>
);
```

## Data Models

No new data models. No API calls. All state is local or provided by `next-themes`.

## Interfaces

`AppLayout` remains a single prop: `{ children: React.ReactNode }` — unchanged.

## Dead Code Removal

The following items in `AppLayout.tsx` are removed as part of this change:

| Removed item | Replaced by |
|---|---|
| `import { Bell, HelpCircle } from 'lucide-react'` | `Sun, Moon` remain; `Bell` and `HelpCircle` are dropped |
| Inline `<button>` with `<HelpCircle />` | `<HelpPanel />` |
| Inline `<button>` with `<Bell />` and badge `<span>` | `<NotificationsPanel />` |
| Inline avatar `<div>` with `{initials}` | `<ProfileDropdown />` |
| `const initials = user ? ...` | Removed (only used by the avatar div) |
| `const { user } = useUser()` | Removed (only used for `initials`) |

The `useAuth` hook import and usage remain (still needed for `isLoaded`, `isSignedIn`).

## Error Handling

- **Hydration mismatch**: Handled by the `isMounted` guard. Before mount, a same-size placeholder `<div>` is rendered so the layout does not shift.
- **Theme undefined**: `useTheme()` may return `theme === undefined` briefly on first render. The toggle should treat `undefined` as `'light'` (i.e., display Moon icon and set to `'dark'` on click). This is covered by the `theme === 'dark'` check — any non-dark value shows the Moon.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

**Prework reflection**: All acceptance criteria for this feature involve a finite set of discrete states (mounted/unmounted, light/dark theme, open/closed dropdown) or code-structure assertions. None have a large input space where running 100+ randomized iterations would reveal edge cases beyond what two or three targeted examples already cover. The dominant pattern is "render component in state X, assert UI output Y." Property-based testing is not the right tool here — every testable criterion maps to an example-based test. There are therefore no universal properties to define.

No property-based tests are appropriate for this feature. All correctness verification is handled by example-based component tests (see Testing Strategy).

## Testing Strategy

All tests are example-based unit/component tests using React Testing Library.

### AppLayout wiring tests

| Test | What it checks |
|---|---|
| Renders `NotificationsPanel` | `screen.getByLabelText('Notifications')` is present |
| Renders `HelpPanel` | `screen.getByLabelText('Help & Support')` is present |
| Renders `ProfileDropdown` | `screen.getByLabelText('User profile')` is present |
| No dead bell button | No second unlabelled bell button exists in the DOM |
| No dead HelpCircle button | No second unlabelled HelpCircle button exists in the DOM |
| No dead avatar div | The plain initials-only `<div>` is not in the DOM |

### ThemeToggle tests

| Test | What it checks |
|---|---|
| Shows Moon icon in light mode | `getByLabelText('Switch to dark mode')` present when `theme='light'` |
| Shows Sun icon in dark mode | `getByLabelText('Switch to light mode')` present when `theme='dark'` |
| Click in light mode calls `setTheme('dark')` | Mock `setTheme`, fire click, assert called with `'dark'` |
| Click in dark mode calls `setTheme('light')` | Mock `setTheme`, fire click, assert called with `'light'` |
| Header order: HelpPanel → ThemeToggle → NotificationsPanel | Assert sibling order in rendered DOM |
| Button has correct CSS classes | `p-2.5 rounded-xl` present on toggle button |
| Pre-mount placeholder rendered on server | Render without mount effect, assert placeholder div present |

### Persistence (integration)

Verified by checking that `ThemeProvider` in `providers.tsx` has `attribute="class"` and no `storageKey` override — `next-themes` defaults to `localStorage` key `theme`. No runtime test needed; this is a configuration inspection.
