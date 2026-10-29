-- Read-only payment tracking. Fundwork does not hold keys, sign, or send.
-- Test networks only: Bitcoin signet, and USDC on Base Sepolia.
-- Do not edit 0001, 0002, 0003, or 0004.
-- Later: mainnet, Lightning, and multisig or escrow for project wallets.
-- A background watcher can re-check pending payments. There is no job yet.
-- Local cash-out partners are not built.
-- Do not add a view that joins wallet addresses to owner names.

-- A person adds their own wallet. Only mark_wallet_checked sets verified_at.
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  chain text not null check (chain in ('bitcoin-signet', 'base-sepolia')),
  address text not null check (char_length(address) between 14 and 128),
  label text not null default '' check (char_length(label) <= 40),
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (chain, address)
);

create index wallets_user on public.wallets (user_id);

-- The check message is one-time and expires in 10 minutes. Clients cannot read or write this table.
create table public.wallet_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id) on delete cascade,
  message text not null check (char_length(message) between 20 and 240),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index wallet_checks_wallet on public.wallet_checks (wallet_id);

-- One receiving address per chain. Set only by set_project_wallet.
create table public.project_wallets (
  project_id text not null references public.projects (id) on delete cascade,
  chain text not null check (chain in ('bitcoin-signet', 'base-sepolia')),
  address text not null check (char_length(address) between 14 and 128),
  primary key (project_id, chain)
);

-- The chain amount and the pledge are compared as plain numbers. No price is applied.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects (id) on delete cascade,
  kind text not null check (kind in ('capital-in', 'pay-out')),
  chain text not null check (chain in ('bitcoin-signet', 'base-sepolia')),
  tx_id text not null check (char_length(tx_id) between 64 and 80),
  from_address text not null default '' check (char_length(from_address) <= 128),
  to_address text not null check (char_length(to_address) between 1 and 128),
  asset text not null check (asset in ('BTC', 'USDC')),
  amount numeric not null check (amount >= 0),
  confirmations integer not null check (confirmations >= 0),
  status text not null check (status in ('pending', 'confirmed', 'mismatch')),
  commitment_id uuid references public.commitments (id) on delete set null,
  contribution_id uuid references public.contributions (id) on delete set null,
  reason text check (reason is null or char_length(reason) <= 160),
  checked_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (chain, tx_id, to_address)
);

create index payments_project on public.payments (project_id);

create or replace function public.protect_wallet_verified()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('fundwork.verify_wallet', true) = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' and new.verified_at is not null then
    raise exception 'verified_at cannot be set here';
  end if;
  if tg_op = 'UPDATE' and new.verified_at is distinct from old.verified_at then
    raise exception 'verified_at cannot be set here';
  end if;
  return new;
end;
$$;

drop trigger if exists wallets_protect_verified on public.wallets;
create trigger wallets_protect_verified
  before insert or update on public.wallets
  for each row
  execute function public.protect_wallet_verified();

-- A commitment starts pledged. It becomes accepted only after a confirmed capital-in covers it.
-- Once a project has a wallet, the organizer does not accept capital by hand. There is no hand-accept path.
create or replace function public.protect_commitment_status()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'pledged' then
      return new;
    end if;
    raise exception 'A commitment starts as pledged';
  end if;
  if new.status is not distinct from old.status then
    return new;
  end if;
  if current_setting('fundwork.accept_capital', true) = 'on'
     and old.status = 'pledged'
     and new.status = 'accepted' then
    return new;
  end if;
  raise exception 'A commitment is accepted only after a confirmed capital-in that covers it';
end;
$$;

drop trigger if exists commitments_protect_status on public.commitments;
create trigger commitments_protect_status
  before insert or update on public.commitments
  for each row
  execute function public.protect_commitment_status();

create or replace function public.protect_project_wallets()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('fundwork.set_project_wallet', true) = 'on' then
    return new;
  end if;
  raise exception 'Only the organizer sets a project wallet, through set_project_wallet';
end;
$$;

drop trigger if exists project_wallets_protect on public.project_wallets;
create trigger project_wallets_protect
  before insert or update on public.project_wallets
  for each row
  execute function public.protect_project_wallets();

create or replace function public.protect_payments()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('fundwork.record_payment', true) = 'on' then
    return new;
  end if;
  raise exception 'Only the server records a payment after it checks the chain';
end;
$$;

drop trigger if exists payments_protect on public.payments;
create trigger payments_protect
  before insert or update on public.payments
  for each row
  execute function public.protect_payments();

-- Called by the server after a signature check. Clients cannot call it.
create or replace function public.mark_wallet_checked(p_wallet_id uuid, p_owner_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  marked timestamptz;
begin
  perform set_config('fundwork.verify_wallet', 'on', true);
  update public.wallets as wallet
  set verified_at = now()
  where wallet.id = p_wallet_id
    and wallet.user_id = p_owner_id
    and wallet.verified_at is null
  returning wallet.verified_at into marked;
  return marked;
end;
$$;

-- The organizer sets the project address to one of their own checked wallets.
create or replace function public.set_project_wallet(
  p_project_id text,
  p_chain text,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if p_chain not in ('bitcoin-signet', 'base-sepolia') then
    raise exception 'Test networks only';
  end if;
  if not exists (
    select 1 from public.projects as project
    where project.id = p_project_id
      and project.organizer_id = auth.uid()
  ) then
    raise exception 'Only the organizer can set the project wallet';
  end if;
  if not exists (
    select 1 from public.wallets as wallet
    where wallet.user_id = auth.uid()
      and wallet.chain = p_chain
      and wallet.address = p_address
      and wallet.verified_at is not null
  ) then
    raise exception 'Use one of your checked wallets';
  end if;

  perform set_config('fundwork.set_project_wallet', 'on', true);
  insert into public.project_wallets (project_id, chain, address)
  values (p_project_id, p_chain, p_address)
  on conflict (project_id, chain) do update set address = excluded.address;
end;
$$;

-- The server passes what it read on the chain. This function decides the status.
-- Bitcoin signet is confirmed at 3 confirmations. Base Sepolia is confirmed after 5 more blocks.
-- A wrong amount or a wrong recipient is a mismatch. The client does not send the amount.
create or replace function public.record_observed_payment(
  p_project_id text,
  p_kind text,
  p_chain text,
  p_tx_id text,
  p_from_address text,
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

    if project_address is null or p_to_address is distinct from project_address then
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
        and wallet.address = p_to_address
        and wallet.verified_at is not null
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
       and wallet.address = p_to_address
       and wallet.verified_at is not null
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
    p_from_address,
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

alter table public.wallets enable row level security;
alter table public.wallet_checks enable row level security;
alter table public.project_wallets enable row level security;
alter table public.payments enable row level security;

revoke all on table public.wallets from public, anon, authenticated;
revoke all on table public.wallet_checks from public, anon, authenticated;
revoke all on table public.project_wallets from public, anon, authenticated;
revoke all on table public.payments from public, anon, authenticated;

-- A person inserts and reads only their own wallet. verified_at is not in the insert list.
grant select on table public.wallets to authenticated;
grant insert (user_id, chain, address, label) on table public.wallets to authenticated;

create policy wallets_select_own on public.wallets
  for select to authenticated
  using (user_id = auth.uid());

create policy wallets_insert_own on public.wallets
  for insert to authenticated
  with check (user_id = auth.uid() and verified_at is null);

-- Signed-in people read project addresses and payments for any project. The money page stays open.
grant select on table public.project_wallets to authenticated;
create policy project_wallets_select on public.project_wallets
  for select to authenticated
  using (true);

grant select on table public.payments to authenticated;
create policy payments_select on public.payments
  for select to authenticated
  using (true);

-- wallet_checks has no policy, so a signed-in person cannot read or write it.

revoke all on function public.protect_wallet_verified() from public;
revoke all on function public.protect_commitment_status() from public;
revoke all on function public.protect_project_wallets() from public;
revoke all on function public.protect_payments() from public;
grant execute on function public.protect_wallet_verified() to authenticated, service_role;
grant execute on function public.protect_commitment_status() to authenticated, service_role;
grant execute on function public.protect_project_wallets() to service_role;
grant execute on function public.protect_payments() to service_role;

revoke all on function public.mark_wallet_checked(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mark_wallet_checked(uuid, uuid) to service_role;

revoke all on function public.set_project_wallet(text, text, text) from public, anon;
grant execute on function public.set_project_wallet(text, text, text) to authenticated;

revoke all on function public.record_observed_payment(
  text, text, text, text, text, text, text, numeric, integer, uuid, uuid, boolean, boolean
) from public, anon, authenticated;
grant execute on function public.record_observed_payment(
  text, text, text, text, text, text, text, numeric, integer, uuid, uuid, boolean, boolean
) to service_role;
