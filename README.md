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

## Event category management (November 2026 update)
If the original schema was already applied, run `supabase/migrations/20261110_admin_categories.sql` in the **same Supabase project's SQL Editor**. This migration preserves existing events and replaces the fixed list of category names with an administrator-managed `calendar_categories` table protected by RLS.

- Admins may add/delete categories via **Manage Categories** or add one while saving an event.
- Public category filters appear **only** for categories currently used by visible calendar events.
- Deleting a category does not delete events; the events become uncategorized.
- If deploying to a new Supabase project, run `supabase/schema.sql` first and then the category migration.

### Login error: Signups not allowed for otp
The app deliberately uses `shouldCreateUser:false`, so requesting an email sign-in link does **not** automatically register arbitrary email addresses. The calendar owner must add the matching email to `calendar_admins` **and** provision/invite the same email through **Supabase Authentication > Users**. Then configure Supabase Auth Site URL and Redirect URLs for the Netlify domain and ensure the email provider can deliver sign-in links. Do not change `shouldCreateUser` to true just to bypass registration; admin privileges are enforced by database RLS.

## PRIVATE MEMBERS-ONLY ACCESS (required before declaring this site secure)

**All calendar events and categories are now restricted to approved, signed-in members.** The browser redirects visitors to `/admin.html`, a member login page. The login URL itself is reachable by anyone, but the calendar and its Postgres data are NOT, after the migration has been applied.

### Mandatory security migration

1. In Supabase SQL Editor run `supabase/schema.sql` if this is a new project.
2. Run `supabase/migrations/20261110_admin_categories.sql` if not already applied. It creates `public.calendar_categories`.
3. Run `supabase/migrations/20261110_members_only.sql` to **revoke anonymous reads of calendar events and categories** and create `public.calendar_members`.
4. In **Authentication → Users**, invite/provision each member's own email. Membership in `calendar_members` alone does NOT create an Auth user.
5. Owners can approve/revoke ordinary member access with the **Manage Members** button, which updates `calendar_members`. Registered admins have member reading access automatically. Only owners manage members; only admins manage events.
6. Under **Authentication → URL Configuration**, set the Site URL to `https://shiloh-ministerium-calendar.netlify.app` and allow `https://shiloh-ministerium-calendar.netlify.app/admin.html` for password reset redirects. Enable Email provider/password authentication. Configure SMTP if necessary.
7. Members can use the **Set or reset your password** link on the sign-in page after an Auth user has been created. The login uses `signInWithPassword` and standard browser password manager autocomplete. The app does NOT save any plaintext passwords.
8. Open the website in an incognito window to confirm a visitor sees only the member sign-in, then verify approved member reads, non-member denial, admin editing, and owner membership management.

### CRITICAL: Migration must be run in the live Supabase project
A login screen on the website does not secure direct API access. The calendar is not private until the members-only SQL migration succeeds and its RLS policies take effect. If confidential events exist, temporarily unpublish or restrict the site until you have applied the database migration and tested anonymous access denial.

## Temporary calendar and admin interface preview (while email sending is unavailable)

The homepage now displays the calendar shell without requiring sign-in and includes an **Admin Preview** toggle. Preview forms for event creation, category management, member administration and administrator management are **disabled and do not save**.

- **No private events or category data is requested from Supabase when a visitor is not authenticated and approved.**
- All real calendar CRUD operations remain restricted to Supabase-authorized administrators.
- Database RLS defined by `supabase/migrations/20261110_members_only.sql` remains required and should be verified as applied.
- **Do not enter confidential event data until the live database has been confirmed to enforce member-only reads.**
- Email/passwordless login is not required to preview the layout but will still be needed to access real data after email delivery has been restored.
- The preview is intentionally reachable by anyone who knows the Netlify URL; the real calendar entries are not made public by this feature.

After configuring a Resend domain and SMTP, disable the preview and reinstate the member sign-in flow.
