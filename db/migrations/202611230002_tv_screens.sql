-- Shared TV screen for a room (docs/04 §7): the host shows a short-lived pairing code, the TV trades it
-- for a random read-only token. Only a SHA-256 hash of the token is stored.

create table public.room_tv_pairings (
  room_id uuid primary key references public.game_rooms(id) on delete cascade,
  pairing_code text not null check (pairing_code ~ '^[0-9]{6}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.room_tv_screens (
  token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index room_tv_screens_room_seen_idx on public.room_tv_screens(room_id, last_seen_at);

-- Trades a valid, unexpired pairing code for a TV token (single use).
create function public.pair_tv_screen(p_room_id uuid, p_pairing_code text, p_token_hash text)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  delete from public.room_tv_pairings p
  where p.room_id = p_room_id and p.pairing_code = p_pairing_code and p.expires_at > now();
  if not found then return false; end if;
  insert into public.room_tv_screens(token_hash, room_id) values (p_token_hash, p_room_id);
  perform public.notify_room_changed(p_room_id);
  return true;
end;
$$;

revoke all on public.room_tv_pairings, public.room_tv_screens from public;
revoke all on function public.pair_tv_screen(uuid, text, text) from public;
