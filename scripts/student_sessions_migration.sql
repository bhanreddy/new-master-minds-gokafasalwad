-- =========================================================
-- Student Sessions (Device Binding) Table
-- =========================================================
-- Purpose:
--   Track active student sessions per device for security.
--   Allows admin to revoke sessions on suspicious activity.
--
-- This table should be created in your Supabase SQL Editor
-- or via a migration script.
-- =========================================================

CREATE TABLE IF NOT EXISTS student_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    refresh_token_hash TEXT NOT NULL,
    last_active TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    is_revoked BOOLEAN DEFAULT false,
    UNIQUE(user_id, device_id)
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_student_sessions_user
    ON student_sessions(user_id);

-- Index for active sessions only
CREATE INDEX IF NOT EXISTS idx_student_sessions_active
    ON student_sessions(user_id, is_revoked)
    WHERE NOT is_revoked;

-- =========================================================
-- RLS Policies
-- =========================================================
ALTER TABLE student_sessions ENABLE ROW LEVEL SECURITY;

-- Users can view their own sessions
CREATE POLICY "Users can view own sessions"
    ON student_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Only service_role can insert/update/delete
-- (Handled by backend API, not direct client access)
CREATE POLICY "Service role manages sessions"
    ON student_sessions FOR ALL
    USING (auth.role() = 'service_role');
