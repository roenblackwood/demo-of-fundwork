-- Fix the live rules from 0001. Do not edit 0001.
-- A subquery that names an outer column without its table can bind to the inner table instead.

drop policy contributions_insert_member on public.contributions;
create policy contributions_insert_member on public.contributions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'logged'
    and exists (
      select 1 from public.project_members as member
      where member.project_id = contributions.project_id
        and member.worker_id = auth.uid()
    )
  );

drop policy applications_insert_applied on public.applications;
create policy applications_insert_applied on public.applications
  for insert to authenticated
  with check (
    worker_id = auth.uid()
    and origin = 'applied'
    and status = 'waiting'
    and exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'worker'
    )
    and (
      (
        request_id is not null
        and project_id is null
        and exists (
          select 1 from public.capital_requests as request
          where request.id = applications.request_id
            and request.status = 'open'
            and request.user_id <> auth.uid()
            and applications.skill = any (request.skills)
        )
      )
      or (
        project_id is not null
        and request_id is null
        and exists (
          select 1 from public.projects as project
          where project.id = applications.project_id
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

drop policy commitments_select on public.commitments;
create policy commitments_select on public.commitments
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects as project
      where project.id = commitments.project_id
        and project.organizer_id = auth.uid()
    )
  );

drop policy applications_select on public.applications;
create policy applications_select on public.applications
  for select to authenticated
  using (
    worker_id = auth.uid()
    or exists (
      select 1 from public.capital_requests as request
      where request.id = applications.request_id
        and request.user_id = auth.uid()
    )
    or exists (
      select 1 from public.projects as project
      where project.id = applications.project_id
        and project.organizer_id = auth.uid()
    )
  );

-- Signed-in people can read names and availability. Visitors cannot.
revoke select on table public.public_profiles from anon;
revoke select on table public.availability from anon;

drop policy availability_select on public.availability;
create policy availability_select on public.availability
  for select to authenticated
  using (true);

-- Public lists show a short name. The full name stays on profiles for the person themselves.
create or replace view public.public_profiles
with (security_invoker = false) as
select
  profiles.id,
  case
    when split.parts[1] is null then profiles.name
    when cardinality(split.parts) < 2 then split.parts[1]
    else split.parts[1] || ' ' || upper(left(split.parts[cardinality(split.parts)], 1)) || '.'
  end as name,
  profiles.role,
  profiles.country_id,
  profiles.parish_id,
  profiles.town_id
from public.profiles
cross join lateral (
  select regexp_split_to_array(btrim(profiles.name), '\s+') as parts
) as split;

-- The caller owns the open request, and the worker has posted that skill.
create or replace function public.invite_worker(request_id uuid, worker_id uuid, skill text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  req public.capital_requests;
  new_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  select * into req
  from public.capital_requests
  where capital_requests.id = invite_worker.request_id
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
#variable_conflict use_column
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
  where applications.id = set_application_status.application_id
  for update;

  if not found or app.status <> 'waiting' then
    return false;
  end if;

  if app.request_id is not null then
    select * into req
    from public.capital_requests
    where capital_requests.id = app.request_id
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
      where applications.request_id = req.id
        and applications.status = 'accepted';
      if req.status <> 'open' or accepted_count >= req.workers_needed then
        return false;
      end if;
    end if;

    update public.applications
    set status = set_application_status.status
    where applications.id = app.id;

    select count(*)::integer into accepted_count
    from public.applications
    where applications.request_id = req.id
      and applications.status = 'accepted';

    if req.status = 'open' and accepted_count >= req.workers_needed then
      update public.capital_requests
      set status = 'team-ready'
      where capital_requests.id = req.id;
    end if;

    return true;
  end if;

  if app.project_id is null or app.origin <> 'applied' then
    return false;
  end if;

  select * into proj
  from public.projects
  where projects.id = app.project_id
  for update;

  if not found or proj.organizer_id is distinct from auth.uid() then
    return false;
  end if;

  update public.applications
  set status = set_application_status.status
  where applications.id = app.id;

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
#variable_conflict use_column
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
  where applications.id = withdraw_application.application_id
  for update;

  if not found or app.status <> 'waiting' or app.worker_id <> auth.uid() then
    return false;
  end if;

  if app.request_id is not null then
    select * into req
    from public.capital_requests
    where capital_requests.id = app.request_id
    for update;
    request_found := found;
  end if;

  update public.applications
  set status = 'withdrawn'
  where applications.id = app.id;

  if request_found and req.status = 'team-ready' then
    select count(*)::integer into accepted_count
    from public.applications
    where applications.request_id = req.id
      and applications.status = 'accepted';
    if accepted_count < req.workers_needed then
      update public.capital_requests
      set status = 'open'
      where capital_requests.id = req.id;
    end if;
  end if;

  return true;
end;
$$;

-- The owner of a ready request starts the project, adds the accepted workers, and pledges the budget.
-- Keep these checks in sync with openChecks in src/lib/catalog.ts.
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

  -- Same three checks as openChecks: Jamaica lodging, Jamaica farms, then the general set.
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
  where capital_requests.id = req.id;

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
