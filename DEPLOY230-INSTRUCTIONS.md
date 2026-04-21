# DEPLOY230 — Notification System

In-app notification system. Any engine can send notifications to specific users. Supports per-user preferences, bulk sends, read/dismiss tracking, and severity levels.

## What it does

Nine actions:

1. **send** — Send a notification to one user. Specify severity, link to case, action button.
2. **send_bulk** — Same notification to multiple recipients at once.
3. **get_inbox** — Get a user's notifications (newest first), optionally unread only.
4. **mark_read** — Mark one notification as read.
5. **mark_all_read** — Mark all of a user's notifications as read.
6. **dismiss** — Hide a notification from inbox.
7. **get_preferences** — Get a user's notification settings (returns defaults if none set).
8. **update_preferences** — Toggle which event types a user wants notifications for.
9. **get_stats** — Unread count, breakdown by severity and event type.

### Built-in event types:
- `escalation_created` / `escalation_assigned` / `escalation_resolved` / `escalation_overdue`
- `inspector_override` / `inspector_concur`
- `critical_finding`
- `case_assigned` / `case_closed`
- `deadline_warning`
- `system_alert`
- `audit_chain_broken`
- `confidence_low`

Each event type has a default severity level (info/warning/critical/success).

## Deploy order

### 1. Run migration
File: `DEPLOY230-migration.sql` in Supabase SQL Editor.
Creates: `notifications` table and `notification_preferences` table with RLS.

### 2. Paste function
File: `netlify/functions/notifications.ts`
Endpoint: `POST /api/notifications { action, ... }`

### 3. Update health.ts ENGINE_REGISTRY
Add before the closing `]`:
```
{ name: "notifications", deploy: "DEPLOY230", mode: "deterministic", path: "/api/notifications" }
```

---

## Smoke test

1. Send a test notification:
```
POST /api/notifications {
  "action": "send",
  "recipient_id": "test-user",
  "event_type": "system_alert",
  "title": "System Check Complete",
  "message": "All 19 engines passed health check"
}
```

2. Get inbox:
```
POST /api/notifications { "action": "get_inbox", "recipient_id": "test-user" }
```

3. Get stats:
```
POST /api/notifications { "action": "get_stats" }
```

---

## Architecture

- **Decoupled** — Any engine can send notifications by POSTing to this endpoint. No tight coupling.
- **Preferences** — Users can toggle notifications by category. Defaults to all-on.
- **Severity levels** — info (blue), warning (yellow), critical (red), success (green).
- **Action links** — Notifications can include a URL + label for one-click navigation to the relevant case/escalation.
- **Bulk sends** — Escalation notifications, deadline warnings can go to multiple managers at once.
- **Future-ready** — `email_digest` preference exists for when email integration is added.
