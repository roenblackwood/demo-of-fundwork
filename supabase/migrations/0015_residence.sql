-- Where a person lives is separate from where a project sits.
-- Invest is open only for countries a lawyer has cleared. None are cleared.
-- A lawyer must review the blocked list before it is treated as final.
-- Identity checks through a licensed provider are the real residence control. Not built.
-- Per-state rules for the United States are not built.

create table public.residence_invest_open (
  code text primary key
);

comment on table public.residence_invest_open is
  'Countries a lawyer has cleared for investing. Ships empty. A lawyer must review the blocked list.';

revoke all on table public.residence_invest_open from public, anon, authenticated;

alter table public.profiles
  add column residence_country text;

comment on column public.profiles.residence_country is
  'Where this person lives. Only the owner can set it. Not the project market.';

grant insert (residence_country) on table public.profiles to authenticated;
grant update (residence_country) on table public.profiles to authenticated;

-- True only when this person's residence is on the lawyer allowlist. A null residence is not open.
create or replace function public.residence_invest_open(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    join public.residence_invest_open as allowed
      on allowed.code = profiles.residence_country
    where profiles.id = residence_invest_open.uid
  );
$$;

revoke all on function public.residence_invest_open(uuid) from public, anon;
grant execute on function public.residence_invest_open(uuid) to authenticated;

drop policy commitments_insert_own on public.commitments;
create policy commitments_insert_own on public.commitments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pledged'
    and public.residence_invest_open(auth.uid())
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'investor'
        and profiles.investor_basics_at is not null
    )
  );

-- No insert grant. If one is added later, a residence that is not open still cannot insert.
create policy request_pledges_insert_open on public.request_pledges
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pledged'
    and public.residence_invest_open(auth.uid())
  );

create or replace function public.pledge_to_request(request_id uuid, amount numeric, show_name boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  req public.capital_requests;
  taken numeric;
  new_id uuid;
  basics timestamptz;
  caller_role text;
begin
  if auth.uid() is null then
    return null;
  end if;
  if not public.residence_invest_open(auth.uid()) then
    return null;
  end if;
  if pledge_to_request.amount is null or pledge_to_request.amount < 1 then
    return null;
  end if;

  select profiles.role, profiles.investor_basics_at
    into caller_role, basics
  from public.profiles
  where profiles.id = auth.uid();

  if caller_role is distinct from 'investor' or basics is null then
    return null;
  end if;

  select * into req
  from public.capital_requests
  where capital_requests.id = pledge_to_request.request_id
  for update;

  if not found
    or req.status not in ('open', 'team-ready')
    or req.project_id is not null
  then
    return null;
  end if;

  if exists (
    select 1
    from public.request_pledges
    where request_pledges.request_id = req.id
      and request_pledges.user_id = auth.uid()
      and request_pledges.status = 'pledged'
  ) then
    return null;
  end if;

  perform 1
  from public.request_pledges
  where request_pledges.request_id = req.id
    and request_pledges.status = 'pledged'
  for update;

  select coalesce(sum(request_pledges.amount), 0) into taken
  from public.request_pledges
  where request_pledges.request_id = req.id
    and request_pledges.status = 'pledged';

  if taken + pledge_to_request.amount > req.budget then
    return null;
  end if;

  insert into public.request_pledges (request_id, user_id, amount, status, show_name)
  values (req.id, auth.uid(), pledge_to_request.amount, 'pledged', coalesce(pledge_to_request.show_name, false))
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    return null;
end;
$$;

revoke all on function public.pledge_to_request(uuid, numeric, boolean) from public, anon;
grant execute on function public.pledge_to_request(uuid, numeric, boolean) to authenticated;

-- Same checks as 0011. Refuses before any insert when the organizer's residence is not open,
-- including the organizer's own pledge.
create or replace function public.start_project(request_id uuid, name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  req public.capital_requests;
  owner_name text;
  project_name text;
  new_id text;
  accepted_count integer;
  payout numeric;
  check_rows jsonb;
  open_pledge public.request_pledges;
begin
  if auth.uid() is null then
    return null;
  end if;
  if not public.residence_invest_open(auth.uid()) then
    return null;
  end if;

  project_name := left(btrim(start_project.name), 80);
  if project_name = '' then
    return null;
  end if;

  select * into req
  from public.capital_requests
  where capital_requests.id = start_project.request_id
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
  where applications.request_id = req.id
    and applications.status = 'accepted';

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
    check_rows := '[{"id":"organizer","state":"open"},{"id":"jtb","state":"open"},{"id":"site-visit","state":"open"},{"id":"business-registration","state":"open"}]'::jsonb;
  elsif req.country_id = 'jamaica' and req.sector = 'agriculture' then
    check_rows := '[{"id":"organizer","state":"open"},{"id":"rada","state":"open"},{"id":"site-visit","state":"open"},{"id":"business-registration","state":"open"}]'::jsonb;
  else
    check_rows := '[{"id":"organizer","state":"open"},{"id":"engineer","state":"open"},{"id":"community","state":"open"},{"id":"business-registration","state":"open"}]'::jsonb;
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
    checks,
    kind,
    site,
    readiness
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
    check_rows,
    req.kind,
    req.site,
    coalesce(req.readiness, '{}'::jsonb)
  )
  returning id into new_id;

  insert into public.project_members (project_id, worker_id)
  select new_id, application.worker_id
  from public.applications as application
  where application.request_id = req.id
    and application.status = 'accepted';

  for open_pledge in
    select request_pledges.*
    from public.request_pledges
    where request_pledges.request_id = req.id
      and request_pledges.status = 'pledged'
    order by request_pledges.created_at, request_pledges.id
    for update
  loop
    insert into public.commitments (user_id, project_id, amount, status, show_name)
    values (open_pledge.user_id, new_id, open_pledge.amount, 'pledged', open_pledge.show_name);

    update public.request_pledges
    set status = 'converted'
    where request_pledges.id = open_pledge.id;
  end loop;

  update public.capital_requests
  set status = 'closed', project_id = new_id
  where capital_requests.id = req.id;

  return new_id;
end;
$$;

revoke all on function public.start_project(uuid, text) from public, anon;
grant execute on function public.start_project(uuid, text) to authenticated;

create table public.capital_interests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  project_id text references public.projects (id) on delete cascade,
  request_id uuid references public.capital_requests (id) on delete cascade,
  amount numeric,
  kind text not null check (kind in ('commit', 'join', 'send')),
  created_at timestamptz not null default now(),
  check (project_id is not null or request_id is not null),
  check (amount is null or amount >= 0)
);

alter table public.capital_interests enable row level security;

revoke all on table public.capital_interests from public, anon, authenticated;
grant select, insert on table public.capital_interests to authenticated;

create policy capital_interests_owner_read on public.capital_interests
  for select to authenticated
  using (user_id = auth.uid());

create policy capital_interests_owner_insert on public.capital_interests
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not public.residence_invest_open(auth.uid())
  );
