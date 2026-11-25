-- Players who join a finished room (waiting for a rematch) can mark themselves ready, so the host can wait
-- for newcomers instead of dealing a seat to someone who already closed the tab. Shared by every game.
create or replace function public.set_room_ready(p_room_id uuid, p_user_id uuid, p_is_ready boolean)
returns boolean
language plpgsql
set search_path = ''
as $$
declare v_status text;
begin
  select r.status into v_status from public.game_rooms r where r.id = p_room_id for update;
  if v_status not in ('lobby', 'finished') then raise exception 'room_not_in_lobby'; end if;
  update public.room_members m set is_ready = p_is_ready, last_seen_at = now()
  where m.room_id = p_room_id and m.user_id = p_user_id and m.left_at is null;
  if not found then raise exception 'not_a_member'; end if;
  perform public.notify_room_changed(p_room_id);
  return true;
end;
$$;

revoke all on function public.set_room_ready(uuid, uuid, boolean) from public;
