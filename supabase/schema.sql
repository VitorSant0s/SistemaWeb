create type public.user_role as enum ('athlete', 'professional');
create type public.negotiation_status as enum ('open', 'in_review', 'accepted', 'rejected', 'cancelled');
create type public.contract_status as enum ('active', 'completed', 'cancelled');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role public.user_role not null,
  city text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  avatar_data_url text
);

create table if not exists public.professional_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  specialty text not null,
  bio text,
  base_hourly_price numeric(10, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.service_offers (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  base_price numeric(10, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.negotiations (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  service_offer_id uuid not null references public.service_offers(id) on delete cascade,
  status public.negotiation_status not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.negotiations(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  value_amount numeric(10, 2) not null,
  scope text not null,
  message text,
  due_days integer,
  created_at timestamptz not null default now()
);

create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null unique references public.negotiations(id) on delete cascade,
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid not null references public.profiles(id) on delete cascade,
  final_amount numeric(10, 2) not null,
  status public.contract_status not null default 'active',
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  workout_type text not null constraint workouts_workout_type_check
    check (workout_type in ('Corrida', 'Musculacao', 'Ciclismo', 'Natacao', 'Yoga', 'Crossfit', 'Outro')),
  distance_km numeric(10, 2) not null,
  duration_min integer not null,
  workout_date date not null,
  contract_id uuid references public.contracts(id) on delete set null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_profile_updated on public.profiles;
create trigger on_profile_updated
  before update on public.profiles
  for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'athlete')
  )
  on conflict (id) do nothing;

  if coalesce(new.raw_user_meta_data ->> 'role', 'athlete') = 'professional' then
    insert into public.professional_profiles (id, specialty)
    values (new.id, 'Especialista esportivo')
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.professional_profiles enable row level security;
alter table public.service_offers enable row level security;
alter table public.negotiations enable row level security;
alter table public.proposals enable row level security;
alter table public.contracts enable row level security;
alter table public.workouts enable row level security;

create policy "profiles select own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles public read" on public.profiles
  for select using (true);

create policy "profiles insert own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles update own" on public.profiles
  for update using (auth.uid() = id);

create policy "professional public read" on public.professional_profiles
  for select using (true);

create policy "professional update own" on public.professional_profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "offers public read" on public.service_offers
  for select using (is_active = true);

create policy "offers professional manage" on public.service_offers
  for all using (auth.uid() = professional_id) with check (auth.uid() = professional_id);

create policy "negotiations parties read" on public.negotiations
  for select using (auth.uid() = athlete_id or auth.uid() = professional_id);

create policy "athlete opens negotiation" on public.negotiations
  for insert with check (auth.uid() = athlete_id);

create policy "parties update negotiation" on public.negotiations
  for update using (auth.uid() = athlete_id or auth.uid() = professional_id);

create policy "proposals parties read" on public.proposals
  for select using (
    exists (
      select 1 from public.negotiations n
      where n.id = negotiation_id
      and (auth.uid() = n.athlete_id or auth.uid() = n.professional_id)
    )
  );

create policy "proposals parties write" on public.proposals
  for insert with check (
    auth.uid() = author_id and exists (
      select 1 from public.negotiations n
      where n.id = negotiation_id
      and (auth.uid() = n.athlete_id or auth.uid() = n.professional_id)
    )
  );

create policy "contracts parties read" on public.contracts
  for select using (auth.uid() = athlete_id or auth.uid() = professional_id);

create policy "workouts own" on public.workouts
  for all using (auth.uid() = athlete_id) with check (auth.uid() = athlete_id);

create table if not exists public.daily_challenges (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  date date not null,
  rating text check (rating in ('completed', 'partial', 'missed')),
  feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(athlete_id, date)
);

alter table public.daily_challenges enable row level security;

create policy "challenges own" on public.daily_challenges
  for all using (auth.uid() = athlete_id) with check (auth.uid() = athlete_id);

drop trigger if exists on_daily_challenge_updated on public.daily_challenges;
create trigger on_daily_challenge_updated
  before update on public.daily_challenges
  for each row execute function public.handle_updated_at();
