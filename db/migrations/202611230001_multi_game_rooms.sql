-- Multi-game rooms: allow Werewolf, rooms of up to 16 players, host-editable lobby settings, presence.

alter table public.game_rooms drop constraint game_rooms_game_key_check;
alter table public.game_rooms add constraint game_rooms_game_key_check check (game_key in ('undercover', 'werewolf'));
alter table public.game_rooms drop constraint game_rooms_max_players_check;
alter table public.game_rooms add constraint game_rooms_max_players_check check (max_players between 3 and 16);
alter table public.room_members drop constraint room_members_seat_no_check;
alter table public.room_members add constraint room_members_seat_no_check check (seat_no between 1 and 16);
alter table public.game_rooms alter column game_key drop default;

drop function public.create_room(uuid, text, text, jsonb);

create function public.create_room(
  p_host_user_id uuid,
  p_code text,
  p_display_name text,
  p_settings jsonb,
  p_game_key text,
  p_max_players integer
)
returns public.game_rooms
language plpgsql
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
  insert into public.game_rooms(code, host_user_id, game_key, max_players, settings)
  values (upper(p_code), p_host_user_id, p_game_key, p_max_players, p_settings)
  returning * into v_room;
  insert into public.room_members(room_id, user_id, display_name, seat_no, last_seen_at)
  values (v_room.id, p_host_user_id, p_display_name, 1, now());
  return v_room;
end;
$$;

-- Host edits game settings while the room is in the lobby. The game adapter validates the shape;
-- composition against the final player count is validated again when the round starts.
create function public.update_room_settings(p_room_id uuid, p_host_user_id uuid, p_settings jsonb)
returns public.game_rooms
language plpgsql
set search_path = ''
as $$
declare v_room public.game_rooms;
begin
  select * into v_room from public.game_rooms r where r.id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.host_user_id <> p_host_user_id then raise exception 'host_required'; end if;
  if v_room.status <> 'lobby' or v_room.expires_at <= now() then raise exception 'room_not_in_lobby'; end if;
  update public.game_rooms set settings = p_settings where id = p_room_id returning * into v_room;
  update public.room_members m set is_ready = false where m.room_id = p_room_id and m.left_at is null and m.user_id <> p_host_user_id;
  perform public.notify_room_changed(p_room_id);
  return v_room;
end;
$$;

-- Presence heartbeat: called on lobby/view requests; used for AFK eligibility and online dots.
create function public.touch_member(p_room_id uuid, p_user_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.room_members set last_seen_at = now()
  where room_id = p_room_id and user_id = p_user_id and left_at is null
    and (last_seen_at is null or last_seen_at < now() - interval '5 seconds');
$$;

-- Games such as Werewolf change secret state (night picks, hidden votes, roles) on every action,
-- so the version-checked mutation now optionally persists secret state in the same transaction.
drop function public.apply_game_action(uuid, uuid, bigint, jsonb);

create function public.apply_game_action(
  p_session_id uuid,
  p_user_id uuid,
  p_expected_version bigint,
  p_public_state jsonb,
  p_secret_state jsonb default null
)
returns table(ok boolean, state_version bigint, error_code text)
language plpgsql
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
      status = case when p_public_state ->> 'phase' in ('finished', 'GAME_OVER') then 'finished' else 'in_progress' end,
      finished_at = case when p_public_state ->> 'phase' in ('finished', 'GAME_OVER') then now() else null end
  where s.id = p_session_id;
  if p_secret_state is not null then
    update public.game_private_state set private_state = p_secret_state, updated_at = now() where session_id = p_session_id;
  end if;
  update public.room_members m
  set is_alive = (p.value ->> 'alive')::boolean
  from jsonb_array_elements(p_public_state -> 'players') p
  where m.room_id = v_session.room_id and m.left_at is null and m.user_id = (p.value ->> 'id')::uuid;
  if p_public_state ->> 'phase' in ('finished', 'GAME_OVER') then
    update public.game_rooms r set status = 'finished' where r.id = v_session.room_id;
  end if;
  perform public.notify_room_changed(v_session.room_id);
  return query select true, v_next_version, null::text;
end;
$$;

revoke all on function public.apply_game_action(uuid, uuid, bigint, jsonb, jsonb) from public;

create index room_members_room_seen_idx on public.room_members(room_id, last_seen_at) where left_at is null;

revoke all on function public.create_room(uuid, text, text, jsonb, text, integer) from public;
revoke all on function public.update_room_settings(uuid, uuid, jsonb) from public;
revoke all on function public.touch_member(uuid, uuid) from public;
