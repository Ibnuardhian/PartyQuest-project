-- Follow-ups to 202611250004 (kept separate because that migration may already be applied):
-- 1. Rooms already finished when 0004 ran have members whose lobby_at is later than the round's
--    finished_at, so they counted as "returned" and nobody could open the lobby. Reset them.
-- 2. return_to_lobby counts as activity for a finished room (keeps the 1-hour cleanup away while players
--    arrive) and raises room_not_found for an abandoned room instead of room_in_progress.
update public.room_members m set lobby_at = '-infinity'::timestamptz
from public.game_rooms r where r.id = m.room_id and r.status = 'finished';

create or replace function public.return_to_lobby(p_room_id uuid, p_user_id uuid, p_force boolean default false)
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
  if p_force and v_room.host_user_id <> p_user_id then raise exception 'host_required'; end if;
  update public.room_members m set lobby_at = now() where m.room_id = p_room_id and m.user_id = p_user_id and m.left_at is null;
  if not found then raise exception 'not_a_member'; end if;
  update public.game_rooms set status = status where id = p_room_id;
  perform public.open_lobby_if_ready(p_room_id, p_force);
  perform public.notify_room_changed(p_room_id);
  return (select r.status from public.game_rooms r where r.id = p_room_id);
end;
$$;

revoke all on function public.return_to_lobby(uuid, uuid, boolean) from public;
