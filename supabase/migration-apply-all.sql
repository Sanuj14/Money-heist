-- =====================================================================
--  MONEY HEIST — HUNT FOR MONEY
--  APPLY-ALL MIGRATION  (replaces migration-002 and migration-003)
--
--  Run this ONE file in the Supabase SQL Editor after schema.sql.
--  Idempotent: safe to run as many times as you like.
--
--  Covers: password-only auth, marshal/admin gate, room code + team code
--  join flow, and the team-code lookup used by the join screen.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Schema change FIRST — everything below depends on this column
-- ---------------------------------------------------------------------
alter table public.rooms
  add column if not exists require_team_code boolean not null default true;

alter table public.rooms
  alter column require_team_code set default true;

-- existing rooms created before this migration
update public.rooms set require_team_code = true where require_team_code is not true;

-- ---------------------------------------------------------------------
-- 1b. Clue window is 20 minutes (was 10). Applies to existing rooms too;
--     per-clue overrides on the Clues tab still win.
-- ---------------------------------------------------------------------
alter table public.rooms alter column time_limit_sec set default 1200;
update public.rooms set time_limit_sec = 1200 where time_limit_sec = 600;

-- ---------------------------------------------------------------------
-- 2. Who is a marshal
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from profiles p where p.id = auth.uid()), false);
$$;

-- Only marshals may create rooms. Existing owners keep read/update/delete
-- on rooms they already own even if the flag is later removed.
drop policy if exists rooms_owner_all on public.rooms;
create policy rooms_owner_all on public.rooms
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and public.is_admin());

-- ---------------------------------------------------------------------
-- 3. Room lookup — now also reports whether a team code is required.
--    DROP first: CREATE OR REPLACE cannot change a function's OUT params.
-- ---------------------------------------------------------------------
drop function if exists public.room_public_info(text);
create function public.room_public_info(p_room_code text)
returns table (id uuid, code text, name text, tagline text, status text,
               team_count int, clue_count int, require_team_code boolean)
language sql stable security definer set search_path = public as $$
  select r.id, r.code, r.name, r.tagline, r.status,
         (select count(*)::int from teams t where t.room_id = r.id),
         (select count(*)::int from clues c where c.room_id = r.id),
         r.require_team_code
    from public.rooms r
   where upper(r.code) = upper(trim(p_room_code));
$$;

-- ---------------------------------------------------------------------
-- 4. Team code -> crew. Reveals a crew name only to someone who already
--    holds the correct code, so the join screen can confirm "✓ Tokyo".
-- ---------------------------------------------------------------------
drop function if exists public.peek_team(text, text);
create function public.peek_team(p_room_code text, p_team_code text)
returns table (team_id uuid, name text, colour text, members int)
language sql stable security definer set search_path = public as $$
  select t.id, t.name, t.colour,
         (select count(*)::int from team_members m where m.team_id = t.id)
    from public.teams t
    join public.rooms r on r.id = t.room_id
   where upper(r.code)      = upper(trim(p_room_code))
     and upper(t.join_code) = upper(trim(p_team_code))
   limit 1;
$$;

-- ---------------------------------------------------------------------
-- 5. Crew list — only used when a marshal turns the code requirement off
-- ---------------------------------------------------------------------
drop function if exists public.list_room_teams(text);
create function public.list_room_teams(p_room_code text)
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
-- 6. Join a crew
-- ---------------------------------------------------------------------
drop function if exists public.join_room_team(text, uuid, text);
create function public.join_room_team(
  p_room_code text,
  p_team_id   uuid,
  p_team_code text default null
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_room  public.rooms%rowtype;
  v_team  public.teams%rowtype;
  v_uid   uuid := auth.uid();
  v_email text;
begin
  -- Returns jsonb rather than a table on purpose. RETURNS TABLE makes each
  -- output column a plpgsql variable, and a bare `team_id` / `room_id` then
  -- becomes ambiguous everywhere it appears -- including INSERT column lists
  -- and ON CONFLICT targets, which cannot be table-qualified. No OUT columns,
  -- no ambiguity.
  if v_uid is null then raise exception 'Not signed in'; end if;

  select r.* into v_room
    from public.rooms r
   where upper(r.code) = upper(trim(p_room_code));
  if not found then raise exception 'No room with that code'; end if;
  if v_room.status = 'ended' then raise exception 'This heist has already ended'; end if;

  select t.* into v_team
    from public.teams t
   where t.id = p_team_id and t.room_id = v_room.id;
  if not found then raise exception 'That crew is not in this room'; end if;

  if v_room.require_team_code
     and upper(coalesce(trim(p_team_code), '')) <> upper(v_team.join_code) then
    raise exception 'Wrong team code for %', v_team.name;
  end if;

  if exists (
    select 1 from public.team_members m
     where m.room_id = v_room.id and m.user_id = v_uid and m.team_id <> v_team.id
  ) then
    raise exception 'You are already locked into another crew in this room';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  insert into public.team_members (team_id, room_id, user_id, email)
  values (v_team.id, v_room.id, v_uid, v_email)
  on conflict (team_id, user_id) do nothing;

  insert into public.team_progress (team_id, room_id, current_index, step_started_at)
  values (v_team.id, v_room.id, 0,
          case when v_room.status = 'live' then now() else null end)
  on conflict (team_id) do nothing;

  return jsonb_build_object(
    'room_id',   v_room.id,
    'room_code', v_room.code,
    'room_name', v_room.name,
    'team_id',   v_team.id,
    'team_name', v_team.name
  );
end $$;

-- The original join_game() from schema.sql carries the same ambiguity and is
-- no longer used by the app. Drop it so it can't be called by mistake.
drop function if exists public.join_game(text, text);

-- ---------------------------------------------------------------------
-- 6b. Timeout resolution, lifted out of get_my_clue().
--
--     get_my_clue() returns a table, so `step_index` and `clue_id` are
--     plpgsql variables in its body -- and both appear in an INSERT column
--     list and an ON CONFLICT target, which cannot be qualified. Moving that
--     work into a function with no OUT columns removes the ambiguity, and
--     submit_scan() can call it directly instead of the heavier query.
-- ---------------------------------------------------------------------
create or replace function public.resolve_team_timeouts(p_team_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team  public.teams%rowtype;
  v_room  public.rooms%rowtype;
  v_tp    public.team_progress%rowtype;
  v_clue  public.clues%rowtype;
  v_limit int;
  v_elapsed int;
  v_guard int := 0;
begin
  select t.* into v_team from public.teams t where t.id = p_team_id;
  if not found then return; end if;

  select r.* into v_room from public.rooms r where r.id = v_team.room_id;
  select tp.* into v_tp from public.team_progress tp where tp.team_id = p_team_id;
  if not found then
    insert into public.team_progress (team_id, room_id, current_index, step_started_at)
    values (p_team_id, v_team.room_id, 0,
            case when v_room.status = 'live' then now() else null end)
    returning * into v_tp;
  end if;

  -- start the clock the moment the room goes live
  if v_room.status = 'live' and v_tp.step_started_at is null and v_tp.finished_at is null then
    update public.team_progress tp
       set step_started_at = now(), updated_at = now()
     where tp.team_id = p_team_id
    returning tp.* into v_tp;
  end if;

  -- roll forward through any windows that lapsed while nobody was looking
  while v_guard < 100 loop
    v_guard := v_guard + 1;
    exit when v_tp.finished_at is not null or v_tp.step_started_at is null;
    exit when v_tp.current_index >= coalesce(cardinality(v_team.route), 0);

    select c.* into v_clue from public.clues c
     where c.id = v_team.route[v_tp.current_index + 1];
    exit when not found;

    v_limit   := coalesce(v_clue.time_limit_sec, v_room.time_limit_sec);
    v_elapsed := extract(epoch from (now() - v_tp.step_started_at))::int;
    exit when v_elapsed < v_limit;

    insert into public.step_results
      (room_id, team_id, clue_id, step_index, status, elapsed_sec, points)
    values
      (v_team.room_id, p_team_id, v_clue.id, v_tp.current_index, 'timeout',
       v_limit, v_room.timeout_points)
    on conflict (team_id, step_index) do nothing;

    update public.team_progress tp
       set current_index   = tp.current_index + 1,
           step_started_at = now(),
           finished_at     = case
                               when tp.current_index + 1 >= coalesce(cardinality(v_team.route), 0)
                               then now() else null
                             end,
           updated_at      = now()
     where tp.team_id = p_team_id
    returning tp.* into v_tp;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 6c. get_my_clue(), with the timeout loop delegated away
-- ---------------------------------------------------------------------
drop function if exists public.get_my_clue(uuid);
create function public.get_my_clue(p_team_id uuid)
returns table (
  step_index int, total_steps int, clue_id uuid, title text, body text, hint text,
  deadline timestamptz, time_limit_sec int, points_now int, max_points int,
  floor_pct int, finished boolean, room_status text, last_result jsonb
) language plpgsql security definer set search_path = public as $$
declare
  v_team  public.teams%rowtype;
  v_room  public.rooms%rowtype;
  v_tp    public.team_progress%rowtype;
  v_clue  public.clues%rowtype;
  v_limit int; v_base int; v_elapsed int;
  v_last  jsonb;
  v_total int;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;

  select t.* into v_team from public.teams t where t.id = p_team_id;
  if not found then raise exception 'Unknown team'; end if;

  if not exists (
    select 1 from public.team_members m
     where m.team_id = p_team_id and m.user_id = auth.uid()
  ) and not public.is_room_owner(v_team.room_id) then
    raise exception 'You are not on this team';
  end if;

  perform public.resolve_team_timeouts(p_team_id);

  select r.* into v_room from public.rooms r where r.id = v_team.room_id;
  select tp.* into v_tp from public.team_progress tp where tp.team_id = p_team_id;
  v_total := coalesce(cardinality(v_team.route), 0);

  select to_jsonb(x) into v_last from (
    select s.status, s.points, s.elapsed_sec, s.step_index
      from public.step_results s
     where s.team_id = p_team_id
     order by s.step_index desc limit 1
  ) x;

  if v_tp.finished_at is not null or v_tp.current_index >= v_total then
    return query select
      v_tp.current_index, v_total, null::uuid, null::text, null::text, null::text,
      null::timestamptz, 0, 0, 0, v_room.floor_pct, true, v_room.status, v_last;
    return;
  end if;

  select c.* into v_clue from public.clues c
   where c.id = v_team.route[v_tp.current_index + 1];

  v_limit := coalesce(v_clue.time_limit_sec, v_room.time_limit_sec);
  v_base  := coalesce(v_clue.points, v_room.base_points);
  v_elapsed := case when v_tp.step_started_at is null then 0
                    else extract(epoch from (now() - v_tp.step_started_at))::int end;

  return query select
    v_tp.current_index,
    v_total,
    v_clue.id,
    v_clue.title,
    v_clue.body,
    case when v_tp.step_started_at is not null and v_elapsed > v_limit / 2
         then v_clue.hint else null end,
    v_tp.step_started_at + make_interval(secs => v_limit),
    v_limit,
    public.compute_points(v_base, v_room.floor_pct, v_elapsed, v_limit, v_room.timeout_points),
    v_base,
    v_room.floor_pct,
    false,
    v_room.status,
    v_last;
end $$;

-- ---------------------------------------------------------------------
-- 7. Grants
-- ---------------------------------------------------------------------
grant execute on function public.room_public_info(text)           to anon, authenticated;
grant execute on function public.peek_team(text, text)            to anon, authenticated;
grant execute on function public.list_room_teams(text)            to anon, authenticated;
grant execute on function public.is_admin()                       to authenticated;
grant execute on function public.join_room_team(text, uuid, text) to authenticated;
grant execute on function public.get_my_clue(uuid)                to authenticated;
grant execute on function public.resolve_team_timeouts(uuid)      to authenticated;

-- ---------------------------------------------------------------------
-- 8. Make the marshal an admin.
--    The account must exist first — create it under
--    Authentication -> Users -> Add user (tick "Auto Confirm User").
-- ---------------------------------------------------------------------
update public.profiles set is_admin = true where lower(email) = 'igs@vit.ac.in';

-- ---------------------------------------------------------------------
-- 9. Verify — should return all seven function names
-- ---------------------------------------------------------------------
select proname as installed_function
  from pg_proc
 where pronamespace = 'public'::regnamespace
   and proname in ('is_admin','list_room_teams','join_room_team','peek_team',
                   'room_public_info','resolve_team_timeouts','get_my_clue')
 order by 1;
