# Shiloh Ministerium Calendar

A responsive public read-only calendar with administrator-only event management. Shiloh Baptist Church's official emblem is referenced directly from the church website: https://www.weareshiloh.org/.

## Technology
- Static HTML, CSS and JavaScript hosted on Netlify.
- Supabase Postgres for the shared event calendar, with Row Level Security (RLS) for permissions.
- Supabase Auth email magic links for individual administrator accounts (no shared email required).
- No document-upload storage, hosting secrets, or paid add-ons required by the application.

## Setup (required before launch)
1. Create a Supabase project for Shiloh and run `supabase/schema.sql` in its SQL Editor.
2. In the SQL Editor, replace the example email and run the final bootstrap statement **once** to add the real first owner:
   ```sql
   insert into public.calendar_admins(email,role)
   values ('REAL_OWNER_EMAIL@example.com','owner')
   on conflict(email) do nothing;
   ```
3. In Supabase **Authentication > Users**, create/invite that owner's user account. For any additional admins, first invite their email in Authentication, then add the email using **Manage Admins**. Alternatively, add the email to `calendar_admins` manually. The event and admin database policies remain authoritative.
4. In Supabase **Authentication > URL Configuration**, set the deployed Netlify site URL and add the exact website URL to the redirect allowlist. Configure an email provider if Supabase's default email quotas are insufficient.
5. Copy the Supabase **Project URL** and **anon/publishable** key to `config.js` (not the secret/service-role key). Publishable/anon keys are intended for browser use with RLS. The placeholder values mean the calendar stays unconfigured until these are supplied.
6. Connect this repository to a Netlify site, publish directory `.` and deploy. Optionally configure a custom domain.
7. Test public access in a private/incognito window. Confirm unpublished events aren't visible, admins can create/edit/delete events, ordinary logged-in users cannot, and only the owner can manage admin email access.

## Local development
Clone the repository into `C:\Users\danie\shiloh-ministerium-calendar` and run a basic static web server (for example `python -m http.server 8080`). The supplied Windows directory is a path on your own computer and cannot be directly edited by ChatGPT's cloud environment. Pull the GitHub branch to synchronize local files.

## Permissions
- Anonymous visitors: view only **published** events.
- Approved admin email: sign in via individual email magic link; view drafts and create, edit, or delete events.
- Owner: all admin abilities plus add/remove standard admin email access.
- Role changes are restricted by RLS; admins cannot promote themselves to owner.
- The owner email must be bootstrapped in SQL. **Do not** publish an unrestricted sign-up or insecure demo login.

## Notes
- Empty calendar is intentional: no fabricated church events are included. Administrators add real events once configured.
- Date/time are entered for the church's Eastern Time schedule; the database stores local dates and local time fields, which are displayed without client timezone conversions.
- The logo is hotlinked to the official website and may need local hosting with church permission later. If Shiloh updates the image URL, update the header `img` in `index.html`.
- For a production launch, set up reliable backups, operational monitoring, and a suitable SMTP/email delivery service if needed.
- This branch is for review. Do not merge or deploy publicly until real admin email, Supabase configuration, and access tests are complete.
