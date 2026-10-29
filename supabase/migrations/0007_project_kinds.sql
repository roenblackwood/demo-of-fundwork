-- Add business-registration to the checks a new project starts with.
-- Keep these checks in sync with openChecks in src/lib/catalog.ts.
-- Does not edit 0001 through 0006.

-- The owner of a ready request starts the project, adds the accepted workers, and pledges the budget.
-- Kind, site, and readiness copy onto the project.
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

  -- Same three sets as openChecks: Jamaica lodging, Jamaica farms, then the general set.
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

  insert into public.commitments (user_id, project_id, amount, status)
  values (auth.uid(), new_id, req.budget, 'pledged');

  update public.capital_requests
  set status = 'closed', project_id = new_id
  where capital_requests.id = req.id;

  return new_id;
end;
$$;

revoke all on function public.start_project(uuid, text) from public, anon;
grant execute on function public.start_project(uuid, text) to authenticated;
