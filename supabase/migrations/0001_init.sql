-- Fundwork live tables. Places, sectors, skills, checks, and guides stay in the app.
-- Status changes go through the functions at the bottom. Clients cannot update them.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  role text not null check (role in ('investor', 'worker')),
  country_id text not null,
  parish_id text,
  town_id text not null,
  skill text,
  extra_skills text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.projects (
  id text primary key default gen_random_uuid()::text,
  organizer_id uuid references public.profiles (id),
  organizer_name text not null,
  name text not null,
  country_id text not null,
  parish_id text,
  town_id text not null,
  sector text not null,
  summary text not null,
  what_you_get text not null,
  goal numeric not null check (goal > 0),
  workers_needed integer not null check (workers_needed >= 0),
  weekly_payout numeric not null check (weekly_payout >= 0),
  work_started boolean not null default false,
  needs text[] not null default '{}',
  checks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.project_members (
  project_id text not null references public.projects (id) on delete cascade,
  worker_id uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (project_id, worker_id)
);

create table public.capital_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  country_id text not null,
  parish_id text,
  town_id text not null,
  sector text not null,
  budget numeric not null check (budget > 0),
  workers_needed integer not null check (workers_needed between 1 and 10),
  skills text[] not null check (cardinality(skills) > 0),
  note text not null default '' check (char_length(note) <= 240),
  status text not null default 'open' check (status in ('open', 'team-ready', 'closed')),
  project_id text references public.projects (id),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.capital_requests (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  worker_id uuid not null references public.profiles (id),
  skill text not null,
  message text not null default '' check (char_length(message) <= 200),
  origin text not null check (origin in ('applied', 'invited')),
  status text not null default 'waiting' check (status in ('waiting', 'accepted', 'declined', 'withdrawn')),
  created_at timestamptz not null default now(),
  constraint applications_one_target check (
    (request_id is not null and project_id is null)
    or (request_id is null and project_id is not null)
  )
);

create unique index applications_request_worker_active
  on public.applications (request_id, worker_id)
  where request_id is not null and status in ('waiting', 'accepted');

create unique index applications_project_worker_active
  on public.applications (project_id, worker_id)
  where project_id is not null and status in ('waiting', 'accepted');

create table public.availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  country_id text not null,
  parish_id text,
  town_id text not null,
  skills text[] not null check (cardinality(skills) > 0),
  note text not null default '' check (char_length(note) <= 240),
  created_at timestamptz not null default now()
);

create table public.commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  project_id text not null references public.projects (id),
  amount numeric not null check (amount > 0),
  status text not null default 'pledged' check (status in ('pledged', 'accepted')),
  created_at timestamptz not null default now()
);

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  project_id text not null references public.projects (id),
  skill text not null,
  preset text not null check (preset in ('day', 'few', 'week')),
  status text not null default 'logged' check (status in ('logged', 'accepted')),
  created_at timestamptz not null default now()
);

-- Public names and places only. The view owner reads profiles so visitors can see the list.
create view public.public_profiles
with (security_invoker = false) as
select id, name, role, country_id, parish_id, town_id
from public.profiles;

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.capital_requests enable row level security;
alter table public.applications enable row level security;
alter table public.availability enable row level security;
alter table public.commitments enable row level security;
alter table public.contributions enable row level security;

revoke all on table public.profiles from public, anon, authenticated;
revoke all on table public.projects from public, anon, authenticated;
revoke all on table public.project_members from public, anon, authenticated;
revoke all on table public.capital_requests from public, anon, authenticated;
revoke all on table public.applications from public, anon, authenticated;
revoke all on table public.availability from public, anon, authenticated;
revoke all on table public.commitments from public, anon, authenticated;
revoke all on table public.contributions from public, anon, authenticated;
revoke all on table public.public_profiles from public, anon, authenticated;

grant select on table public.projects to anon, authenticated;
grant select on table public.project_members to anon, authenticated;
grant select on table public.capital_requests to anon, authenticated;
grant select on table public.availability to anon, authenticated;
grant select on table public.public_profiles to anon, authenticated;

grant select, insert, update on table public.profiles to authenticated;
grant insert on table public.capital_requests to authenticated;
grant insert on table public.commitments to authenticated;
grant insert on table public.availability to authenticated;
grant insert on table public.applications to authenticated;
grant insert on table public.contributions to authenticated;
grant select on table public.commitments to authenticated;
grant select on table public.contributions to authenticated;
grant select on table public.applications to authenticated;

-- A person reads their own profile, including skill.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = auth.uid());

-- A person inserts their own profile.
create policy profiles_insert_own on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

-- A person updates their own profile.
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Visitors and signed-in users read projects so the lists stay open.
create policy projects_select on public.projects
  for select to anon, authenticated
  using (true);

-- Visitors and signed-in users read project members so the lists stay open.
create policy project_members_select on public.project_members
  for select to anon, authenticated
  using (true);

-- Visitors and signed-in users read capital requests so the lists stay open.
create policy capital_requests_select on public.capital_requests
  for select to anon, authenticated
  using (true);

-- Visitors and signed-in users read availability so the lists stay open.
create policy availability_select on public.availability
  for select to anon, authenticated
  using (true);

-- An investor inserts a capital request as themselves, still open.
create policy capital_requests_insert_own on public.capital_requests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'open'
    and project_id is null
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'investor'
    )
  );

-- An investor inserts a pledged commitment as themselves.
create policy commitments_insert_own on public.commitments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pledged'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'investor'
    )
  );

-- A worker inserts an availability post as themselves.
create policy availability_insert_own on public.availability
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'worker'
    )
  );

-- A worker inserts an application they sent, still waiting, on an open request they do not own or on a project with an organizer.
create policy applications_insert_applied on public.applications
  for insert to authenticated
  with check (
    worker_id = auth.uid()
    and origin = 'applied'
    and status = 'waiting'
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'worker'
    )
    and (
      (
        request_id is not null
        and project_id is null
        and exists (
          select 1 from public.capital_requests as request
          where request.id = request_id
            and request.status = 'open'
            and request.user_id <> auth.uid()
            and skill = any (request.skills)
        )
      )
      or (
        project_id is not null
        and request_id is null
        and exists (
          select 1 from public.projects as project
          where project.id = project_id
            and project.organizer_id is not null
            and not exists (
              select 1 from public.project_members as member
              where member.project_id = project.id
                and member.worker_id = auth.uid()
            )
        )
      )
    )
  );

-- A worker logs work only on a project where they are a member, and the row stays logged.
create policy contributions_insert_member on public.contributions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'logged'
    and exists (
      select 1 from public.project_members as member
      where member.project_id = project_id
        and member.worker_id = auth.uid()
    )
  );

-- A person reads their own commitments, and the organizer reads commitments on their project.
create policy commitments_select on public.commitments
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects as project
      where project.id = project_id
        and project.organizer_id = auth.uid()
    )
  );

-- A person reads their own logged work.
create policy contributions_select_own on public.contributions
  for select to authenticated
  using (user_id = auth.uid());

-- A person reads their own applications, the request owner reads that request, and the organizer reads that project.
create policy applications_select on public.applications
  for select to authenticated
  using (
    worker_id = auth.uid()
    or exists (
      select 1 from public.capital_requests as request
      where request.id = request_id
        and request.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects as project
      where project.id = project_id
        and project.organizer_id = auth.uid()
    )
  );

-- The caller owns the open request, and the worker has posted that skill.
create or replace function public.invite_worker(request_id uuid, worker_id uuid, skill text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.capital_requests;
  new_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select * into req
  from public.capital_requests
  where id = invite_worker.request_id
  for update;

  if not found
    or req.user_id <> auth.uid()
    or req.status <> 'open'
    or not (invite_worker.skill = any (req.skills))
  then
    return null;
  end if;

  if not exists (
    select 1 from public.availability as post
    where post.user_id = invite_worker.worker_id
      and invite_worker.skill = any (post.skills)
  ) then
    return null;
  end if;

  if exists (
    select 1 from public.applications as application
    where application.request_id = req.id
      and application.worker_id = invite_worker.worker_id
      and application.status in ('waiting', 'accepted')
  ) then
    return null;
  end if;

  insert into public.applications (
    request_id, project_id, worker_id, skill, message, origin, status
  ) values (
    req.id, null, invite_worker.worker_id, invite_worker.skill, '', 'invited', 'waiting'
  )
  returning id into new_id;

  return new_id;
end;
$$;

-- The request owner decides an application, the invited worker decides an invite, and the project organizer decides a join.
create or replace function public.set_application_status(application_id uuid, status text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.applications;
  req public.capital_requests;
  proj public.projects;
  accepted_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  if set_application_status.status not in ('accepted', 'declined') then
    return false;
  end if;

  select * into app
  from public.applications
  where id = set_application_status.application_id
  for update;

  if not found or app.status <> 'waiting' then
    return false;
  end if;

  if app.request_id is not null then
    select * into req
    from public.capital_requests
    where id = app.request_id
    for update;

    if not found then
      return false;
    end if;

    if app.origin = 'applied' then
      if req.user_id <> auth.uid() then
        return false;
      end if;
    elsif app.origin = 'invited' then
      if app.worker_id <> auth.uid() then
        return false;
      end if;
    else
      return false;
    end if;

    if set_application_status.status = 'accepted' then
      select count(*)::integer into accepted_count
      from public.applications
      where request_id = req.id
        and applications.status = 'accepted';
      if req.status <> 'open' or accepted_count >= req.workers_needed then
        return false;
      end if;
    end if;

    update public.applications
    set status = set_application_status.status
    where id = app.id;

    select count(*)::integer into accepted_count
    from public.applications
    where request_id = req.id
      and applications.status = 'accepted';

    if req.status = 'open' and accepted_count >= req.workers_needed then
      update public.capital_requests
      set status = 'team-ready'
      where id = req.id;
    end if;

    return true;
  end if;

  if app.project_id is null or app.origin <> 'applied' then
    return false;
  end if;

  select * into proj
  from public.projects
  where id = app.project_id
  for update;

  if not found or proj.organizer_id is distinct from auth.uid() then
    return false;
  end if;

  update public.applications
  set status = set_application_status.status
  where id = app.id;

  if set_application_status.status = 'accepted' then
    insert into public.project_members (project_id, worker_id)
    values (proj.id, app.worker_id)
    on conflict do nothing;
  end if;

  return true;
end;
$$;

-- The worker withdraws while the application is waiting. A full request opens again if the team drops below the number needed.
create or replace function public.withdraw_application(application_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  app public.applications;
  req public.capital_requests;
  request_found boolean := false;
  accepted_count integer;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into app
  from public.applications
  where id = withdraw_application.application_id
  for update;

  if not found or app.status <> 'waiting' or app.worker_id <> auth.uid() then
    return false;
  end if;

  if app.request_id is not null then
    select * into req
    from public.capital_requests
    where id = app.request_id
    for update;
    request_found := found;
  end if;

  update public.applications
  set status = 'withdrawn'
  where id = app.id;

  if request_found and req.status = 'team-ready' then
    select count(*)::integer into accepted_count
    from public.applications
    where request_id = req.id
      and applications.status = 'accepted';
    if accepted_count < req.workers_needed then
      update public.capital_requests
      set status = 'open'
      where id = req.id;
    end if;
  end if;

  return true;
end;
$$;

-- The owner of a ready request starts the project, adds the accepted workers, and pledges the budget.
create or replace function public.start_project(request_id uuid, name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.capital_requests;
  owner_name text;
  project_name text;
  new_id text;
  accepted_count integer;
  payout numeric;
  check_rows jsonb;
begin
  if auth.uid() is null then
    return null;
  end if;

  project_name := left(btrim(start_project.name), 80);
  if project_name = '' then
    return null;
  end if;

  select * into req
  from public.capital_requests
  where id = start_project.request_id
  for update;

  if not found
    or req.user_id <> auth.uid()
    or req.status <> 'team-ready'
    or req.project_id is not null
  then
    return null;
  end if;

  select count(*)::integer into accepted_count
  from public.applications
  where request_id = req.id
    and status = 'accepted';

  if accepted_count < 1 then
    return null;
  end if;

  select profiles.name into owner_name
  from public.profiles
  where profiles.id = auth.uid();

  if owner_name is null then
    return null;
  end if;

  payout := case req.sector
    when 'lodging' then 30000
    when 'agriculture' then 24000
    when 'energy' then 18000
    when 'water' then 16000
    when 'connectivity' then 20000
    when 'education' then 18000
    when 'healthcare' then 20000
    else 18000
  end;

  if req.country_id = 'jamaica' and req.sector = 'lodging' then
    check_rows := '[{"id":"organizer","state":"open"},{"id":"jtb","state":"open"},{"id":"site-visit","state":"open"}]'::jsonb;
  elsif req.country_id = 'jamaica' and req.sector = 'agriculture' then
    check_rows := '[{"id":"organizer","state":"open"},{"id":"rada","state":"open"},{"id":"site-visit","state":"open"}]'::jsonb;
  else
    check_rows := '[{"id":"organizer","state":"open"},{"id":"engineer","state":"open"},{"id":"community","state":"open"}]'::jsonb;
  end if;

  insert into public.projects (
    organizer_id,
    organizer_name,
    name,
    country_id,
    parish_id,
    town_id,
    sector,
    summary,
    what_you_get,
    goal,
    workers_needed,
    weekly_payout,
    work_started,
    needs,
    checks
  ) values (
    auth.uid(),
    owner_name,
    project_name,
    req.country_id,
    req.parish_id,
    req.town_id,
    req.sector,
    case when btrim(req.note) = '' then 'Work on this in this place.' else req.note end,
    'A part of this project, recorded as ownership units if the organizer accepts your money.',
    req.budget,
    accepted_count,
    payout,
    false,
    req.skills,
    check_rows
  )
  returning id into new_id;

  insert into public.project_members (project_id, worker_id)
  select new_id, application.worker_id
  from public.applications as application
  where application.request_id = req.id
    and application.status = 'accepted';

  insert into public.commitments (user_id, project_id, amount, status)
  values (auth.uid(), new_id, req.budget, 'pledged');

  update public.capital_requests
  set status = 'closed', project_id = new_id
  where id = req.id;

  return new_id;
end;
$$;

revoke all on function public.invite_worker(uuid, uuid, text) from public, anon;
revoke all on function public.set_application_status(uuid, text) from public, anon;
revoke all on function public.withdraw_application(uuid) from public, anon;
revoke all on function public.start_project(uuid, text) from public, anon;

grant execute on function public.invite_worker(uuid, uuid, text) to authenticated;
grant execute on function public.set_application_status(uuid, text) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;
grant execute on function public.start_project(uuid, text) to authenticated;
