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
- Discover nearby restaurant listings on the map and in a synchronized results list after searching a city or sharing your location.
- Filter map/list results by cuisine type and keep the map visible while browsing on wide screens.
- Sort by public reviews or ratings from your circle.
- Save a per-person 1–5 score and shared notes.
- Pastel pink, purple, blue, and green responsive design.

## Data setup and sharing

The schema and open policies are in `supabase-celisafe.sql`. Anyone with the deployed app URL can access the shared collection; this is intentional for the community-circle use case. The app uses the Supabase anon/publishable key and row-level security policies from the SQL file. Never expose a Supabase service-role or secret key in a `NEXT_PUBLIC_` variable.

If you already created the Supabase tables before cuisine filtering was added, re-run the updated SQL file to add the `cuisine` column.

Nearby search uses OpenStreetMap/Overpass when no ratings provider is configured. Those listings are candidates only; they do not guarantee gluten-free or celiac-safe preparation and do not include public ratings. To show Google Places star ratings and review counts, configure a restricted Google Places API key as the server-only `GOOGLE_PLACES_API_KEY` environment variable in Vercel and locally. Do not use a `NEXT_PUBLIC_` prefix for this key. Google Places usage may incur charges; set API restrictions and billing budgets in Google Cloud. The user's location is requested only after they choose **Use my location**.

## Deploy

Import the Celisafe project folder/repository as its own Vercel project, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in that project's environment settings, then deploy. This creates a standalone URL separate from Team Z Project Motion.
