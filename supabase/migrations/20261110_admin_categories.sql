-- SHILOH MINISTERIUM CALENDAR: MANAGED EVENT CATEGORIES
-- Run once in the Supabase SQL Editor, AFTER the original schema.sql.
-- Safe for existing event data; categories previously used by events are preserved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.calendar_categories (
  name text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_category_name_valid
    CHECK (char_length(trim(name)) BETWEEN 1 AND 80 AND name = trim(name))
);

-- Preserve any categories on existing calendar events.
INSERT INTO public.calendar_categories (name)
SELECT DISTINCT category FROM public.calendar_events
WHERE category IS NOT NULL AND trim(category) <> ''
ON CONFLICT (name) DO NOTHING;

-- Replace fixed category list with a live administrator-managed lookup.
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_category_check;
ALTER TABLE public.calendar_events ALTER COLUMN category DROP DEFAULT;
ALTER TABLE public.calendar_events ALTER COLUMN category DROP NOT NULL;

-- Dropping a category preserves its events (they become uncategorized).
ALTER TABLE public.calendar_events DROP CONSTRAINT IF EXISTS calendar_events_category_fkey;
ALTER TABLE public.calendar_events
  ADD CONSTRAINT calendar_events_category_fkey
  FOREIGN KEY (category) REFERENCES public.calendar_categories(name)
  ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE public.calendar_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read event categories" ON public.calendar_categories;
CREATE POLICY "Everyone can read event categories"
ON public.calendar_categories FOR SELECT TO anon, authenticated
USING (true);

DROP POLICY IF EXISTS "Admins create event categories" ON public.calendar_categories;
CREATE POLICY "Admins create event categories"
ON public.calendar_categories FOR INSERT TO authenticated
WITH CHECK (public.calendar_is_admin());

DROP POLICY IF EXISTS "Admins delete event categories" ON public.calendar_categories;
CREATE POLICY "Admins delete event categories"
ON public.calendar_categories FOR DELETE TO authenticated
USING (public.calendar_is_admin());

GRANT SELECT ON public.calendar_categories TO anon, authenticated;
GRANT INSERT, DELETE ON public.calendar_categories TO authenticated;

COMMIT;
