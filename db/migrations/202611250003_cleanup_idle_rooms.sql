-- Rooms are removed once they expire (12 hours) or, sooner, when a finished or abandoned room has seen no
-- change for an hour. game_rooms.updated_at moves on status changes and host transfers, so a room whose
-- round just ended is kept for an hour for the rematch. Cascades remove sessions and private state.
create or replace function public.cleanup_expired_rooms()
returns integer
language plpgsql
set search_path = ''
as $$
declare v_deleted integer;
begin
  delete from public.game_rooms r
  where r.expires_at <= now()
     or (r.status in ('finished', 'abandoned') and r.updated_at <= now() - interval '1 hour');
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_rooms() from public;
