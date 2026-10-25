# Chat Pisos

An app for finding a room, a flat or flatmates in Madrid, organised by district — a tidier alternative to WhatsApp groups. Spanish and English.

Built with [Expo](https://expo.dev) (React Native), so one codebase runs on web, Android and iPhone, with [Supabase](https://supabase.com) for accounts, the database, live chat and photo storage.

## Features

- **Accounts:** email sign-up with confirmation, log in, forgot password, delete account (with all data).
- **Profiles:** photo, name, age (others never see the date of birth), occupation, languages, about and habits. No fixed "landlord/tenant" roles.
- **District chats:** a Madrid-wide group plus 10 popular areas, live messages, unread counters, listings shared as cards.
- **Private messages:** inbox with unread counts and a "message requests" box for people you haven't talked to yet.
- **Listings:** offering a room, looking for a room or renting a whole flat; photos, filters, map location (exact or approximate), published from the central **Publish** tab.
- **Safety:** report people, messages or listings; block users (hides their messages and stops private messages both ways).

## Run the app

First time only: copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.

```bash
npm install      # first time only: downloads the libraries
npm run web      # opens the app in your browser
```

Press `Ctrl + C` in the terminal to stop it.

## Database

The database lives in Supabase. Every change to its structure is a SQL file in `supabase/migrations/`. On a new Supabase project, run them **in order** in the dashboard's SQL Editor:

1. `20261004120000_create_profiles.sql`
2. `20261004130000_create_avatars_bucket.sql`
3. `20261005100000_hide_birth_date.sql`
4. `20261005110000_create_group_chats.sql`
5. `20261005120000_create_private_messages.sql`
6. `20261006100000_reports_and_blocks.sql`
7. `20261006110000_create_listings.sql`
8. `20261007100000_listing_location.sql`
9. `20261008100000_delete_account.sql`
10. `20261009100000_group_unread_counts.sql`
11. `20261011100000_launch_hardening.sql` — spam limits, photo checks, listing expiry, message deletion, moderation tools. **On a new Supabase project, change the address in `app_storage_url()` first.**
12. `20261013100000_places.sql` — countries, cities, districts and neighbourhoods; district groups open on demand.
13. `20261014100000_private_groups.sql` — private group chats between connected people.
14. `20261017100000_private_group_events.sql` — automatic join/leave notices in private groups.
15. `20261018100000_mutes_links_requests.sql` — muted chats, district group activity numbers, private group invite links with join requests.
16. `20261019100000_group_previews.sql` — the Chats tab list in one request.
17. `20261020100000_saved_listings.sql` — favourite (saved) listings.
18. `20261021100000_chat_photos.sql` — photos in chats (private storage bucket, photo reports).
19. `20261022100000_message_replies.sql` — replying to (quoting) a message in the same chat.
20. `20261025100000_listing_details_contact.sql` — more listing details (who it's for, the flat, rules, transport) and optional contact details.
21. `20261026100000_richer_profiles.sql` — more answers per habit and new living-together questions and interests.
22. `20261027100000_private_group_photos.sql` — a photo for each private group (any member can change it).

In Supabase, also set **Authentication → URL Configuration → Site URL** (and Redirect URLs) to the app's address, e.g. `http://localhost:8081` while developing.

In **Authentication → Providers → Email**, set the minimum password length to **8** (the app asks for 8).

## Moderation

Run these in the Supabase dashboard (**SQL Editor**). The app itself can't use them.

```sql
-- Open reports, newest first (who was reported, why, and a copy of the message)
select * from public.moderation_reports;

-- Hide a message from a group chat (it shows as "Message deleted")
select public.remove_group_message('MESSAGE-ID');

-- Close a listing so nobody sees it
select public.remove_listing('LISTING-ID');

-- Ban someone: they can't log in any more and their listings are closed
select public.ban_user('USER-ID');
select public.unban_user('USER-ID');   -- undo

-- Mark a report as handled
update public.reports set status = 'reviewed' where id = 'REPORT-ID';
```

Reports are kept even if the reported person deletes their account.

## Built-in limits

To stop spam, the database refuses more than: 30 messages per minute (groups and private), 20 new private conversations per day, 5 new listings per day and 20 reports per day. Listings are hidden after 60 days unless their owner renews them.

## Project structure

- `src/app/` — the screens. Every file is a page; `(tabs)/` are the five bottom tabs (Chats, Listings, Publish, Messages, Profile). `_layout.tsx` decides who sees what (logged out, no profile yet, or the app).
- `src/components/` — reusable pieces (forms, cards, chat box, map…). Files ending in `.web.tsx` are the web version of the same component.
- `src/hooks/` — shared state: who is logged in, their profile, blocked users, unread counts.
- `src/lib/` — talking to Supabase and other helpers (dates, prices, maps, address search).
- `src/types/` — the shape of the data (profiles, chats, listings).
- `src/i18n/locales/` — all app text, one file per language (`es.ts`, `en.ts`). Never write text directly in a screen.
- `src/constants/theme.ts` — colours, fonts and spacing.
- `supabase/migrations/` — the database structure and its security rules.

## Checks

```bash
npx tsc --noEmit   # type check
npm run lint       # code quality
npx expo-doctor    # Expo project health
npm run format     # tidy up code formatting
```

## Services used (free tiers)

- **Supabase** — accounts, database, realtime, storage (EU region).
- **OpenFreeMap** — map tiles (OpenStreetMap data). Map library: MapLibre 5, loaded from a pinned, integrity-checked CDN file.
- **Nominatim (OpenStreetMap)** — address search; fine for testing, to be replaced by a paid provider before scaling.
