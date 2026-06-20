-- 014_camera_scans.sql
-- Tracks daily AI photo scans per user for rate limiting (5/day free, unlimited Pro).
-- Barcode scans (OFF API lookup) are free and not tracked here.

CREATE TABLE IF NOT EXISTS public.camera_photo_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.camera_photo_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users select own camera logs"
  ON public.camera_photo_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own camera logs"
  ON public.camera_photo_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX camera_photo_logs_user_date_idx
  ON public.camera_photo_logs (user_id, created_at);
