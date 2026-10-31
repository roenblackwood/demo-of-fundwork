-- Asks for a country that is not on Fundwork yet.
-- A row stores a country id, a role, and a time. Nothing personal.
-- Clients can insert. They cannot read the rows. Counts come from the view.
-- Also lets a person watch a place from user_signals. Does not edit 0010.

create table public.country_requests (
  id uuid primary key default gen_random_uuid(),
  country_id text not null,
  role text,
  created_at timestamptz not null default now(),
  check (char_length(country_id) between 2 and 80),
  check (role is null or role in ('investor', 'worker'))
);

comment on table public.country_requests is
  'Demand for a country Fundwork does not list yet. No name, email, or user id.';

alter table public.country_requests enable row level security;

revoke all on table public.country_requests from public, anon, authenticated;

grant insert (country_id, role) on table public.country_requests to anon, authenticated;

create policy country_requests_insert on public.country_requests
  for insert to anon, authenticated
  with check (
    char_length(country_id) between 2 and 80
    and (role is null or role in ('investor', 'worker'))
  );

create view public.country_request_counts
with (security_invoker = false) as
select country_id, count(*)::bigint as asks
from public.country_requests
group by country_id;

comment on view public.country_request_counts is
  'How many people asked for each country. The only read path.';

revoke all on table public.country_request_counts from public, anon, authenticated;
grant select on table public.country_request_counts to anon, authenticated;

alter table public.user_signals drop constraint user_signals_kind_check;
alter table public.user_signals
  add constraint user_signals_kind_check check (kind in ('saved', 'hidden', 'watch'));
