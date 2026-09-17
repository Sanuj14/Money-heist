-- =====================================================================
--  MIGRATION 004 — live player location, visible to MARSHALS ONLY
--
--  Run this in the Supabase SQL Editor after migration-apply-all.sql.
--  Idempotent: safe to run as many times as you like.
--
--  Privacy model: players can WRITE their own position (through an RPC)
--  but have NO read policy on this table at all. There is no way for one
--  crew to see another crew's location, and no way for a player to read
--  even their own history. Only the room's owner can select from it.
-- =====================================================================

create table if not exists public.player_pings (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.rooms(id)   on delete cascade,
  team_id    uuid not null references public.teams(id)   on delete cascade,
  user_id    uuid not null references auth.users(id)     on delete cascade,
  lat        double precision not null,
  lng        double precision not null,
  accuracy_m double precision,
  source     text not null default 'ping' check (source in ('ping','scan')),
  created_at timestamptz not null default now()
);

create index if not exists player_pings_room_idx on public.player_pings(room_id, created_at desc);
create index if not exists player_pings_user_idx on public.player_pings(user_id, created_at desc);

alter table public.player_pings enable row level security;

-- Marshal-only read. Deliberately the ONLY policy on this table:
-- every other role, including the player who wrote the row, is denied.
drop policy if exists pings_owner_read on public.player_pings;
create policy pings_owner_read on public.player_pings
  for select using (public.is_room_owner(room_id));

drop policy if exists pings_owner_delete on public.player_pings;
create policy pings_owner_delete on public.player_pings
  for delete using (public.is_room_owner(room_id));

-- ---------------------------------------------------------------------
-- Player writes a position. Returns jsonb (no OUT columns -> no plpgsql
-- name ambiguity). Throttled server-side so a runaway client can't spam.
-- ---------------------------------------------------------------------
drop function if exists public.record_ping(uuid, double precision, double precision, double precision, text);
create function public.record_ping(
  p_team_id   uuid,
  p_lat       double precision,
  p_lng       double precision,
  p_accuracy  double precision default null,
  p_source    text default 'ping'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
  v_uid  uuid := auth.uid();
  v_last timestamptz;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  if p_lat is null or p_lng is null then return jsonb_build_object('ok', false, 'reason', 'no_fix'); end if;
  if p_lat < -90 or p_lat > 90 or p_lng < -180 or p_lng > 180 then
    return jsonb_build_object('ok', false, 'reason', 'out_of_range');
  end if;

  select m.room_id into v_room
    from public.team_members m
   where m.team_id = p_team_id and m.user_id = v_uid;
  if v_room is null then raise exception 'You are not on this team'; end if;

  -- a scan ping always records; routine pings are capped at one per 15s
  if coalesce(p_source, 'ping') <> 'scan' then
    select max(pp.created_at) into v_last
      from public.player_pings pp
     where pp.user_id = v_uid and pp.team_id = p_team_id;
    if v_last is not null and v_last > now() - interval '15 seconds' then
      return jsonb_build_object('ok', true, 'skipped', true);
    end if;
  end if;

  insert into public.player_pings (room_id, team_id, user_id, lat, lng, accuracy_m, source)
  values (v_room, p_team_id, v_uid, p_lat, p_lng, p_accuracy,
          case when p_source = 'scan' then 'scan' else 'ping' end);

  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------
-- Marshal view: the most recent position per player, with crew context.
-- ---------------------------------------------------------------------
drop function if exists public.admin_room_locations(uuid);
create function public.admin_room_locations(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_room_owner(p_room_id) then raise exception 'Admins only'; end if;

  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb)
    into v_out
  from (
    select distinct on (p.user_id)
           p.user_id,
           p.team_id,
           t.name   as team_name,
           t.colour as team_colour,
           m.email  as player_email,
           p.lat, p.lng, p.accuracy_m, p.source, p.created_at
      from public.player_pings p
      join public.teams t on t.id = p.team_id
      left join public.team_members m on m.team_id = p.team_id and m.user_id = p.user_id
     where p.room_id = p_room_id
     order by p.user_id, p.created_at desc
  ) x;

  return v_out;
end $$;

-- ---------------------------------------------------------------------
-- Marshal can wipe the location history for a room (post-event cleanup)
-- ---------------------------------------------------------------------
drop function if exists public.clear_room_locations(uuid);
create function public.clear_room_locations(p_room_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  if not public.is_room_owner(p_room_id) then raise exception 'Admins only'; end if;
  delete from public.player_pings p where p.room_id = p_room_id;
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'deleted', v_n);
end $$;

grant execute on function public.record_ping(uuid, double precision, double precision, double precision, text) to authenticated;
grant execute on function public.admin_room_locations(uuid)   to authenticated;
grant execute on function public.clear_room_locations(uuid)   to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.player_pings;
exception when duplicate_object then null;
end $$;
