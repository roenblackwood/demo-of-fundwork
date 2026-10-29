-- Sender checks for observed payments, plus the kind of project a request starts.
-- Do not edit 0001 to 0005. Addresses are compared after normalizing both sides.
-- Base (0x) and bech32 (tb1) are lowercased. Other Bitcoin addresses stay as stored.
-- The pledge and the chain amount are still compared as plain numbers. No price is applied.

alter table public.capital_requests
  add column kind text,
  add column site text,
  add column readiness jsonb not null default '{}'::jsonb;

alter table public.capital_requests
  drop constraint if exists capital_requests_kind_check;
alter table public.capital_requests
  add constraint capital_requests_kind_check
  check (kind is null or char_length(kind) between 1 and 80);

alter table public.capital_requests
  drop constraint if exists capital_requests_site_check;
alter table public.capital_requests
  add constraint capital_requests_site_check
  check (site is null or site in ('own', 'lease', 'permission', 'not-yet'));

alter table public.capital_requests
  drop constraint if exists capital_requests_readiness_check;
alter table public.capital_requests
  add constraint capital_requests_readiness_check
  check (jsonb_typeof(readiness) = 'object');

alter table public.projects
  add column kind text,
  add column site text,
  add column readiness jsonb not null default '{}'::jsonb;

alter table public.projects
  drop constraint if exists projects_kind_check;
alter table public.projects
  add constraint projects_kind_check
  check (kind is null or char_length(kind) between 1 and 80);

alter table public.projects
  drop constraint if exists projects_site_check;
alter table public.projects
  add constraint projects_site_check
  check (site is null or site in ('own', 'lease', 'permission', 'not-yet'));

alter table public.projects
  drop constraint if exists projects_readiness_check;
alter table public.projects
  add constraint projects_readiness_check
  check (jsonb_typeof(readiness) = 'object');

-- Lowercase Base and bech32 so a checksummed address still matches. Leave base58 as stored.
create or replace function public.normalize_chain_address(p_chain text, p_address text)
returns text
language sql
immutable
as $$
  select case
    when p_address is null or btrim(p_address) = '' then null
    when p_chain = 'base-sepolia' or left(lower(btrim(p_address)), 2) = '0x' then lower(btrim(p_address))
    when left(lower(btrim(p_address)), 3) = 'tb1' then lower(btrim(p_address))
    else btrim(p_address)
  end;
$$;

revoke all on function public.normalize_chain_address(text, text) from public, anon, authenticated;
grant execute on function public.normalize_chain_address(text, text) to service_role, postgres;

-- Drop the old signature so the unchecked overload cannot be called.
drop function if exists public.record_observed_payment(
  text, text, text, text, text, text, text, numeric, integer, uuid, uuid, boolean, boolean
);

-- The server passes what it read on the chain, including every sender address.
-- Bitcoin signet is confirmed at 3 confirmations. Base Sepolia is confirmed after 5 more blocks.
-- A capital-in is confirmed only when one sender is the investor's checked wallet on that chain.
-- A pay-out is confirmed only when one sender is the project wallet on that chain.
create or replace function public.record_observed_payment(
  p_project_id text,
  p_kind text,
  p_chain text,
  p_tx_id text,
  p_from_address text,
  p_from_addresses text[],
  p_to_address text,
  p_asset text,
  p_amount numeric,
  p_confirmations integer,
  p_commitment_id uuid,
  p_contribution_id uuid,
  p_failed boolean,
  p_ambiguous boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  pledge numeric;
  needed integer;
  project_address text;
  member_ok boolean;
  next_status text;
  next_reason text;
  use_contribution uuid;
  saved public.payments;
  senders text[];
  matched_from text;
  stored_from text;
begin
  if p_kind not in ('capital-in', 'pay-out') then
    raise exception 'Unknown payment kind';
  end if;
  if p_chain not in ('bitcoin-signet', 'base-sepolia') then
    raise exception 'Test networks only';
  end if;
  if (p_chain = 'bitcoin-signet' and p_asset <> 'BTC')
     or (p_chain = 'base-sepolia' and p_asset <> 'USDC') then
    raise exception 'That coin is not on this test network';
  end if;
  if p_amount < 0 or p_confirmations < 0 then
    raise exception 'Amount and confirmations come from the chain';
  end if;

  needed := case when p_chain = 'bitcoin-signet' then 3 else 5 end;
  use_contribution := p_contribution_id;
  senders := coalesce(p_from_addresses, '{}'::text[]);
  if p_from_address is not null and btrim(p_from_address) <> '' then
    senders := senders || array[p_from_address];
  end if;
  matched_from := null;

  if p_kind = 'capital-in' then
    select wallet.address into matched_from
    from public.wallets as wallet
    join public.commitments as commitment
      on commitment.user_id = wallet.user_id
    where commitment.id = p_commitment_id
      and commitment.project_id = p_project_id
      and wallet.chain = p_chain
      and wallet.verified_at is not null
      and public.normalize_chain_address(p_chain, wallet.address) in (
        select public.normalize_chain_address(p_chain, sender)
        from unnest(senders) as sender
      )
    limit 1;
  else
    select wallet.address into matched_from
    from public.project_wallets as wallet
    where wallet.project_id = p_project_id
      and wallet.chain = p_chain
      and public.normalize_chain_address(p_chain, wallet.address) in (
        select public.normalize_chain_address(p_chain, sender)
        from unnest(senders) as sender
      )
    limit 1;
  end if;

  stored_from := coalesce(
    matched_from,
    nullif(btrim(coalesce(p_from_address, '')), ''),
    nullif(btrim(coalesce(senders[1], '')), ''),
    ''
  );

  if p_failed then
    next_status := 'mismatch';
    next_reason := 'This transaction failed.';
  elsif p_ambiguous then
    next_status := 'mismatch';
    next_reason := 'This payment went to more than one checked wallet.';
  elsif p_kind = 'capital-in' then
    select wallet.address into project_address
    from public.project_wallets as wallet
    where wallet.project_id = p_project_id
      and wallet.chain = p_chain;

    select commitment.amount into pledge
    from public.commitments as commitment
    where commitment.id = p_commitment_id
      and commitment.project_id = p_project_id;

    if project_address is null
       or public.normalize_chain_address(p_chain, p_to_address)
          is distinct from public.normalize_chain_address(p_chain, project_address) then
      next_status := 'mismatch';
      next_reason := 'This did not go to the project address.';
    elsif pledge is null then
      next_status := 'mismatch';
      next_reason := 'This payment is not tied to a pledge.';
    elsif p_amount < pledge then
      next_status := 'mismatch';
      next_reason := 'This amount does not cover the pledge.';
    elsif p_confirmations < needed then
      next_status := 'pending';
      next_reason := null;
    elsif matched_from is null then
      next_status := 'mismatch';
      next_reason := 'This was not sent from your checked wallet.';
    else
      next_status := 'confirmed';
      next_reason := null;
    end if;
  else
    select exists (
      select 1
      from public.wallets as wallet
      join public.project_members as member
        on member.worker_id = wallet.user_id
       and member.project_id = p_project_id
      where wallet.chain = p_chain
        and wallet.verified_at is not null
        and public.normalize_chain_address(p_chain, wallet.address)
            = public.normalize_chain_address(p_chain, p_to_address)
    ) into member_ok;

    if not member_ok then
      next_status := 'mismatch';
      next_reason := 'This did not go to a checked wallet of someone on the team.';
    elsif p_amount <= 0 then
      next_status := 'mismatch';
      next_reason := 'This amount is zero.';
    elsif p_confirmations < needed then
      next_status := 'pending';
      next_reason := null;
    elsif matched_from is null then
      next_status := 'mismatch';
      next_reason := 'This did not come from the project wallet.';
    else
      next_status := 'confirmed';
      next_reason := null;
    end if;

    if use_contribution is not null and not exists (
      select 1
      from public.contributions as contribution
      join public.wallets as wallet
        on wallet.user_id = contribution.user_id
       and wallet.chain = p_chain
       and wallet.verified_at is not null
       and public.normalize_chain_address(p_chain, wallet.address)
           = public.normalize_chain_address(p_chain, p_to_address)
      where contribution.id = use_contribution
        and contribution.project_id = p_project_id
    ) then
      use_contribution := null;
    end if;
  end if;

  perform set_config('fundwork.record_payment', 'on', true);

  insert into public.payments (
    project_id,
    kind,
    chain,
    tx_id,
    from_address,
    to_address,
    asset,
    amount,
    confirmations,
    status,
    commitment_id,
    contribution_id,
    reason,
    checked_at
  ) values (
    p_project_id,
    p_kind,
    p_chain,
    p_tx_id,
    stored_from,
    p_to_address,
    p_asset,
    p_amount,
    p_confirmations,
    next_status,
    case when p_kind = 'capital-in' then p_commitment_id else null end,
    case when p_kind = 'pay-out' then use_contribution else null end,
    next_reason,
    now()
  )
  on conflict (chain, tx_id, to_address) do update
  set
    kind = excluded.kind,
    from_address = excluded.from_address,
    asset = excluded.asset,
    amount = excluded.amount,
    confirmations = excluded.confirmations,
    status = excluded.status,
    commitment_id = excluded.commitment_id,
    contribution_id = excluded.contribution_id,
    reason = excluded.reason,
    checked_at = now()
  where payments.project_id = excluded.project_id
  returning * into saved;

  if saved is null then
    raise exception 'That transaction is already recorded';
  end if;

  if next_status = 'confirmed'
     and p_kind = 'capital-in'
     and pledge is not null
     and p_amount >= pledge then
    perform set_config('fundwork.accept_capital', 'on', true);
    update public.commitments as commitment
    set status = 'accepted'
    where commitment.id = p_commitment_id
      and commitment.project_id = p_project_id
      and commitment.status = 'pledged';
  end if;

  return to_jsonb(saved);
end;
$$;

revoke all on function public.record_observed_payment(
  text, text, text, text, text, text[], text, text, numeric, integer, uuid, uuid, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.record_observed_payment(
  text, text, text, text, text, text[], text, text, numeric, integer, uuid, uuid, boolean, boolean
) to service_role;

-- The owner of a ready request starts the project, adds the accepted workers, and pledges the budget.
-- Keep these checks in sync with openChecks in src/lib/catalog.ts.
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

-- The owner replaces the readiness list. Photos, document uploads, and a mentor review are not built.
create or replace function public.set_readiness(
  p_request_id uuid,
  p_project_id text,
  p_readiness jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  req public.capital_requests;
  proj public.projects;
  pair record;
  total integer;
begin
  if auth.uid() is null then
    return false;
  end if;
  if p_readiness is null or jsonb_typeof(p_readiness) <> 'object' then
    return false;
  end if;

  select count(*) into total from jsonb_object_keys(p_readiness);
  if total > 40 then
    return false;
  end if;

  for pair in select key, value from jsonb_each(p_readiness)
  loop
    if char_length(pair.key) < 1 or char_length(pair.key) > 160 then
      return false;
    end if;
    if jsonb_typeof(pair.value) <> 'string'
       or (pair.value #>> '{}') not in ('have', 'working', 'not-yet') then
      return false;
    end if;
  end loop;

  if p_request_id is not null then
    select * into req
    from public.capital_requests
    where capital_requests.id = p_request_id
    for update;
    if not found or req.user_id <> auth.uid() then
      return false;
    end if;
    update public.capital_requests
    set readiness = p_readiness
    where capital_requests.id = req.id;
    if req.project_id is not null then
      update public.projects
      set readiness = p_readiness
      where projects.id = req.project_id
        and projects.organizer_id = auth.uid();
    end if;
    return true;
  end if;

  if p_project_id is not null then
    select * into proj
    from public.projects
    where projects.id = p_project_id
    for update;
    if not found or proj.organizer_id is distinct from auth.uid() then
      return false;
    end if;
    update public.projects
    set readiness = p_readiness
    where projects.id = proj.id;
    update public.capital_requests
    set readiness = p_readiness
    where capital_requests.project_id = proj.id
      and capital_requests.user_id = auth.uid();
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.set_readiness(uuid, text, jsonb) from public, anon;
grant execute on function public.set_readiness(uuid, text, jsonb) to authenticated;

revoke all on function public.start_project(uuid, text) from public, anon;
grant execute on function public.start_project(uuid, text) to authenticated;
