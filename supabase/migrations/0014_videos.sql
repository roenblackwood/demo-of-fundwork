-- Short videos recorded in the app. Gallery uploads need GPS metadata removal on the server first.
-- Server-side transcoding and multiple quality levels can come later.
-- Automatic face blurring can come later.

create table public.videos (
  id uuid primary key,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  contribution_id uuid references public.contributions (id) on delete set null,
  phase text not null,
  description text not null check (char_length(btrim(description)) between 1 and 120),
  -- Stops the exact same file from being used twice.
  -- A perceptual fingerprint could catch edited copies later.
  sha256 text not null unique check (sha256 ~ '^[0-9a-f]{64}$'),
  -- A signal only. It never changes acceptance and never counts toward readiness.
  at_site boolean not null default false,
  hidden boolean not null default false,
  pinned boolean not null default false,
  on_profile boolean not null default false,
  bytes integer not null check (bytes between 1 and 8388608),
  created_at timestamptz not null default now()
);

create index videos_by_project on public.videos (project_id, created_at desc);
create unique index videos_one_pin on public.videos (project_id, phase) where pinned;

alter table public.videos enable row level security;

create table public.video_reports (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos (id) on delete cascade,
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (video_id, reporter_id)
);

alter table public.video_reports enable row level security;

create or replace function public.video_on_team(project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.projects
    where projects.id = video_on_team.project_id
      and projects.organizer_id = auth.uid()
  )
  or exists (
    select 1
    from public.project_members
    where project_members.project_id = video_on_team.project_id
      and project_members.worker_id = auth.uid()
  );
$$;

revoke all on function public.video_on_team(text) from public, anon;
grant execute on function public.video_on_team(text) to authenticated;

create or replace function public.videos_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  organizing boolean;
begin
  organizing := exists (
    select 1
    from public.projects
    where projects.id = new.project_id
      and projects.organizer_id = auth.uid()
  );

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() then
      raise exception 'not allowed';
    end if;
    if not public.video_on_team(new.project_id) then
      raise exception 'not allowed';
    end if;
    if new.contribution_id is not null and not exists (
      select 1
      from public.contributions
      where contributions.id = new.contribution_id
        and contributions.project_id = new.project_id
        and contributions.user_id = new.owner_id
    ) then
      raise exception 'not allowed';
    end if;
    if new.on_profile and (
      select count(*)
      from public.videos
      where videos.owner_id = new.owner_id
        and videos.on_profile
        and not videos.hidden
    ) >= 4 then
      raise exception '4 videos is the limit';
    end if;
    return new;
  end if;

  if new.owner_id is distinct from old.owner_id
    or new.project_id is distinct from old.project_id
    or new.phase is distinct from old.phase
    or new.description is distinct from old.description
    or new.sha256 is distinct from old.sha256
    or new.at_site is distinct from old.at_site
    or new.bytes is distinct from old.bytes
    or new.created_at is distinct from old.created_at
  then
    raise exception 'not allowed';
  end if;

  if new.contribution_id is distinct from old.contribution_id then
    if old.contribution_id is not null
      or new.owner_id is distinct from auth.uid()
      or new.contribution_id is null
      or not exists (
        select 1
        from public.contributions
        where contributions.id = new.contribution_id
          and contributions.project_id = new.project_id
          and contributions.user_id = new.owner_id
      )
    then
      raise exception 'not allowed';
    end if;
  end if;

  if new.pinned is distinct from old.pinned and not organizing then
    raise exception 'not allowed';
  end if;

  if new.on_profile is distinct from old.on_profile and new.owner_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;

  if new.hidden is distinct from old.hidden and new.owner_id is distinct from auth.uid() and not organizing then
    raise exception 'not allowed';
  end if;

  if new.on_profile and not old.on_profile and (
    select count(*)
    from public.videos
    where videos.owner_id = new.owner_id
      and videos.on_profile
      and not videos.hidden
      and videos.id <> new.id
  ) >= 4 then
    raise exception '4 videos is the limit';
  end if;

  return new;
end;
$$;

revoke all on function public.videos_guard() from public, anon, authenticated;

create trigger videos_guard
  before insert or update on public.videos
  for each row
  execute function public.videos_guard();

-- Signed-in people read videos, and a hidden video stays with the owner and the organizer.
create policy videos_select on public.videos
  for select to authenticated
  using (
    not hidden
    or owner_id = auth.uid()
    or exists (
      select 1
      from public.projects
      where projects.id = videos.project_id
        and projects.organizer_id = auth.uid()
    )
  );

-- A team member or the organizer can add a video on that project.
create policy videos_insert on public.videos
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and public.video_on_team(project_id)
  );

-- The owner and the organizer can update a video. The guard limits which fields move.
create policy videos_update on public.videos
  for update to authenticated
  using (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.projects
      where projects.id = videos.project_id
        and projects.organizer_id = auth.uid()
    )
  )
  with check (
    owner_id = auth.uid()
    or exists (
      select 1
      from public.projects
      where projects.id = videos.project_id
        and projects.organizer_id = auth.uid()
    )
  );

-- Anyone signed in can report a video.
create policy video_reports_insert on public.video_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

-- Only the organizer of that project can read reports.
create policy video_reports_select on public.video_reports
  for select to authenticated
  using (
    exists (
      select 1
      from public.videos
      join public.projects on projects.id = videos.project_id
      where videos.id = video_reports.video_id
        and projects.organizer_id = auth.uid()
    )
  );

grant select, insert, update on public.videos to authenticated;
grant select, insert on public.video_reports to authenticated;

-- The organizer reads logged work on their project.
create policy contributions_select_organizer on public.contributions
  for select to authenticated
  using (
    exists (
      select 1
      from public.projects
      where projects.id = contributions.project_id
        and projects.organizer_id = auth.uid()
    )
  );

create or replace function public.accept_contribution(contribution_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  updated integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  update public.contributions
  set status = 'accepted'
  where contributions.id = accept_contribution.contribution_id
    and contributions.status = 'logged'
    and exists (
      select 1
      from public.projects
      where projects.id = contributions.project_id
        and projects.organizer_id = auth.uid()
    );
  get diagnostics updated = row_count;
  return updated = 1;
end;
$$;

revoke all on function public.accept_contribution(uuid) from public, anon;
grant execute on function public.accept_contribution(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', false, 8388608, array['video/mp4', 'video/webm']);

-- Signed-in people can read a video file.
create policy videos_read on storage.objects
  for select to authenticated
  using (bucket_id = 'videos');

-- The owner writes only into their own folder.
create policy videos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The owner can replace a file in their own folder.
create policy videos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- The owner can delete a file in their own folder.
create policy videos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
