-- Profile details and saved or hidden items. Places stay in the app.
-- Track record is counted from work and pay. It is not stored.

create table public.profile_details (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reach text not null default 'town' check (reach in ('town', 'parish', 'country', 'region')),
  skill_levels jsonb not null default '[]'::jsonb,
  tools text[] not null default '{}',
  days_per_week integer check (days_per_week is null or days_per_week between 1 and 7),
  start_when text check (start_when is null or start_when in ('now', 'month', 'later')),
  languages text[] not null default '{}' check (cardinality(languages) <= 5),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) <= 4),
  interests text[] not null default '{}',
  kinds text[] not null default '{}',
  places text[] not null default '{}',
  amount_min_usd numeric check (amount_min_usd is null or amount_min_usd >= 0),
  amount_max_usd numeric check (amount_max_usd is null or amount_max_usd >= 0),
  horizon text check (horizon is null or horizon in ('1-2', '3-5', 'longer')),
  goals text[] not null default '{}',
  show_name boolean not null default true,
  updated_at timestamptz not null default now(),
  check (amount_min_usd is null or amount_max_usd is null or amount_max_usd >= amount_min_usd)
);

-- Saved and hidden cards. Only the owner can see them.
create table public.user_signals (
  user_id uuid not null references public.profiles (id) on delete cascade,
  item_id text not null,
  kind text not null check (kind in ('saved', 'hidden')),
  sector text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- The commit screen uses this as the starting choice for showing a name.
alter table public.commitments
  add column show_name boolean not null default true;

alter table public.profile_details enable row level security;
alter table public.user_signals enable row level security;

revoke all on table public.profile_details from public, anon, authenticated;
revoke all on table public.user_signals from public, anon, authenticated;

grant select, insert, update on table public.profile_details to authenticated;
grant select, insert, update, delete on table public.user_signals to authenticated;

-- A person reads their own profile details, including private fields.
create policy profile_details_select_own on public.profile_details
  for select to authenticated
  using (user_id = auth.uid());

-- A person inserts their own profile details.
create policy profile_details_insert_own on public.profile_details
  for insert to authenticated
  with check (user_id = auth.uid());

-- A person updates their own profile details.
create policy profile_details_update_own on public.profile_details
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A person reads only their own saved and hidden items.
create policy user_signals_select_own on public.user_signals
  for select to authenticated
  using (user_id = auth.uid());

-- A person inserts only their own saved and hidden items.
create policy user_signals_insert_own on public.user_signals
  for insert to authenticated
  with check (user_id = auth.uid());

-- A person updates only their own saved and hidden items.
create policy user_signals_update_own on public.user_signals
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A person deletes only their own saved and hidden items.
create policy user_signals_delete_own on public.user_signals
  for delete to authenticated
  using (user_id = auth.uid());

-- Others read skills, reach, languages, and tools. Private fields stay off this view.
create view public.public_profile_details
with (security_invoker = false) as
select user_id, reach, skill_levels, languages, tools
from public.profile_details;

revoke all on table public.public_profile_details from public, anon, authenticated;
grant select on table public.public_profile_details to anon, authenticated;

-- Others read the track record counts, not the underlying rows.
create view public.public_track
with (security_invoker = false) as
select
  profiles.id as user_id,
  (
    select count(*)
    from public.contributions
    where contributions.user_id = profiles.id
      and contributions.status = 'accepted'
  ) as accepted_work,
  (
    select count(distinct contributions.project_id)
    from public.contributions
    where contributions.user_id = profiles.id
      and contributions.status = 'accepted'
  ) as projects_worked,
  (
    select count(*)
    from public.payments
    join public.contributions on contributions.id = payments.contribution_id
    where contributions.user_id = profiles.id
      and payments.kind = 'pay-out'
      and payments.status = 'confirmed'
  ) as confirmed_payouts
from public.profiles;

revoke all on table public.public_track from public, anon, authenticated;
grant select on table public.public_track to anon, authenticated;
