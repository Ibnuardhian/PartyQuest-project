create table public.guest_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.game_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references auth.users(id),
  game_key text not null default 'undercover' check (game_key = 'undercover'),
  status text not null default 'lobby' check (status in ('lobby', 'in_progress', 'finished', 'abandoned')),
  max_players integer not null default 12 check (max_players between 3 and 12),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours')
);

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  seat_no integer not null check (seat_no between 1 and 12),
  is_ready boolean not null default false,
  is_alive boolean not null default true,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz,
  left_at timestamptz
);

create unique index room_members_one_active_user on public.room_members(room_id, user_id) where left_at is null;
create unique index room_members_one_active_seat on public.room_members(room_id, seat_no) where left_at is null;
create index room_members_room_active_idx on public.room_members(room_id, left_at, seat_no);

create table public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.game_rooms(id) on delete cascade,
  round_no integer not null check (round_no >= 1),
  status text not null default 'in_progress' check (status in ('in_progress', 'finished')),
  phase text not null default 'reveal',
  state_version bigint not null default 0 check (state_version >= 0),
  public_state jsonb not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (room_id, round_no)
);
create index game_sessions_room_round_idx on public.game_sessions(room_id, round_no desc);

create table public.game_private_state (
  session_id uuid primary key references public.game_sessions(id) on delete cascade,
  private_state jsonb not null,
  updated_at timestamptz not null default now()
);

create table public.player_private_state (
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  private_state jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (session_id, user_id)
);

create index game_rooms_status_expiry_idx on public.game_rooms(status, expires_at);

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger guest_profiles_touch_updated_at before update on public.guest_profiles
for each row execute function public.touch_updated_at();
create trigger game_rooms_touch_updated_at before update on public.game_rooms
for each row execute function public.touch_updated_at();

alter table public.guest_profiles enable row level security;
alter table public.game_rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.game_sessions enable row level security;
alter table public.game_private_state enable row level security;
alter table public.player_private_state enable row level security;

revoke all on public.guest_profiles, public.game_rooms, public.room_members,
  public.game_sessions, public.game_private_state, public.player_private_state
  from anon, authenticated;
grant all on public.guest_profiles, public.game_rooms, public.room_members,
  public.game_sessions, public.game_private_state, public.player_private_state
  to service_role;

create function public.create_room(
  p_host_user_id uuid,
  p_code text,
  p_display_name text,
  p_settings jsonb
)
returns public.game_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.game_rooms;
begin
  if char_length(p_display_name) not between 1 and 24 then raise exception 'invalid_name'; end if;
  if (select count(*) from public.game_rooms r where r.host_user_id = p_host_user_id and r.created_at > now() - interval '1 minute') >= 3 then
    raise exception 'rate_limited';
  end if;
  insert into public.guest_profiles(user_id, display_name)
  values (p_host_user_id, p_display_name)
  on conflict (user_id) do update set display_name = excluded.display_name;
  insert into public.game_rooms(code, host_user_id, settings)
  values (upper(p_code), p_host_user_id, p_settings)
  returning * into v_room;
  insert into public.room_members(room_id, user_id, display_name, seat_no)
  values (v_room.id, p_host_user_id, p_display_name, 1);
  return v_room;
end;
$$;

create function public.join_room(p_user_id uuid, p_code text, p_display_name text)
returns public.game_rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.game_rooms;
  v_count integer;
begin
  if char_length(p_display_name) not between 1 and 24 then raise exception 'invalid_name'; end if;
  if (select count(*) from public.room_members m where m.user_id = p_user_id and m.joined_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  select * into v_room from public.game_rooms r where r.code = upper(p_code) for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.expires_at <= now() then raise exception 'room_expired'; end if;
  if v_room.status <> 'lobby' then raise exception 'room_not_joinable'; end if;
  if exists (select 1 from public.room_members m where m.room_id = v_room.id and m.user_id = p_user_id and m.left_at is null) then
    return v_room;
  end if;
  select count(*) into v_count from public.room_members m where m.room_id = v_room.id and m.left_at is null;
  if v_count >= v_room.max_players then raise exception 'room_full'; end if;
  if exists (select 1 from public.room_members m where m.room_id = v_room.id and m.left_at is null and lower(m.display_name) = lower(p_display_name)) then raise exception 'duplicate_name'; end if;
  insert into public.guest_profiles(user_id, display_name)
  values (p_user_id, p_display_name)
  on conflict (user_id) do update set display_name = excluded.display_name;
  insert into public.room_members(room_id, user_id, display_name, seat_no)
  select v_room.id, p_user_id, p_display_name, seats.seat_no
  from generate_series(1, v_room.max_players) as seats(seat_no)
  where not exists (select 1 from public.room_members m where m.room_id = v_room.id and m.left_at is null and m.seat_no = seats.seat_no)
  order by seats.seat_no limit 1;
  if not found then raise exception 'room_full'; end if;
  return v_room;
end;
$$;

create function public.set_room_ready(p_room_id uuid, p_user_id uuid, p_is_ready boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  select r.status into v_status from public.game_rooms r where r.id = p_room_id;
  if v_status is distinct from 'lobby' then raise exception 'room_not_in_lobby'; end if;
  update public.room_members m set is_ready = p_is_ready, last_seen_at = now()
  where m.room_id = p_room_id and m.user_id = p_user_id and m.left_at is null;
  if not found then raise exception 'not_a_member'; end if;
  return true;
end;
$$;

create function public.start_game(
  p_room_id uuid,
  p_host_user_id uuid,
  p_public_state jsonb,
  p_private_state jsonb,
  p_player_private jsonb
)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.game_rooms;
  v_count integer;
  v_round integer;
  v_session public.game_sessions;
begin
  select * into v_room from public.game_rooms r where r.id = p_room_id for update;
  if not found or v_room.host_user_id <> p_host_user_id then raise exception 'host_required'; end if;
  if v_room.status <> 'lobby' or v_room.expires_at <= now() then raise exception 'room_not_startable'; end if;
  select count(*) into v_count from public.room_members m where m.room_id = p_room_id and m.left_at is null;
  if v_count not between 3 and v_room.max_players then raise exception 'invalid_player_count'; end if;
  if exists (select 1 from public.room_members m where m.room_id = p_room_id and m.left_at is null and not m.is_ready) then raise exception 'players_not_ready'; end if;
  if (select count(distinct lower(m.display_name)) from public.room_members m where m.room_id = p_room_id and m.left_at is null) <> v_count then raise exception 'duplicate_name'; end if;
  if (select count(*) from jsonb_array_elements(p_public_state -> 'players')) <> v_count then raise exception 'invalid_player_state'; end if;
  if exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.left_at is null
      and not exists (select 1 from jsonb_array_elements(p_public_state -> 'players') p where p ->> 'id' = m.user_id::text)
  ) then raise exception 'invalid_player_state'; end if;
  select coalesce(max(s.round_no), 0) + 1 into v_round from public.game_sessions s where s.room_id = p_room_id;
  insert into public.game_sessions(room_id, round_no, phase, public_state)
  values (p_room_id, v_round, p_public_state ->> 'phase', p_public_state)
  returning * into v_session;
  insert into public.game_private_state(session_id, private_state) values (v_session.id, p_private_state);
  insert into public.player_private_state(session_id, user_id, private_state)
  select v_session.id, (p.value ->> 'playerId')::uuid, p.value
  from jsonb_array_elements(p_player_private) p;
  update public.game_rooms set status = 'in_progress', expires_at = now() + interval '12 hours' where id = p_room_id;
  update public.room_members set is_alive = true where room_id = p_room_id and left_at is null;
  return v_session;
end;
$$;

create function public.apply_game_action(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_version bigint,
  p_public_state jsonb
)
returns table(ok boolean, state_version bigint, error_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.game_sessions;
  v_next_version bigint;
begin
  select * into v_session from public.game_sessions s where s.id = p_session_id for update;
  if not found then return query select false, null::bigint, 'session_not_found'; return; end if;
  if v_session.state_version <> p_expected_version then return query select false, v_session.state_version, 'version_conflict'; return; end if;
  if not exists (select 1 from public.room_members m where m.room_id = v_session.room_id and m.user_id = p_user_id and m.left_at is null) then
    return query select false, v_session.state_version, 'not_a_member'; return;
  end if;
  if v_session.status <> 'in_progress' then return query select false, v_session.state_version, 'session_finished'; return; end if;
  v_next_version := v_session.state_version + 1;
  update public.game_sessions s
  set public_state = p_public_state, phase = p_public_state ->> 'phase', state_version = v_next_version,
      status = case when p_public_state ->> 'phase' = 'finished' then 'finished' else 'in_progress' end,
      finished_at = case when p_public_state ->> 'phase' = 'finished' then now() else null end
  where s.id = p_session_id;
  update public.room_members m
  set is_alive = (p.value ->> 'alive')::boolean
  from jsonb_array_elements(p_public_state -> 'players') p
  where m.room_id = v_session.room_id and m.left_at is null and m.user_id = (p.value ->> 'id')::uuid;
  if p_public_state ->> 'phase' = 'finished' then
    update public.game_rooms r set status = 'finished' where r.id = v_session.room_id;
  end if;
  return query select true, v_next_version, null::text;
end;
$$;

create function public.leave_room(p_room_id uuid, p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_host uuid; v_next_host uuid; v_status text;
begin
  select r.host_user_id, r.status into v_host, v_status from public.game_rooms r where r.id = p_room_id for update;
  if v_status = 'in_progress' then raise exception 'room_in_progress'; end if;
  update public.room_members m set left_at = now(), is_ready = false where m.room_id = p_room_id and m.user_id = p_user_id and m.left_at is null;
  if not found then raise exception 'not_a_member'; end if;
  if v_host = p_user_id then
    select m.user_id into v_next_host from public.room_members m where m.room_id = p_room_id and m.left_at is null order by m.seat_no limit 1;
    if v_next_host is null then update public.game_rooms set status = 'abandoned' where id = p_room_id; else update public.game_rooms set host_user_id = v_next_host where id = p_room_id; end if;
  end if;
  return 'ok';
end;
$$;

create function public.rematch_room(p_room_id uuid, p_host_user_id uuid, p_public_state jsonb, p_private_state jsonb, p_player_private jsonb)
returns public.game_sessions
language plpgsql
security definer
set search_path = ''
as $$
declare v_room public.game_rooms; v_count integer; v_round integer; v_session public.game_sessions;
begin
  select * into v_room from public.game_rooms r where r.id = p_room_id for update;
  if not found or v_room.host_user_id <> p_host_user_id then raise exception 'host_required'; end if;
  if v_room.status <> 'finished' or v_room.expires_at <= now() then raise exception 'room_not_rematchable'; end if;
  select count(*) into v_count from public.room_members m where m.room_id = p_room_id and m.left_at is null;
  if v_count not between 3 and v_room.max_players then raise exception 'invalid_player_count'; end if;
  if (select count(*) from jsonb_array_elements(p_public_state -> 'players')) <> v_count then raise exception 'invalid_player_state'; end if;
  if exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.left_at is null
      and not exists (select 1 from jsonb_array_elements(p_public_state -> 'players') p where p ->> 'id' = m.user_id::text)
  ) then raise exception 'invalid_player_state'; end if;
  select coalesce(max(s.round_no), 0) + 1 into v_round from public.game_sessions s where s.room_id = p_room_id;
  insert into public.game_sessions(room_id, round_no, phase, public_state)
  values (p_room_id, v_round, p_public_state ->> 'phase', p_public_state)
  returning * into v_session;
  insert into public.game_private_state(session_id, private_state) values (v_session.id, p_private_state);
  insert into public.player_private_state(session_id, user_id, private_state)
  select v_session.id, (p.value ->> 'playerId')::uuid, p.value from jsonb_array_elements(p_player_private) p;
  update public.game_rooms set status = 'in_progress', expires_at = now() + interval '12 hours' where id = p_room_id;
  update public.room_members set is_alive = true where room_id = p_room_id and left_at is null;
  return v_session;
end;
$$;

create function public.is_active_room_member(p_room_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.room_members m where m.room_id = p_room_id and m.user_id = p_user_id and m.left_at is null);
$$;

create function public.can_access_room_topic(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_topic !~ '^room:[0-9a-fA-F-]{36}$' then return false; end if;
  return public.is_active_room_member(substring(p_topic from 6)::uuid, (select auth.uid()));
exception when invalid_text_representation then
  return false;
end;
$$;

create function public.cleanup_expired_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_deleted integer;
begin
  delete from public.game_rooms r where r.expires_at <= now();
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.create_room(uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.join_room(uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_room_ready(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.start_game(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.apply_game_action(uuid, uuid, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.leave_room(uuid, uuid) from public, anon, authenticated;
revoke all on function public.rematch_room(uuid, uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.is_active_room_member(uuid, uuid) from public, anon;
revoke all on function public.is_active_room_member(uuid, uuid) from authenticated;
revoke all on function public.can_access_room_topic(text) from public, anon;
revoke all on function public.cleanup_expired_rooms() from public, anon, authenticated;
grant execute on function public.create_room(uuid, text, text, jsonb) to service_role;
grant execute on function public.join_room(uuid, text, text) to service_role;
grant execute on function public.set_room_ready(uuid, uuid, boolean) to service_role;
grant execute on function public.start_game(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.apply_game_action(uuid, uuid, bigint, jsonb) to service_role;
grant execute on function public.leave_room(uuid, uuid) to service_role;
grant execute on function public.rematch_room(uuid, uuid, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.can_access_room_topic(text) to authenticated;
grant execute on function public.cleanup_expired_rooms() to service_role;

create policy "Active room members receive room broadcasts"
on realtime.messages for select to authenticated
using (
  public.can_access_room_topic(realtime.topic())
);
