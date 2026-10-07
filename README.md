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

In Supabase, also set **Authentication → URL Configuration → Site URL** (and Redirect URLs) to the app's address, e.g. `http://localhost:8081` while developing.

Reports from users can be reviewed in **Table Editor → reports**.

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
```

## Services used (free tiers)

- **Supabase** — accounts, database, realtime, storage (EU region).
- **OpenFreeMap** — map tiles (OpenStreetMap data). Map library: MapLibre 5, loaded from a pinned, integrity-checked CDN file.
- **Nominatim (OpenStreetMap)** — address search; fine for testing, to be replaced by a paid provider before scaling.
