-- Run this entire file in the Supabase SQL Editor for the Shiloh project.
-- The public can view published events; only approved administrators can make changes.
create extension if not exists pgcrypto;

create table if not exists public.calendar_admins (
  email text primary key,
  role text not null default 'admin' check (role in ('owner','admin')),
  added_at timestamptz not null default now(),
  constraint admin_email_normalized check(email = lower(trim(email)))
);

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 120),
  event_date date not null,
  start_time time without time zone not null,
  end_time time without time zone,
  category text not null default 'Meetings' check(category in ('Worship','Meetings','Outreach','Training','Other')),
  location text not null default '',
  description text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint event_time_range check (end_time is null or end_time > start_time),
  constraint event_text_limits check (char_length(location)<=200 and char_length(description)<=3000)
);
create index if not exists calendar_events_date_idx on public.calendar_events(event_date,start_time);

-- SECURITY DEFINER functions read admin role without causing recursive RLS checks.
create or replace function public.calendar_is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.calendar_admins a
    where a.email = lower(coalesce((select email from auth.users where id=auth.uid()),''))
  );
$$;
create or replace function public.calendar_is_owner()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.calendar_admins a
    where a.email = lower(coalesce((select email from auth.users where id=auth.uid()),''))
    and a.role='owner'
  );
$$;
revoke all on function public.calendar_is_admin() from public;
revoke all on function public.calendar_is_owner() from public;
grant execute on function public.calendar_is_admin() to authenticated, anon;
grant execute on function public.calendar_is_owner() to authenticated;

alter table public.calendar_events enable row level security;
alter table public.calendar_admins enable row level security;

drop policy if exists "Read published events or admin drafts" on public.calendar_events;
create policy "Read published events or admin drafts" on public.calendar_events for select to anon,authenticated
using (published or public.calendar_is_admin());
drop policy if exists "Admins create events" on public.calendar_events;
create policy "Admins create events" on public.calendar_events for insert to authenticated
with check (public.calendar_is_admin());
drop policy if exists "Admins edit events" on public.calendar_events;
create policy "Admins edit events" on public.calendar_events for update to authenticated
using(public.calendar_is_admin()) with check(public.calendar_is_admin());
drop policy if exists "Admins remove events" on public.calendar_events;
create policy "Admins remove events" on public.calendar_events for delete to authenticated
using(public.calendar_is_admin());

drop policy if exists "Admins view administrator directory" on public.calendar_admins;
create policy "Admins view administrator directory" on public.calendar_admins for select to authenticated
using(public.calendar_is_admin());
drop policy if exists "Owners add administrators" on public.calendar_admins;
create policy "Owners add administrators" on public.calendar_admins for insert to authenticated
with check(public.calendar_is_owner() and role='admin');
drop policy if exists "Owners remove administrators" on public.calendar_admins;
create policy "Owners remove administrators" on public.calendar_admins for delete to authenticated
using(public.calendar_is_owner() and role='admin');

-- No update policy: change administrator roles only in the SQL Editor.
-- All rows are protected by RLS; never put service_role keys in browser configuration.
grant select on public.calendar_events to anon,authenticated;
grant insert,update,delete on public.calendar_events to authenticated;
grant select,insert,delete on public.calendar_admins to authenticated;

create or replace function public.calendar_touch_updated_at()
returns trigger language plpgsql set search_path='' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists calendar_touch on public.calendar_events;
create trigger calendar_touch before update on public.calendar_events
for each row execute function public.calendar_touch_updated_at();

-- REQUIRED BOOTSTRAP, run ONCE after replacing the email with the first real administrator:
-- insert into public.calendar_admins(email,role)
-- values ('your-initial-admin@example.com','owner')
-- on conflict(email) do nothing;
