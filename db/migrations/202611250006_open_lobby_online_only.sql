-- A finished room waits only for members who are still online (seen within 30 s, the same window the lobby
-- uses for presence). Players who closed their tab cannot come back to the lobby, so they must not keep it
-- locked; if they return later they simply land in the open lobby.
create or replace function public.open_lobby_if_ready(p_room_id uuid, p_force boolean)
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
    where m.room_id = p_room_id and m.left_at is null
      and m.lobby_at < coalesce(v_finished_at, '-infinity'::timestamptz)
      and coalesce(m.last_seen_at > now() - interval '30 seconds', false)
  ) then return false; end if;
  if not exists (select 1 from public.room_members m where m.room_id = p_room_id and m.left_at is null) then return false; end if;
  update public.game_rooms set status = 'lobby' where id = p_room_id;
  update public.room_members set is_ready = false, lobby_at = now() where room_id = p_room_id and left_at is null;
  return true;
end;
$$;

revoke all on function public.open_lobby_if_ready(uuid, boolean) from public;
