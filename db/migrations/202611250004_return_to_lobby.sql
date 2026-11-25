-- After a round ends the room stays 'finished' until every active member has come back to the lobby
-- (or the host opens it early). Only then does it become 'lobby' again, with settings editable and the
-- normal ready + start flow. Members track their return with lobby_at: a member is back once
-- lobby_at is at or after the latest round's finished_at. Shared by every game.
alter table public.room_members add column lobby_at timestamptz not null default now();
-- Members of rooms that are already finished when this runs have not "returned" yet, so they go through the same flow.
update public.room_members set lobby_at = '-infinity'::timestamptz;

-- Internal: flips a finished room to the lobby when nobody is still on a result screen (or when forced).
create function public.open_lobby_if_ready(p_room_id uuid, p_force boolean)
returns boolean
language plpgsql
set search_path = ''
as $$
declare v_status text; v_finished_at timestamptz;
begin
  select r.status into v_status from public.game_rooms r where r.id = p_room_id;
  if v_status is distinct from 'finished' then return false; end if;
  select max(s.finished_at) into v_finished_at from public.game_sessions s where s.room_id = p_room_id;
  if not p_force and exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.left_at is null and m.lobby_at < coalesce(v_finished_at, '-infinity'::timestamptz)
  ) then return false; end if;
  if not exists (select 1 from public.room_members m where m.room_id = p_room_id and m.left_at is null) then return false; end if;
  update public.game_rooms set status = 'lobby' where id = p_room_id;
  update public.room_members set is_ready = false, lobby_at = now() where room_id = p_room_id and left_at is null;
  return true;
end;
$$;

-- A member says they are back in the lobby; the host can open it early (p_force) without waiting.
create function public.return_to_lobby(p_room_id uuid, p_user_id uuid, p_force boolean default false)
returns text
language plpgsql
set search_path = ''
as $$
declare v_room public.game_rooms;
begin
  select * into v_room from public.game_rooms r where r.id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.status = 'lobby' then return 'lobby'; end if;
  if v_room.status = 'abandoned' then raise exception 'room_not_found'; end if;
  if v_room.status <> 'finished' then raise exception 'room_in_progress'; end if;
  -- Someone coming back is activity: keep the finished room from being cleaned up while players are still arriving.
  update public.game_rooms set status = status where id = p_room_id;
  if p_force and v_room.host_user_id <> p_user_id then raise exception 'host_required'; end if;
  update public.room_members m set lobby_at = now() where m.room_id = p_room_id and m.user_id = p_user_id and m.left_at is null;
  if not found then raise exception 'not_a_member'; end if;
  perform public.open_lobby_if_ready(p_room_id, p_force);
  perform public.notify_room_changed(p_room_id);
  return (select r.status from public.game_rooms r where r.id = p_room_id);
end;
$$;

-- Leaving a finished room can be what lets the rest open the lobby.
create or replace function public.leave_room(p_room_id uuid, p_user_id uuid)
returns text
language plpgsql
set search_path = ''
as $$
declare v_host uuid; v_next_host uuid; v_status text;
begin
  select r.host_user_id, r.status into v_host, v_status from public.game_rooms r where r.id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_status = 'in_progress' then raise exception 'room_in_progress'; end if;
  update public.room_members m set left_at = now(), is_ready = false where m.room_id = p_room_id and m.user_id = p_user_id and m.left_at is null;
  if not found then raise exception 'not_a_member'; end if;
  if v_host = p_user_id then
    select m.user_id into v_next_host from public.room_members m where m.room_id = p_room_id and m.left_at is null order by m.seat_no limit 1;
    if v_next_host is null then update public.game_rooms set status = 'abandoned' where id = p_room_id; else update public.game_rooms set host_user_id = v_next_host where id = p_room_id; end if;
  end if;
  if v_status = 'finished' then perform public.open_lobby_if_ready(p_room_id, false); end if;
  perform public.notify_room_changed(p_room_id);
  return 'ok';
end;
$$;

revoke all on function public.open_lobby_if_ready(uuid, boolean) from public;
revoke all on function public.return_to_lobby(uuid, uuid, boolean) from public;
revoke all on function public.leave_room(uuid, uuid) from public;
