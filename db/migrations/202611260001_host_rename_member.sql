-- The host of a room can rename an active member while the room is in its lobby (or waiting for a rematch),
-- so a guest cannot pass as another player with a lookalike name. The change is room-scoped: the guest's own
-- profile and other rooms are untouched. Names stay unique per room ignoring case and extra spaces. Games opt in
-- through the application layer (OnlineGameServer.hostCanRenameMembers); the host check is enforced here.
create or replace function public.rename_room_member(p_room_id uuid, p_host_id uuid, p_target_id uuid, p_display_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  v_room public.game_rooms;
begin
  if char_length(v_name) not between 1 and 24 then raise exception 'invalid_name'; end if;
  select * into v_room from public.game_rooms r where r.id = p_room_id for update;
  if not found then raise exception 'room_not_found'; end if;
  if v_room.host_user_id <> p_host_id then raise exception 'host_required'; end if;
  if v_room.status not in ('lobby', 'finished') then raise exception 'room_not_in_lobby'; end if;
  if not exists (select 1 from public.room_members m where m.room_id = p_room_id and m.user_id = p_target_id and m.left_at is null) then
    raise exception 'member_not_found';
  end if;
  if exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.left_at is null and m.user_id <> p_target_id
      and lower(btrim(regexp_replace(m.display_name, '\s+', ' ', 'g'))) = lower(v_name)
  ) then
    raise exception 'duplicate_name';
  end if;
  update public.room_members m set display_name = v_name
  where m.room_id = p_room_id and m.user_id = p_target_id and m.left_at is null;
  perform public.notify_room_changed(p_room_id);
  return v_name;
end;
$$;

revoke all on function public.rename_room_member(uuid, uuid, uuid, text) from public;
