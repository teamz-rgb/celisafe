create table if not exists public.travel_restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text not null default '',
  website_url text not null default '',
  google_rating numeric(2, 1) check (google_rating is null or (google_rating >= 0 and google_rating <= 5)),
  yelp_rating numeric(2, 1) check (yelp_rating is null or (yelp_rating >= 0 and yelp_rating <= 5)),
  review_rating numeric(2, 1) check (review_rating is null or (review_rating >= 0 and review_rating <= 5)),
  celiac_notes text not null default '',
  is_saved boolean not null default true,
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now()
);

alter table public.travel_restaurants add column if not exists google_rating numeric(2, 1);
alter table public.travel_restaurants add column if not exists yelp_rating numeric(2, 1);
alter table public.travel_restaurants add column if not exists latitude double precision;
alter table public.travel_restaurants add column if not exists longitude double precision;

create table if not exists public.travel_restaurant_feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.travel_restaurants(id) on delete cascade,
  member_name text not null,
  score integer not null check (score between 1 and 5),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (restaurant_id, member_name)
);

create index if not exists travel_restaurants_city_idx on public.travel_restaurants (city);
create index if not exists travel_restaurant_feedback_restaurant_idx on public.travel_restaurant_feedback (restaurant_id);

alter table public.travel_restaurants enable row level security;
alter table public.travel_restaurant_feedback enable row level security;

drop policy if exists "Anyone can collaborate on restaurants" on public.travel_restaurants;
create policy "Anyone can collaborate on restaurants" on public.travel_restaurants
  for all using (true) with check (true);

drop policy if exists "Anyone can collaborate on restaurant feedback" on public.travel_restaurant_feedback;
create policy "Anyone can collaborate on restaurant feedback" on public.travel_restaurant_feedback
  for all using (true) with check (true);
