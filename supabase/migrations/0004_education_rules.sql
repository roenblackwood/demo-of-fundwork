-- The database enforces the first-commitment hold, the investor check, and lesson records.
-- Do not edit 0001, 0002, or 0003.

alter table public.profiles
  add column investor_basics_at timestamptz;

-- Only pass_investor_basics can set the check time. It sets fundwork.pass_basics for this transaction.
create or replace function public.protect_investor_basics()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('fundwork.pass_basics', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.investor_basics_at is not null then
    raise exception 'investor_basics_at cannot be changed here';
  end if;
  if tg_op = 'UPDATE' and new.investor_basics_at is distinct from old.investor_basics_at then
    raise exception 'investor_basics_at cannot be changed here';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_investor_basics on public.profiles;
create trigger profiles_protect_investor_basics
  before insert or update on public.profiles
  for each row
  execute function public.protect_investor_basics();

revoke all on function public.protect_investor_basics() from public, anon, authenticated;

-- A person updates their own profile, but not the investor check time.
drop policy profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and investor_basics_at is not distinct from (
      select profile.investor_basics_at
      from public.profiles as profile
      where profile.id = profiles.id
    )
  );

revoke insert, update on table public.profiles from authenticated;
grant insert (
  id,
  name,
  role,
  country_id,
  parish_id,
  town_id,
  skill,
  extra_skills
) on table public.profiles to authenticated;
grant update (
  id,
  name,
  role,
  country_id,
  parish_id,
  town_id,
  skill,
  extra_skills
) on table public.profiles to authenticated;

-- Sets the signed-in person's investor check to now.
create or replace function public.pass_investor_basics()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  perform set_config('fundwork.pass_basics', 'on', true);

  update public.profiles
  set investor_basics_at = now()
  where profiles.id = auth.uid();
end;
$$;

revoke all on function public.pass_investor_basics() from public, anon;
grant execute on function public.pass_investor_basics() to authenticated;

-- An investor who passed the check inserts a pledged commitment as themselves.
-- start_project's pledge is exempt because that function is security definer.
drop policy commitments_insert_own on public.commitments;
create policy commitments_insert_own on public.commitments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pledged'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'investor'
        and profiles.investor_basics_at is not null
    )
  );

-- The database sets the hold. A client counts_at is ignored.
-- The first commitment for this user counts 24 hours later. Later ones count now.
-- This also covers the pledge inside start_project.
create or replace function public.set_commitment_counts_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  earlier integer;
begin
  select count(*)::integer into earlier
  from public.commitments
  where commitments.user_id = new.user_id;

  if earlier = 0 then
    new.counts_at := now() + interval '24 hours';
  else
    new.counts_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists commitments_set_counts_at on public.commitments;
create trigger commitments_set_counts_at
  before insert on public.commitments
  for each row
  execute function public.set_commitment_counts_at();

revoke all on function public.set_commitment_counts_at() from public, anon, authenticated;

create table public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal text not null check (char_length(goal) <= 140),
  plan text[] not null default '{}' check (cardinality(plan) <= 2),
  status text not null default 'open' check (status in ('open', 'done', 'not-done')),
  note text not null default '' check (char_length(note) <= 140),
  week_of date not null,
  created_at timestamptz not null default now()
);

create unique index weekly_goals_one_open
  on public.weekly_goals (project_id, user_id)
  where status = 'open';

create table public.lesson_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null check (char_length(lesson_id) between 1 and 80),
  seen_at timestamptz,
  done_at timestamptz,
  primary key (user_id, lesson_id)
);

alter table public.weekly_goals enable row level security;
alter table public.lesson_progress enable row level security;

revoke all on table public.weekly_goals from public, anon, authenticated;
revoke all on table public.lesson_progress from public, anon, authenticated;

grant select, insert, update on table public.weekly_goals to authenticated;
grant select, insert, update on table public.lesson_progress to authenticated;

-- The organizer reads their own weekly goals.
create policy weekly_goals_select_own on public.weekly_goals
  for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = weekly_goals.project_id
        and projects.organizer_id = auth.uid()
    )
  );

-- The organizer adds a weekly goal on their own project.
create policy weekly_goals_insert_own on public.weekly_goals
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = weekly_goals.project_id
        and projects.organizer_id = auth.uid()
    )
  );

-- The organizer updates their own weekly goals.
create policy weekly_goals_update_own on public.weekly_goals
  for update to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = weekly_goals.project_id
        and projects.organizer_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects
      where projects.id = weekly_goals.project_id
        and projects.organizer_id = auth.uid()
    )
  );

-- A person reads their own lesson progress.
create policy lesson_progress_select_own on public.lesson_progress
  for select to authenticated
  using (user_id = auth.uid());

-- A person adds their own lesson progress.
create policy lesson_progress_insert_own on public.lesson_progress
  for insert to authenticated
  with check (user_id = auth.uid());

-- A person updates their own lesson progress.
create policy lesson_progress_update_own on public.lesson_progress
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
