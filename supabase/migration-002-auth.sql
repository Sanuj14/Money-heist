-- =====================================================================
--  MIGRATION 002 — password-only auth, admin gate, room-code-only join
--  Run this in the Supabase SQL Editor AFTER schema.sql.
--  Safe to re-run.
-- =====================================================================

-- optional per-team lock (default off: room code alone is enough)
alter table public.rooms
  add column if not exists require_team_code boolean not null default false;

-- ---------------------------------------------------------------------
-- who is a marshal / admin
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

-- Only admins may create rooms. Existing owners keep read/update/delete
-- on their own rooms even if the flag is later removed.
drop policy if exists rooms_owner_all on public.rooms;
create policy rooms_owner_all on public.rooms
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.is_admin());

-- room lookup now also reports whether a team code is required
create or replace function public.room_public_info(p_room_code text)
returns table (id uuid, code text, name text, tagline text, status text,
               team_count int, clue_count int, require_team_code boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.code, r.name, r.tagline, r.status,
         (select count(*)::int from teams t where t.room_id = r.id),
         (select count(*)::int from clues c where c.room_id = r.id),
         r.require_team_code
    from public.rooms r where upper(r.code) = upper(trim(p_room_code));
$$;

-- ---------------------------------------------------------------------
-- team picker: list the crews in a room, before the player has joined
-- ---------------------------------------------------------------------
create or replace function public.list_room_teams(p_room_code text)
returns table (team_id uuid, name text, colour text, members int, route_length int)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.colour,
         (select count(*)::int from team_members m where m.team_id = t.id),
         coalesce(cardinality(t.route), 0)::int
    from public.teams t
    join public.rooms r on r.id = t.room_id
   where upper(r.code) = upper(trim(p_room_code))
   order by t.created_at;
$$;

-- ---------------------------------------------------------------------
-- join by team id (room code is the only gate unless the room requires
-- a team code as well)
-- ---------------------------------------------------------------------
create or replace function public.join_room_team(
  p_room_code text,
  p_team_id   uuid,
  p_team_code text default null
)
returns table (room_id uuid, room_code text, room_name text, team_id uuid, team_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_team teams%rowtype;
  v_uid  uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;

  select * into v_room from rooms where upper(code) = upper(trim(p_room_code));
  if not found then raise exception 'No room with that code'; end if;
  if v_room.status = 'ended' then raise exception 'This heist has already ended'; end if;

  select * into v_team from teams where id = p_team_id and room_id = v_room.id;
  if not found then raise exception 'That crew is not in this room'; end if;

  if v_room.require_team_code
     and upper(coalesce(trim(p_team_code), '')) <> upper(v_team.join_code) then
    raise exception 'Wrong team code for %', v_team.name;
  end if;

  if exists (select 1 from team_members m
              where m.room_id = v_room.id and m.user_id = v_uid and m.team_id <> v_team.id) then
    raise exception 'You are already locked into another crew in this room';
  end if;

  insert into team_members (team_id, room_id, user_id, email)
  values (v_team.id, v_room.id, v_uid, (select email from auth.users where id = v_uid))
  on conflict (team_id, user_id) do nothing;

  insert into team_progress (team_id, room_id, current_index, step_started_at)
  values (v_team.id, v_room.id, 0, case when v_room.status = 'live' then now() else null end)
  on conflict (team_id) do nothing;

  return query select v_room.id, v_room.code, v_room.name, v_team.id, v_team.name;
end $$;

grant execute on function public.room_public_info(text)                  to anon, authenticated;
grant execute on function public.is_admin()                              to authenticated;
grant execute on function public.list_room_teams(text)                   to anon, authenticated;
grant execute on function public.join_room_team(text, uuid, text)        to authenticated;

-- ---------------------------------------------------------------------
-- MAKE THE MARSHAL AN ADMIN
-- Sign in once through the app with igs@vit.ac.in first so the account
-- exists, then run this (or just re-run the whole file).
-- ---------------------------------------------------------------------
update public.profiles set is_admin = true where lower(email) = 'igs@vit.ac.in';
