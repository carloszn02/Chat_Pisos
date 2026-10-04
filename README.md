# Chat_Pisos
Development of an app focused on connecting people looking for an appartment or people to share a flat

Starting in Madrid, in Spanish and English. Built with [Expo](https://expo.dev) (React Native), so the same code runs on web, Android and iPhone.

## Run the app

First time only: copy `.env.example` to `.env.local` and fill in the Supabase project URL and publishable key.

```bash
npm install      # first time only: downloads the libraries
npm run web      # opens the app in your browser
```

## Database

The database lives in Supabase. Every change to its structure is a SQL file in `supabase/migrations/`, run in order in the Supabase dashboard (SQL Editor).

Press `Ctrl + C` in the terminal to stop it.

## Project structure

- `src/app/` — the screens. Every file here is a page. `sign-in.tsx` is for logged-out users; everything in `(tabs)/` requires being logged in.
- `src/lib/supabase.ts` — the connection to Supabase.
- `src/hooks/use-session.tsx` — knows who is logged in.
- `src/components/` — reusable pieces (tabs, themed text…).
- `src/i18n/locales/` — all app text, one file per language (`es.ts`, `en.ts`). Never write text directly in a screen.
- `src/constants/theme.ts` — colours and spacing.

## Checks

```bash
npx tsc --noEmit   # type check
npm run lint       # code quality
```
