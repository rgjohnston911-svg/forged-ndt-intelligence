-- ============================================================
-- DEPLOY230 — Notification System
-- Run in Supabase SQL Editor
-- ============================================================

-- Notifications table: stores all system notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Who gets this notification
  recipient_id text NOT NULL,
  recipient_email text,
  recipient_role text, -- 'technician', 'manager', 'admin'

  -- What triggered it
  case_id uuid REFERENCES inspection_cases(id),
  event_type text NOT NULL,
  source_engine text, -- which engine/deploy generated this

  -- Content
  title text NOT NULL,
  message text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),

  -- Status
  read boolean DEFAULT false,
  read_at timestamptz,
  dismissed boolean DEFAULT false,
  dismissed_at timestamptz,

  -- Action link (optional — where to go when clicked)
  action_url text,
  action_label text,

  -- Metadata
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Notification preferences: per-user settings for what they want to be notified about
CREATE TABLE IF NOT EXISTS notification_preferences (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL UNIQUE,

  -- Toggle by event category
  notify_escalation boolean DEFAULT true,
  notify_override boolean DEFAULT true,
  notify_critical_finding boolean DEFAULT true,
  notify_case_assigned boolean DEFAULT true,
  notify_deadline_warning boolean DEFAULT true,
  notify_resolution boolean DEFAULT true,
  notify_system_alert boolean DEFAULT true,

  -- Delivery preferences
  in_app boolean DEFAULT true,
  email_digest boolean DEFAULT false,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_case ON notifications (case_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications (event_type);
CREATE INDEX IF NOT EXISTS idx_notifications_severity ON notifications (severity);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (recipient_id, read) WHERE read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select" ON notifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notifications_update" ON notifications FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "notifications_service" ON notifications FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prefs_select" ON notification_preferences FOR SELECT TO authenticated USING (true);
CREATE POLICY "prefs_insert" ON notification_preferences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "prefs_update" ON notification_preferences FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "prefs_service" ON notification_preferences FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================================
-- DONE. Notification tables ready for DEPLOY230.
-- ============================================================
