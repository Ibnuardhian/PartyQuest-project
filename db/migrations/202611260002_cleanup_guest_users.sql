-- Guest rows leave together with their rooms. When cleanup_expired_rooms() deletes a room, the guests who
-- belonged to it are deleted too unless they still belong to (or host) another room, and guests who never
-- joined any room are swept once they have been idle for an hour. Deleting a guest is safe: a browser that
-- still holds a valid guest cookie gets the same row back from POST /api/guest/session (ensureGuestUser
-- upserts by id), so the only loss is the remembered display name.
--
-- Safety rules:
--  * a guest who is a member (even one who left) or host of a surviving room is never removed, because
--    game_rooms.host_user_id cascades and a surviving room would otherwise disappear with its host;
--  * a guest seen in the last 5 minutes is kept, so a guest who just renewed the session and is about to
--    join or create a room never loses the row mid-request.
create index if not exists room_members_user_idx on public.room_members(user_id);

create or replace function public.cleanup_expired_rooms()
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_rooms integer;
  v_guests integer;
  v_leaving uuid[];
begin
  -- Everyone who belonged to a room that is about to go (now() is fixed for the whole function call).
  select coalesce(array_agg(distinct who.user_id), '{}'::uuid[]) into v_leaving
  from (
    select m.user_id from public.game_rooms r join public.room_members m on m.room_id = r.id
    where r.expires_at <= now() or (r.status in ('finished', 'abandoned') and r.updated_at <= now() - interval '1 hour')
    union
    select r.host_user_id from public.game_rooms r
    where r.expires_at <= now() or (r.status in ('finished', 'abandoned') and r.updated_at <= now() - interval '1 hour')
  ) as who;

  delete from public.game_rooms r
  where r.expires_at <= now()
     or (r.status in ('finished', 'abandoned') and r.updated_at <= now() - interval '1 hour');
  get diagnostics v_rooms = row_count;

  delete from public.guest_users g
  where ((g.id = any (v_leaving) and g.last_seen_at < now() - interval '5 minutes')
         or g.last_seen_at < now() - interval '1 hour')
    and not exists (select 1 from public.room_members m where m.user_id = g.id)
    and not exists (select 1 from public.game_rooms r where r.host_user_id = g.id);
  get diagnostics v_guests = row_count;

  raise notice 'cleanup: % room(s), % guest(s) removed', v_rooms, v_guests;
  return v_rooms;
end;
$$;

revoke all on function public.cleanup_expired_rooms() from public;
