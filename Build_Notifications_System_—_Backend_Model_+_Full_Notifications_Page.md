# Build Notifications System — Backend Model + Full Notifications Page

## Summary

Replace the hardcoded static notifications in the panel with a real backend-driven notification system, and build the full `/notifications` page with read/unread categorization.

## Backend — Notification Model & API

### New Model (file:backend/users/models.py or new `notifications` app)

```python
class Notification(models.Model):
    TYPE_CHOICES = [('payroll','Payroll'),('leave','Leave'),
                    ('employee','Employee'),('system','System')]
    id = UUIDField(primary_key=True)
    tenant = FK(Tenant)
    recipient = FK(User)
    type = CharField(choices=TYPE_CHOICES)
    title = CharField(max_length=200)
    message = TextField()
    is_read = BooleanField(default=False)
    action_url = CharField(blank=True)  # e.g. "/leave"
    created_at = DateTimeField(auto_now_add=True)
```

### New API Endpoints (add to file:backend/config/urls.py)

| Method | URL | Description |
| --- | --- | --- |
| `GET` | `/api/notifications/` | List all for current user. Supports `?unread=true` filter |
| `POST` | `/api/notifications/<id>/read/` | Mark single notification as read |
| `POST` | `/api/notifications/read-all/` | Mark all as read for current user |
| `DELETE` | `/api/notifications/<id>/` | Dismiss (delete) a notification |

### Auto-Generation via Django Signals

Wire up signals in the relevant apps to auto-create `Notification` records:

| Event | Signal | Notifies |
| --- | --- | --- |
| Leave submitted | `post_save` on `Leave` (status=pending) | All ADMIN + HR users in tenant |
| Leave approved/rejected | `post_save` on `Leave` (status changed) | The requesting employee |
| Payroll run processed | `post_save` on `PayrollRun` (status=processed) | All ADMIN + HR users |
| Employee created | `post_save` on `Employee` | All ADMIN users |

## Frontend — Notifications Panel Update

**File:** file:frontend/src/components/layout/NotificationsPanel.tsx

1. Replace `INITIAL_NOTIFICATIONS` static array with a `useQuery` call to `GET /api/notifications/?limit=5`
2. Wire `markAllRead` to `POST /api/notifications/read-all/` and invalidate the query
3. Wire `dismiss` to `DELETE /api/notifications/<id>/`
4. Change the "View all notifications →" `<button>` to `<Link href="/notifications">` (using Next.js `Link`) so it navigates to the full page

## Frontend — New Notifications Page

**New file:** file:frontend/src/app/notifications/page.tsx

### Layout & Features

- **Page header:** "Notifications" title + subtitle
- **Toolbar:**
  - Tab bar: **All** | **Unread** (with count badge) | **Read**
  - Category filter chips: All Types | 💰 Payroll | 🌴 Leave | 👥 Employee | ⚙️ System
  - "Mark all as read" button (right-aligned)
- **Section dividers:** "Unread — N" and "Read — N" labels separating the two groups
- **Notification cards** showing:
  - Type icon (colored by category)
  - Title + unread dot indicator
  - Message body
  - Timestamp + optional "View →" deep-link
  - "Mark read" + "✕ Dismiss" actions on hover
- **Empty state:** Bell icon + "All caught up!" message when no notifications

### Data Fetching

- `useQuery(['notifications'])` → `GET /api/notifications/`
- Mutations for mark-read, mark-all-read, dismiss — each invalidates the query
- The unread count in the panel bell badge also reads from this query cache

## Acceptance Criteria

GET /api/notifications/ returns a list of notifications scoped to the current user's tenantSubmitting a leave request auto-creates a notification for ADMIN/HR usersProcessing a payroll run auto-creates a notification for ADMIN/HR usersThe bell icon badge count reflects real unread notifications from the APIClicking "View all notifications →" in the panel navigates to /notificationsThe notifications page shows Unread and Read sections with correct categorization"Mark all read" and individual dismiss actions work and update the UI immediatelyCategory filter chips correctly filter the list by notification type