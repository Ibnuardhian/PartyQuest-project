-- A room whose round has finished (status 'finished') accepts new players again, so guests can join while
-- the table waits for a rematch, including when the original host has left and the host role moved on.
-- Rooms with a running round still reject joins. Shared by every game, including Werewolf.
create or replace function public.join_room(p_user_id uuid, p_code text, p_display_name text)
returns public.game_rooms
language plpgsql
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
  if v_room.status not in ('lobby', 'finished') then raise exception 'room_not_joinable'; end if;
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
  perform public.notify_room_changed(v_room.id);
  return v_room;
end;
$$;
