-- Several investors can pledge to one request.
-- Does not edit 0001 through 0010. There is no 0008.

alter table public.capital_requests
  add column poster_amount numeric
  check (poster_amount is null or (poster_amount >= 1 and poster_amount <= budget));

create table public.request_pledges (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.capital_requests (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric not null check (amount >= 1),
  status text not null default 'pledged' check (status in ('pledged', 'withdrawn', 'converted')),
  show_name boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index request_pledges_one_active
  on public.request_pledges (request_id, user_id)
  where status = 'pledged';

alter table public.request_pledges enable row level security;

revoke all on table public.request_pledges from public, anon, authenticated;

grant select (id, request_id, amount, status, created_at)
  on table public.request_pledges to anon, authenticated;

create policy request_pledges_read on public.request_pledges
  for select to anon, authenticated
  using (true);

-- Names stay off the table grant. This view shows a name only when show_name is on.
-- The owner can still see their own user id, so they can withdraw.
create view public.request_pledge_names
with (security_invoker = false) as
select
  pledge.id,
  pledge.request_id,
  case
    when pledge.show_name or pledge.user_id = auth.uid() then pledge.user_id
    else null
  end as user_id,
  case
    when pledge.show_name then profiles.name
    else null
  end as name,
  pledge.show_name,
  pledge.amount,
  pledge.status,
  pledge.created_at
from public.request_pledges as pledge
left join public.profiles as profiles on profiles.id = pledge.user_id;

revoke all on table public.request_pledge_names from public, anon;
grant select on table public.request_pledge_names to authenticated;

insert into public.request_pledges (request_id, user_id, amount, status, show_name, created_at)
select
  req.id,
  req.user_id,
  coalesce(req.poster_amount, req.budget),
  case
    when req.status = 'closed' or req.project_id is not null then 'converted'
    else 'pledged'
  end,
  coalesce(details.show_name, true),
  req.created_at
from public.capital_requests as req
left join public.profile_details as details on details.user_id = req.user_id
where not exists (
  select 1 from public.request_pledges as pledge where pledge.request_id = req.id
);

create or replace function public.capital_requests_lead_pledge()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  visible boolean;
begin
  select profile_details.show_name into visible
  from public.profile_details
  where profile_details.user_id = new.user_id;

  insert into public.request_pledges (request_id, user_id, amount, status, show_name, created_at)
  values (
    new.id,
    new.user_id,
    coalesce(new.poster_amount, new.budget),
    case
      when new.status = 'closed' or new.project_id is not null then 'converted'
      else 'pledged'
    end,
    coalesce(visible, true),
    coalesce(new.created_at, now())
  );
  return new;
end;
$$;

create trigger capital_requests_lead_pledge
  after insert on public.capital_requests
  for each row
  execute function public.capital_requests_lead_pledge();

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
  values (req.id, auth.uid(), pledge_to_request.amount, 'pledged', coalesce(pledge_to_request.show_name, true))
  returning id into new_id;

  return new_id;
exception
  when unique_violation then
    return null;
end;
$$;

create or replace function public.withdraw_request_pledge(pledge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  row public.request_pledges;
  req public.capital_requests;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into row
  from public.request_pledges
  where request_pledges.id = withdraw_request_pledge.pledge_id
  for update;

  if not found or row.user_id <> auth.uid() or row.status <> 'pledged' then
    return false;
  end if;

  select * into req
  from public.capital_requests
  where capital_requests.id = row.request_id
  for update;

  if not found or req.project_id is not null then
    return false;
  end if;

  if row.user_id = req.user_id and exists (
    select 1
    from public.request_pledges
    where request_pledges.request_id = req.id
      and request_pledges.status = 'pledged'
      and request_pledges.id <> row.id
  ) then
    return false;
  end if;

  update public.request_pledges
  set status = 'withdrawn'
  where request_pledges.id = row.id;

  return true;
end;
$$;

create or replace function public.close_request(request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  req public.capital_requests;
begin
  if auth.uid() is null then
    return false;
  end if;

  select * into req
  from public.capital_requests
  where capital_requests.id = close_request.request_id
  for update;

  if not found
    or req.user_id <> auth.uid()
    or req.project_id is not null
    or req.status = 'closed'
  then
    return false;
  end if;

  update public.capital_requests
  set status = 'closed'
  where capital_requests.id = req.id;

  return true;
end;
$$;

-- Same checks as 0007. Each pledged row becomes its own commitment, split into phases by the tranche trigger.
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

revoke all on function public.pledge_to_request(uuid, numeric, boolean) from public, anon;
revoke all on function public.withdraw_request_pledge(uuid) from public, anon;
revoke all on function public.close_request(uuid) from public, anon;
revoke all on function public.start_project(uuid, text) from public, anon;
revoke all on function public.capital_requests_lead_pledge() from public, anon, authenticated;

grant execute on function public.pledge_to_request(uuid, numeric, boolean) to authenticated;
grant execute on function public.withdraw_request_pledge(uuid) to authenticated;
grant execute on function public.close_request(uuid) to authenticated;
grant execute on function public.start_project(uuid, text) to authenticated;
