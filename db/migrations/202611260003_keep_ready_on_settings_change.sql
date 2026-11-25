-- Changing the room settings no longer un-readies everyone. Players who were ready stay ready when the host
-- adjusts the configuration (Undercover and Werewolf); the host's own start still validates the final
-- composition against the real player count (start_game / the game adapter), so nothing unsafe can start.
create or replace function public.update_room_settings(p_room_id uuid, p_host_user_id uuid, p_settings jsonb)
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
  perform public.notify_room_changed(p_room_id);
  return v_room;
end;
$$;

revoke all on function public.update_room_settings(uuid, uuid, jsonb) from public;
