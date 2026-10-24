# Celisafe

Celisafe is a standalone Next.js app for discovering, saving, and sharing celiac-aware restaurant finds with a travel circle. It is separate from Team Z Project Motion.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL and anon key.
3. Run the SQL in `supabase-celisafe.sql` in the Supabase SQL Editor.
4. Start the app with `npm run dev` and visit http://localhost:3000.

## Features

- Search saved places by city and launch a Google Maps discovery search.
- Browse restaurant links, public review scores, addresses, and map directions.
- Sort by public reviews or ratings from your circle.
- Save a per-person 1–5 score and shared notes.
- Pastel pink, purple, blue, and green responsive design.

## Data setup and sharing

The schema and open policies are in `supabase-celisafe.sql`. Anyone with the deployed app URL can access the shared collection; this is intentional for the community-circle use case. The app uses the Supabase anon key and row-level security policies from the SQL file. Never expose a Supabase service-role key in a `NEXT_PUBLIC_` variable.

## Deploy

Import the Celisafe project folder/repository as its own Vercel project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in that project's environment settings, then deploy. This creates a standalone URL separate from Team Z Project Motion.
