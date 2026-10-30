-- Short video can come later. This stores still photos only.
-- A name on a joined pledge stays off unless the person turns it on.

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

create table public.photos (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null check (subject in ('request', 'project', 'profile')),
  subject_id text not null,
  alt text not null check (char_length(btrim(alt)) between 1 and 200),
  storage_path text not null,
  created_at timestamptz not null default now()
);

create index photos_by_subject on public.photos (subject, subject_id, created_at);

alter table public.photos enable row level security;

create or replace function public.photo_allowed(subject text, subject_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when photo_allowed.subject = 'profile' then photo_allowed.subject_id = auth.uid()::text
    when photo_allowed.subject = 'request' then exists (
      select 1
      from public.capital_requests
      where capital_requests.id::text = photo_allowed.subject_id
        and capital_requests.user_id = auth.uid()
    )
    when photo_allowed.subject = 'project' then exists (
      select 1
      from public.projects
      where projects.id::text = photo_allowed.subject_id
        and projects.organizer_id = auth.uid()
    )
    else false
  end;
$$;

revoke all on function public.photo_allowed(text, text) from public, anon;
grant execute on function public.photo_allowed(text, text) to authenticated;

create or replace function public.photos_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;
  if not public.photo_allowed(new.subject, new.subject_id) then
    raise exception 'not allowed';
  end if;
  if (
    select count(*)
    from public.photos
    where photos.subject = new.subject
      and photos.subject_id = new.subject_id
  ) >= 4 then
    raise exception '4 photos is the limit';
  end if;
  return new;
end;
$$;

revoke all on function public.photos_limit() from public, anon, authenticated;

create trigger photos_limit
  before insert on public.photos
  for each row
  execute function public.photos_limit();

create policy photos_select on public.photos
  for select to authenticated
  using (true);

create policy photos_insert on public.photos
  for insert to authenticated
  with check (owner_id = auth.uid() and public.photo_allowed(subject, subject_id));

create policy photos_delete on public.photos
  for delete to authenticated
  using (owner_id = auth.uid());

grant select, insert, delete on public.photos to authenticated;

insert into storage.buckets (id, name, public)
values ('photos', 'photos', false);

create policy photos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'photos');

create policy photos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy photos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy photos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
