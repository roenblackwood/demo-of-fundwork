-- Signing stays a plain message. Larger project wallets need more than one key.
-- Capital is released one phase at a time. Every payment change is logged.
-- Do not edit 0001 through 0007.
-- No key held by Fundwork can move anyone's money.
-- Identity checks, when they come, use a licensed provider and store only a checked flag and a date, never documents.

alter table public.projects
  add column goal_usd numeric,
  add column phases text[] not null default '{}',
  add column open_phase integer not null default 0,
  add column phase_note text,
  add column phase_baseline jsonb not null default '{}'::jsonb;

alter table public.projects
  drop constraint if exists projects_goal_usd_check;
alter table public.projects
  add constraint projects_goal_usd_check
  check (goal_usd is null or goal_usd >= 0);

alter table public.projects
  drop constraint if exists projects_open_phase_check;
alter table public.projects
  add constraint projects_open_phase_check
  check (open_phase >= 0);

alter table public.projects
  drop constraint if exists projects_phase_note_check;
alter table public.projects
  add constraint projects_phase_note_check
  check (phase_note is null or char_length(phase_note) <= 240);

alter table public.projects
  drop constraint if exists projects_phases_check;
alter table public.projects
  add constraint projects_phases_check
  check (cardinality(phases) <= 12);

alter table public.projects
  drop constraint if exists projects_phase_baseline_check;
alter table public.projects
  add constraint projects_phase_baseline_check
  check (jsonb_typeof(phase_baseline) = 'object');

update public.projects
set phase_baseline = coalesce(readiness, '{}'::jsonb);

alter table public.project_wallets
  add column wallet_type text not null default 'single',
  add column threshold integer not null default 1,
  add column owner_count integer not null default 1,
  add column keyholder_names text[] not null default '{}',
  add column descriptor text;

alter table public.project_wallets
  drop constraint if exists project_wallets_wallet_type_check;
alter table public.project_wallets
  add constraint project_wallets_wallet_type_check
  check (wallet_type in ('single', 'multisig'));

alter table public.project_wallets
  drop constraint if exists project_wallets_threshold_check;
alter table public.project_wallets
  add constraint project_wallets_threshold_check
  check (threshold >= 1 and owner_count >= threshold and cardinality(keyholder_names) <= 20);

alter table public.project_wallets
  drop constraint if exists project_wallets_descriptor_check;
alter table public.project_wallets
  add constraint project_wallets_descriptor_check
  check (descriptor is null or char_length(descriptor) <= 2000);

create table public.capital_tranches (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments (id) on delete cascade,
  project_id text not null references public.projects (id) on delete cascade,
  phase text not null check (char_length(phase) between 1 and 80),
  position integer not null check (position >= 0),
  amount numeric not null check (amount > 0),
  status text not null check (status in ('waiting', 'open', 'confirmed', 'closed')),
  unique (commitment_id, position)
);

create index capital_tranches_project on public.capital_tranches (project_id);

alter table public.payments
  add column tranche_id uuid references public.capital_tranches (id) on delete set null,
  add column phase text;

alter table public.payments
  drop constraint if exists payments_phase_check;
alter table public.payments
  add constraint payments_phase_check
  check (phase is null or char_length(phase) between 1 and 80);

-- Append-only. No role can update or delete these rows.
create table public.payment_events (
  id bigint generated always as identity primary key,
  payment_id uuid not null,
  old_status text,
  new_status text,
  reason text,
  at timestamptz not null default now(),
  fn text not null check (char_length(fn) between 1 and 80)
);

create index payment_events_payment on public.payment_events (payment_id);

alter table public.payment_events enable row level security;

create or replace function public.protect_goal_usd()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.goal_usd is distinct from old.goal_usd
     and current_setting('fundwork.set_goal_usd', true) is distinct from 'on' then
    raise exception 'The server sets the US dollar amount';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_protect_goal_usd on public.projects;
create trigger projects_protect_goal_usd
  before update on public.projects
  for each row
  execute function public.protect_goal_usd();

create or replace function public.projects_set_phase_baseline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.phase_baseline := coalesce(new.readiness, '{}'::jsonb);
  end if;
  return new;
end;
$$;

drop trigger if exists projects_phase_baseline on public.projects;
create trigger projects_phase_baseline
  before insert on public.projects
  for each row
  execute function public.projects_set_phase_baseline();

-- 40 percent first, then the rest split evenly. The last part takes the leftover.
create or replace function public.split_pledge(p_amount numeric, p_count integer)
returns numeric[]
language plpgsql
immutable
set search_path = public
as $$
declare
  total numeric;
  first numeric;
  rest numeric;
  each numeric;
  parts numeric[];
  index integer;
begin
  total := round(p_amount);
  if p_count is null or p_count < 2 or total <= 0 then
    return array[greatest(total, 0)];
  end if;
  first := floor(total * 0.4);
  rest := total - first;
  each := floor(rest / (p_count - 1));
  if first < 1 or rest < 1 or (p_count > 2 and each < 1) then
    return array[total];
  end if;
  if p_count = 2 then
    return array[first, total - first];
  end if;
  parts := array[first];
  for index in 2..(p_count - 1) loop
    parts := parts || array[each];
  end loop;
  parts := parts || array[total - (first + each * (p_count - 2))];
  return parts;
end;
$$;

create or replace function public.fill_commitment_tranches(p_commitment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.commitments;
  names text[];
  parts numeric[];
  open_at integer;
  index integer;
  next_status text;
begin
  select * into row from public.commitments where id = p_commitment_id;
  if not found then
    return;
  end if;
  if exists (
    select 1 from public.capital_tranches where commitment_id = row.id
  ) then
    return;
  end if;
  select project.phases, project.open_phase
    into names, open_at
  from public.projects as project
  where project.id = row.project_id;
  if names is null or cardinality(names) is null or cardinality(names) = 0 then
    names := array['Start']::text[];
  end if;
  open_at := coalesce(open_at, 0);
  parts := public.split_pledge(row.amount, cardinality(names));
  if cardinality(parts) = 1 then
    names := array[names[1]];
  end if;
  for index in 1..cardinality(parts) loop
    if parts[index] is null or parts[index] <= 0 then
      continue;
    end if;
    next_status := case
      when index - 1 = open_at then 'open'
      when index - 1 < open_at then 'closed'
      else 'waiting'
    end;
    insert into public.capital_tranches (commitment_id, project_id, phase, position, amount, status)
    values (row.id, row.project_id, names[index], index - 1, parts[index], next_status);
  end loop;
end;
$$;

create or replace function public.commitments_create_tranches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fill_commitment_tranches(new.id);
  return new;
end;
$$;

drop trigger if exists commitments_create_tranches on public.commitments;
create trigger commitments_create_tranches
  after insert on public.commitments
  for each row
  execute function public.commitments_create_tranches();

create or replace function public.log_payment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.payment_events (payment_id, old_status, new_status, reason, at, fn)
  values (
    new.id,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    new.reason,
    now(),
    left(coalesce(nullif(current_setting('fundwork.payment_fn', true), ''), 'record_observed_payment'), 80)
  );
  return new;
end;
$$;

drop trigger if exists payments_log_event on public.payments;
create trigger payments_log_event
  after insert or update on public.payments
  for each row
  execute function public.log_payment_event();

create or replace function public.payment_events_frozen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'payment_events cannot be changed';
end;
$$;

drop trigger if exists payment_events_no_change on public.payment_events;
create trigger payment_events_no_change
  before update or delete on public.payment_events
  for each row
  execute function public.payment_events_frozen();

create or replace function public.set_goal_usd(p_project_id text, p_goal_usd numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_goal_usd is null or p_goal_usd < 0 then
    raise exception 'The project amount is missing';
  end if;
  perform set_config('fundwork.set_goal_usd', 'on', true);
  update public.projects
  set goal_usd = p_goal_usd
  where id = p_project_id;
  if not found then
    raise exception 'That project is not here';
  end if;
end;
$$;

-- Sets the phase names. Rebuilds only pledges that have no payment yet.
create or replace function public.set_project_phases(p_project_id text, p_phases text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  proj public.projects;
  phase text;
  commitment record;
begin
  if p_phases is null or cardinality(p_phases) < 1 or cardinality(p_phases) > 12 then
    raise exception 'A project needs at least one phase';
  end if;
  foreach phase in array p_phases loop
    if phase is null or char_length(btrim(phase)) < 1 or char_length(phase) > 80 then
      raise exception 'A phase name is missing';
    end if;
  end loop;
  select * into proj from public.projects where id = p_project_id;
  if not found then
    raise exception 'That project is not here';
  end if;
  if proj.work_started then
    raise exception 'The split is fixed once work has started';
  end if;
  if proj.phases = p_phases then
    return;
  end if;
  update public.projects
  set phases = p_phases
  where id = proj.id;

  for commitment in
    select id from public.commitments where project_id = proj.id
  loop
    if exists (
      select 1 from public.payments
      where commitment_id = commitment.id
    ) or exists (
      select 1 from public.capital_tranches
      where commitment_id = commitment.id
        and status = 'confirmed'
    ) then
      continue;
    end if;
    delete from public.capital_tranches where commitment_id = commitment.id;
    perform public.fill_commitment_tranches(commitment.id);
  end loop;
end;
$$;

create or replace function public.set_project_split(p_project_id text, p_shares numeric[])
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  proj public.projects;
  share numeric;
  sum_shares numeric := 0;
  count_phases integer;
  commitment record;
  total numeric;
  parts numeric[];
  index integer;
  used numeric;
begin
  if auth.uid() is null then
    return false;
  end if;
  select * into proj from public.projects where id = p_project_id;
  if not found or proj.organizer_id is distinct from auth.uid() then
    return false;
  end if;
  if proj.work_started then
    return false;
  end if;
  count_phases := cardinality(proj.phases);
  if count_phases is null or count_phases < 1 then
    count_phases := 1;
  end if;
  if p_shares is null or cardinality(p_shares) <> count_phases then
    return false;
  end if;
  foreach share in array p_shares loop
    if share is null or share <= 0 then
      return false;
    end if;
    sum_shares := sum_shares + share;
  end loop;
  if sum_shares <= 0 then
    return false;
  end if;
  if exists (
    select 1 from public.capital_tranches
    where project_id = proj.id
      and status = 'confirmed'
  ) then
    return false;
  end if;

  for commitment in
    select id, amount from public.commitments
    where project_id = proj.id
      and status = 'pledged'
  loop
    total := round(commitment.amount);
    used := 0;
    for index in 1..(count_phases - 1) loop
      used := used + floor(total * p_shares[index] / sum_shares);
    end loop;
    if total - used <= 0 then
      return false;
    end if;
  end loop;

  for commitment in
    select id, amount from public.commitments
    where project_id = proj.id
      and status = 'pledged'
  loop
    total := round(commitment.amount);
    parts := array[]::numeric[];
    used := 0;
    for index in 1..count_phases loop
      if index = count_phases then
        parts := parts || array[total - used];
      else
        parts := parts || array[floor(total * p_shares[index] / sum_shares)];
        used := used + floor(total * p_shares[index] / sum_shares);
      end if;
    end loop;
    for index in 1..count_phases loop
      update public.capital_tranches
      set amount = parts[index]
      where commitment_id = commitment.id
        and position = index - 1
        and status <> 'confirmed';
    end loop;
  end loop;
  return true;
end;
$$;

-- The organizer marks the open phase done after a readiness item changes.
-- The note is built from that change. The next phase opens.
create or replace function public.mark_phase_done(p_project_id text, p_readiness jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  proj public.projects;
  pair record;
  total integer;
  keys text[];
  key text;
  old_value text;
  new_value text;
  label text;
  word text;
  parts text := '';
  phase_count integer;
  advanced boolean;
  next_open integer;
begin
  if auth.uid() is null or p_readiness is null or jsonb_typeof(p_readiness) <> 'object' then
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

  select * into proj from public.projects where id = p_project_id for update;
  if not found or proj.organizer_id is distinct from auth.uid() then
    return false;
  end if;

  select array(
    select distinct item.key
    from (
      select jsonb_object_keys(p_readiness) as key
      union
      select jsonb_object_keys(proj.phase_baseline) as key
    ) as item
    order by item.key
  ) into keys;

  if keys is not null then
    foreach key in array keys loop
      old_value := proj.phase_baseline ->> key;
      new_value := p_readiness ->> key;
      if old_value is distinct from new_value then
        label := replace(regexp_replace(key, '^(need:|check:)', ''), '-', ' ');
        word := case new_value
          when 'have' then 'Have it'
          when 'working' then 'Working'
          else 'Not yet'
        end;
        if parts <> '' then
          parts := parts || '. ';
        end if;
        parts := parts || label || ' is now ' || word;
      end if;
    end loop;
  end if;
  if parts = '' then
    return false;
  end if;
  parts := left(parts, 240);

  phase_count := greatest(coalesce(cardinality(proj.phases), 0), 1);
  advanced := proj.open_phase + 1 < phase_count;
  next_open := case when advanced then proj.open_phase + 1 else proj.open_phase end;

  update public.projects
  set readiness = p_readiness,
      phase_baseline = p_readiness,
      phase_note = parts,
      open_phase = next_open
  where id = proj.id;

  update public.capital_requests
  set readiness = p_readiness
  where project_id = proj.id
    and user_id = auth.uid();

  if advanced then
    update public.capital_tranches
    set status = 'closed'
    where project_id = proj.id
      and position = proj.open_phase
      and status = 'open';
    update public.capital_tranches
    set status = 'open'
    where project_id = proj.id
      and position = next_open
      and status = 'waiting';
  end if;
  return true;
end;
$$;

drop function if exists public.set_project_wallet(text, text, text);

-- A goal above US$5,000 cannot use a single key. The server writes goal_usd first.
-- Base multisig reads owners on the chain before this call. Bitcoin checks the descriptor there too.
create or replace function public.set_project_wallet(
  p_project_id text,
  p_chain text,
  p_address text,
  p_wallet_type text,
  p_threshold integer,
  p_owner_count integer,
  p_keyholder_names text[],
  p_descriptor text,
  p_owner_addresses text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  proj public.projects;
  stored text;
  holder text;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if p_chain not in ('bitcoin-signet', 'base-sepolia') then
    raise exception 'Test networks only';
  end if;
  if p_wallet_type not in ('single', 'multisig') then
    raise exception 'Unknown wallet type';
  end if;
  select * into proj from public.projects where id = p_project_id;
  if not found or proj.organizer_id is distinct from auth.uid() then
    raise exception 'Only the organizer can set the project wallet';
  end if;
  stored := public.normalize_chain_address(p_chain, p_address);
  if stored is null or char_length(stored) < 14 or char_length(stored) > 128 then
    raise exception 'That address does not match this test network';
  end if;
  if proj.goal_usd is not null and proj.goal_usd > 5000 and p_wallet_type is distinct from 'multisig' then
    raise exception 'This project is above US$5,000. It needs a wallet that takes more than one key.';
  end if;

  if p_wallet_type = 'single' then
    if p_threshold <> 1 or p_owner_count <> 1 then
      raise exception 'A single wallet has one key';
    end if;
    if not exists (
      select 1 from public.wallets as wallet
      where wallet.user_id = auth.uid()
        and wallet.chain = p_chain
        and wallet.verified_at is not null
        and public.normalize_chain_address(p_chain, wallet.address) = stored
    ) then
      raise exception 'Use one of your checked wallets';
    end if;
  else
    if p_threshold is null or p_threshold < 2 or p_owner_count is null or p_owner_count < p_threshold then
      raise exception 'This wallet needs at least 2 keys';
    end if;
    if p_keyholder_names is null or cardinality(p_keyholder_names) < 1 then
      raise exception 'Name the keyholders';
    end if;
    foreach holder in array p_keyholder_names loop
      if holder is null or char_length(btrim(holder)) < 1 or char_length(holder) > 40 then
        raise exception 'Name the keyholders';
      end if;
    end loop;
    if p_chain = 'bitcoin-signet' then
      if p_descriptor is null or char_length(btrim(p_descriptor)) < 20 then
        raise exception 'A Bitcoin project wallet needs a descriptor';
      end if;
      if p_owner_count < 3 or p_threshold * 3 < p_owner_count * 2 then
        raise exception 'Use a 2-of-3 wallet, or one that asks for more keys.';
      end if;
    end if;
    if p_chain = 'base-sepolia' and not exists (
      select 1
      from unnest(coalesce(p_owner_addresses, '{}'::text[])) as owner_address
      join public.wallets as wallet
        on public.normalize_chain_address(p_chain, wallet.address)
         = public.normalize_chain_address(p_chain, owner_address)
      join public.profiles as profile
        on profile.id = wallet.user_id
      where wallet.chain = p_chain
        and wallet.verified_at is not null
        and wallet.user_id is distinct from proj.organizer_id
        and (
          (
            proj.mentor_name is not null
            and lower(btrim(profile.name)) = lower(btrim(proj.mentor_name))
          )
          or exists (
            select 1 from public.commitments as commitment
            where commitment.project_id = proj.id
              and commitment.user_id = wallet.user_id
          )
        )
    ) then
      raise exception 'Add a mentor or a lead investor who is not the organizer';
    end if;
  end if;

  perform set_config('fundwork.set_project_wallet', 'on', true);
  insert into public.project_wallets (
    project_id,
    chain,
    address,
    wallet_type,
    threshold,
    owner_count,
    keyholder_names,
    descriptor
  ) values (
    p_project_id,
    p_chain,
    stored,
    p_wallet_type,
    case when p_wallet_type = 'single' then 1 else p_threshold end,
    case when p_wallet_type = 'single' then 1 else p_owner_count end,
    case when p_wallet_type = 'single' then '{}'::text[] else p_keyholder_names end,
    case
      when p_wallet_type = 'multisig' and p_chain = 'bitcoin-signet' then btrim(p_descriptor)
      else null
    end
  )
  on conflict (project_id, chain) do update
  set address = excluded.address,
      wallet_type = excluded.wallet_type,
      threshold = excluded.threshold,
      owner_count = excluded.owner_count,
      keyholder_names = excluded.keyholder_names,
      descriptor = excluded.descriptor;
end;
$$;

drop function if exists public.record_observed_payment(
  text, text, text, text, text, text[], text, text, numeric, integer, uuid, uuid, boolean, boolean
);

-- A capital-in is matched to the open tranche. Extra coins do not confirm the next phase.
-- A pay-out still has to come from the project wallet.
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
  cover numeric;
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
  tranche_amount numeric;
  tranche_phase text;
  tranche_key uuid;
  existing_tranche uuid;
  booked numeric;
  pledge_open boolean;
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
  tranche_amount := null;
  tranche_phase := null;
  tranche_key := null;

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

    select payment.tranche_id into existing_tranche
    from public.payments as payment
    where payment.chain = p_chain
      and payment.tx_id = p_tx_id
      and payment.to_address = p_to_address;

    if existing_tranche is not null then
      select tranche.amount, tranche.phase, tranche.id
        into tranche_amount, tranche_phase, tranche_key
      from public.capital_tranches as tranche
      where tranche.id = existing_tranche;
    else
      select tranche.amount, tranche.phase, tranche.id
        into tranche_amount, tranche_phase, tranche_key
      from public.capital_tranches as tranche
      where tranche.commitment_id = p_commitment_id
        and tranche.project_id = p_project_id
        and tranche.status = 'open'
      order by tranche.position
      limit 1;
    end if;
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

    cover := coalesce(tranche_amount, pledge);

    if project_address is null
       or public.normalize_chain_address(p_chain, p_to_address)
          is distinct from public.normalize_chain_address(p_chain, project_address) then
      next_status := 'mismatch';
      next_reason := 'This did not go to the project address.';
    elsif pledge is null then
      next_status := 'mismatch';
      next_reason := 'This payment is not tied to a pledge.';
    elsif cover is null or p_amount < cover then
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

  booked := p_amount;
  if next_status = 'confirmed'
     and tranche_amount is not null
     and p_amount > tranche_amount then
    booked := tranche_amount;
  end if;

  perform set_config('fundwork.record_payment', 'on', true);
  perform set_config('fundwork.payment_fn', 'record_observed_payment', true);

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
    checked_at,
    tranche_id,
    phase
  ) values (
    p_project_id,
    p_kind,
    p_chain,
    p_tx_id,
    stored_from,
    p_to_address,
    p_asset,
    booked,
    p_confirmations,
    next_status,
    case when p_kind = 'capital-in' then p_commitment_id else null end,
    case when p_kind = 'pay-out' then use_contribution else null end,
    next_reason,
    now(),
    case when p_kind = 'capital-in' then tranche_key else null end,
    case when p_kind = 'capital-in' then tranche_phase else null end
  )
  on conflict (chain, tx_id, to_address) do update
  set
    kind = excluded.kind,
    from_address = excluded.from_address,
    asset = excluded.asset,
    amount = case when payments.status = 'confirmed' then payments.amount else excluded.amount end,
    confirmations = excluded.confirmations,
    status = excluded.status,
    commitment_id = excluded.commitment_id,
    contribution_id = excluded.contribution_id,
    reason = excluded.reason,
    checked_at = now(),
    tranche_id = coalesce(payments.tranche_id, excluded.tranche_id),
    phase = coalesce(payments.phase, excluded.phase)
  where payments.project_id = excluded.project_id
  returning * into saved;

  if saved is null then
    raise exception 'That transaction is already recorded';
  end if;

  if next_status = 'confirmed' and p_kind = 'capital-in' and tranche_key is not null then
    update public.capital_tranches
    set status = 'confirmed'
    where id = tranche_key
      and status = 'open';
  end if;

  if next_status = 'confirmed' and p_kind = 'capital-in' then
    if not exists (
      select 1
      from public.capital_tranches
      where commitment_id = p_commitment_id
        and status in ('waiting', 'open')
    ) and (
      tranche_key is not null
      or (pledge is not null and p_amount >= pledge)
    ) then
      perform set_config('fundwork.accept_capital', 'on', true);
      update public.commitments as commitment
      set status = 'accepted'
      where commitment.id = p_commitment_id
        and commitment.project_id = p_project_id
        and commitment.status = 'pledged';
    end if;
  end if;

  pledge_open := exists (
    select 1
    from public.capital_tranches
    where commitment_id = p_commitment_id
      and status in ('waiting', 'open')
  );

  return to_jsonb(saved) || jsonb_build_object('pledge_open', pledge_open);
end;
$$;

revoke all on function public.split_pledge(numeric, integer) from public, anon, authenticated;
revoke all on function public.fill_commitment_tranches(uuid) from public, anon, authenticated;
revoke all on function public.commitments_create_tranches() from public;
revoke all on function public.log_payment_event() from public;
revoke all on function public.payment_events_frozen() from public;
revoke all on function public.protect_goal_usd() from public;
revoke all on function public.projects_set_phase_baseline() from public;

revoke all on function public.set_goal_usd(text, numeric) from public, anon, authenticated;
grant execute on function public.set_goal_usd(text, numeric) to service_role;

revoke all on function public.set_project_phases(text, text[]) from public, anon, authenticated;
grant execute on function public.set_project_phases(text, text[]) to service_role;

revoke all on function public.set_project_split(text, numeric[]) from public, anon;
grant execute on function public.set_project_split(text, numeric[]) to authenticated;

revoke all on function public.mark_phase_done(text, jsonb) from public, anon;
grant execute on function public.mark_phase_done(text, jsonb) to authenticated;

revoke all on function public.set_project_wallet(text, text, text, text, integer, integer, text[], text, text[]) from public, anon;
grant execute on function public.set_project_wallet(text, text, text, text, integer, integer, text[], text, text[]) to authenticated;

revoke all on function public.record_observed_payment(
  text, text, text, text, text, text[], text, text, numeric, integer, uuid, uuid, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.record_observed_payment(
  text, text, text, text, text, text[], text, text, numeric, integer, uuid, uuid, boolean, boolean
) to service_role;

revoke all on table public.capital_tranches from public, anon, authenticated, service_role;
grant select on table public.capital_tranches to authenticated, service_role;
alter table public.capital_tranches enable row level security;
drop policy if exists capital_tranches_select on public.capital_tranches;
create policy capital_tranches_select on public.capital_tranches
  for select to authenticated
  using (true);

revoke all on table public.payment_events from public, anon, authenticated, service_role;
grant select on table public.payment_events to service_role;

do $$
declare
  row record;
begin
  for row in select id from public.commitments
  loop
    perform public.fill_commitment_tranches(row.id);
  end loop;
end $$;
