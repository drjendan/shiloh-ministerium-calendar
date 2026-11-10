-- SHILOH MINISTERIUM: PRIVATE MEMBERS-ONLY ACCESS
-- Run in Supabase SQL Editor AFTER schema.sql and 20261110_admin_categories.sql.
-- IMPORTANT: This migration must be applied to the LIVE Supabase project;
-- publishing a login page does NOT secure data on its own.
BEGIN;

CREATE TABLE IF NOT EXISTS public.calendar_members (
  email text PRIMARY KEY,
  added_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT calendar_member_email_normalized CHECK (email=lower(trim(email)))
);

CREATE OR REPLACE FUNCTION public.calendar_can_view()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id=(SELECT auth.uid())
      AND (
        EXISTS (SELECT 1 FROM public.calendar_admins a WHERE a.email=lower(u.email))
        OR EXISTS (SELECT 1 FROM public.calendar_members m WHERE m.email=lower(u.email))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.calendar_can_view() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calendar_can_view() TO authenticated;

ALTER TABLE public.calendar_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can view members" ON public.calendar_members;
CREATE POLICY "Owners can view members"
ON public.calendar_members FOR SELECT TO authenticated
USING (public.calendar_is_owner());

DROP POLICY IF EXISTS "Owners can add members" ON public.calendar_members;
CREATE POLICY "Owners can add members"
ON public.calendar_members FOR INSERT TO authenticated
WITH CHECK (public.calendar_is_owner());

DROP POLICY IF EXISTS "Owners can remove members" ON public.calendar_members;
CREATE POLICY "Owners can remove members"
ON public.calendar_members FOR DELETE TO authenticated
USING (public.calendar_is_owner());

GRANT SELECT, INSERT, DELETE ON public.calendar_members TO authenticated;
REVOKE ALL ON public.calendar_members FROM anon;

-- Replace the previous policy that allowed anonymous access.
DROP POLICY IF EXISTS "Read published events or admin drafts" ON public.calendar_events;
DROP POLICY IF EXISTS "Members can read calendar events" ON public.calendar_events;
CREATE POLICY "Members can read calendar events"
ON public.calendar_events FOR SELECT TO authenticated
USING (public.calendar_can_view() AND (published OR public.calendar_is_admin()));

REVOKE SELECT ON public.calendar_events FROM anon;

-- Categories must be private as well.
DROP POLICY IF EXISTS "Everyone can read event categories" ON public.calendar_categories;
DROP POLICY IF EXISTS "Members can read event categories" ON public.calendar_categories;
CREATE POLICY "Members can read event categories"
ON public.calendar_categories FOR SELECT TO authenticated
USING (public.calendar_can_view());

REVOKE SELECT ON public.calendar_categories FROM anon;

-- Existing INSERT/UPDATE/DELETE rules remain admin-only.
COMMIT;

-- EXISTING ADMINS automatically have member viewing access.
-- Add ordinary member emails using:
-- INSERT INTO public.calendar_members(email)
-- VALUES ('member@example.com') ON CONFLICT DO NOTHING;
-- ALSO invite or create each user via Supabase Authentication > Users.
-- Do not enable public signups: provision accounts deliberately.
