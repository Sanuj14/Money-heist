-- =====================================================================
--  MONEY HEIST — "HUNT FOR MONEY" ROUND
--  Supabase / Postgres schema, RLS and game RPCs
--  Run this whole file once in the Supabase SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- helper: short human-friendly codes (no 0/O/1/I/S/5 confusion)
-- ---------------------------------------------------------------------
create or replace function public.gen_code(len int default 6)
returns text language plpgsql as $$
declare
  alphabet text := 'ABCDEFGHJKMNPQRTUVWXYZ2346789';
  out text := '';
  i int;
begin
  for i in 1..len loop
    out := out || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return out;
end $$;

-- =====================================================================
--  TABLES
-- =====================================================================

-- profiles ------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  display_name text,
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(coalesce(new.email,''), '@', 1))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- rooms ---------------------------------------------------------------
create table if not exists public.rooms (
  id                 uuid primary key default gen_random_uuid(),
  code               text unique not null default public.gen_code(6),
  name               text not null,
  tagline            text,
  owner_id           uuid not null references auth.users(id) on delete cascade,
  status             text not null default 'draft'
                     check (status in ('draft','live','paused','ended')),
  -- scoring configuration (linear decay)
  time_limit_sec     int  not null default 1200,  -- 20 minutes per clue
  base_points        int  not null default 1000,  -- points for an instant scan
  floor_pct          int  not null default 25,    -- % of base still earned at the buzzer
  timeout_points     int  not null default 0,     -- points when the 10 min lapse
  auto_advance       boolean not null default true,
  created_at         timestamptz not null default now(),
  started_at         timestamptz,
  ended_at           timestamptz
);
create index if not exists rooms_owner_idx on public.rooms(owner_id);

-- clues ---------------------------------------------------------------
-- A clue's qr_token is the code physically posted at the place the clue
-- describes. Scanning clue N's token completes step N and reveals N+1.
create table if not exists public.clues (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.rooms(id) on delete cascade,
  order_index    int  not null default 0,
  title          text not null default 'Untitled clue',
  body           text not null default '',
  location_label text,                      -- admin-only note: where the QR is taped
  hint           text,                      -- optional, shown at 50% time elapsed
  qr_token       text not null unique default ('MHH-' || public.gen_code(10)),
  points         int,                       -- null = use room.base_points
  time_limit_sec int,                       -- null = use room.time_limit_sec
  created_at     timestamptz not null default now()
);
create index if not exists clues_room_idx on public.clues(room_id, order_index);

-- teams ---------------------------------------------------------------
create table if not exists public.teams (
  id           uuid primary key default gen_random_uuid(),
  room_id      uuid not null references public.rooms(id) on delete cascade,
  name         text not null,
  join_code    text not null default public.gen_code(6),
  colour       text default '#E63329',
  route        uuid[] not null default '{}',  -- ordered clue ids for THIS team
  bonus_points int not null default 0,        -- manual admin adjustments
  created_at   timestamptz not null default now(),
  unique (room_id, join_code)
);
create index if not exists teams_room_idx on public.teams(room_id);

-- team members --------------------------------------------------------
create table if not exists public.team_members (
  id        uuid primary key default gen_random_uuid(),
  team_id   uuid not null references public.teams(id) on delete cascade,
  room_id   uuid not null references public.rooms(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  email     text,
  joined_at timestamptz not null default now(),
  unique (team_id, user_id)
);
create index if not exists team_members_user_idx on public.team_members(user_id);

-- live progress (one row per team) ------------------------------------
create table if not exists public.team_progress (
  team_id         uuid primary key references public.teams(id) on delete cascade,
  room_id         uuid not null references public.rooms(id) on delete cascade,
  current_index   int  not null default 0,
  step_started_at timestamptz,
  finished_at     timestamptz,
  updated_at      timestamptz not null default now()
);

-- one row per completed step ------------------------------------------
create table if not exists public.step_results (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  team_id     uuid not null references public.teams(id) on delete cascade,
  clue_id     uuid references public.clues(id) on delete set null,
  step_index  int  not null,
  status      text not null check (status in ('solved','timeout')),
  elapsed_sec int  not null default 0,
  points      int  not null default 0,
  scanned_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (team_id, step_index)
);
create index if not exists step_results_room_idx on public.step_results(room_id);

-- in-game challenges ---------------------------------------------------
create table if not exists public.challenges (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  title       text not null,
  description text not null default '',
  points      int  not null default 250,
  target      text not null default 'all' check (target in ('all','team')),
  team_id     uuid references public.teams(id) on delete cascade,
  status      text not null default 'open' check (status in ('open','closed')),
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists challenges_room_idx on public.challenges(room_id, status);

create table if not exists public.challenge_awards (
  id           uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  room_id      uuid not null references public.rooms(id) on delete cascade,
  team_id      uuid not null references public.teams(id) on delete cascade,
  points       int  not null default 0,
  created_at   timestamptz not null default now(),
  unique (challenge_id, team_id)
);

-- =====================================================================
--  SCORING
--  Linear decay: full base at t=0 falling to floor_pct% at the buzzer.
-- =====================================================================
create or replace function public.compute_points(
  p_base int, p_floor_pct int, p_elapsed int, p_limit int, p_timeout_points int
) returns int language plpgsql immutable as $$
declare
  ratio numeric;
  floorv numeric;
begin
  if p_limit <= 0 then return p_base; end if;
  if p_elapsed >= p_limit then return p_timeout_points; end if;
  floorv := p_base * (p_floor_pct::numeric / 100.0);
  ratio  := 1.0 - (greatest(p_elapsed, 0)::numeric / p_limit::numeric);
  return round(floorv + (p_base - floorv) * ratio)::int;
end $$;

-- =====================================================================
--  HELPERS
-- =====================================================================
create or replace function public.is_room_owner(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from rooms r where r.id = p_room and r.owner_id = auth.uid());
$$;

create or replace function public.is_room_member(p_room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from team_members m where m.room_id = p_room and m.user_id = auth.uid());
$$;

create or replace function public.my_team_in_room(p_room uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select m.team_id from team_members m
   where m.room_id = p_room and m.user_id = auth.uid() limit 1;
$$;

-- =====================================================================
--  LEADERBOARD
-- =====================================================================
create or replace view public.team_scores as
select
  t.id                as team_id,
  t.room_id,
  t.name,
  t.colour,
  coalesce(sr.step_points, 0)                     as step_points,
  coalesce(ca.bonus, 0) + t.bonus_points          as bonus_points,
  coalesce(sr.step_points, 0) + coalesce(ca.bonus, 0) + t.bonus_points as total_points,
  coalesce(sr.solved, 0)                          as solved_count,
  coalesce(sr.total_sec, 0)                       as total_sec,
  coalesce(tp.current_index, 0)                   as current_index,
  tp.finished_at,
  cardinality(t.route)                            as route_length
from public.teams t
left join public.team_progress tp on tp.team_id = t.id
left join lateral (
  select sum(points) as step_points,
         count(*) filter (where status = 'solved') as solved,
         sum(elapsed_sec) as total_sec
    from public.step_results s where s.team_id = t.id
) sr on true
left join lateral (
  select sum(points) as bonus from public.challenge_awards a where a.team_id = t.id
) ca on true;

-- Public (anon-safe) leaderboard for the big-screen display
create or replace function public.public_leaderboard(p_room_code text)
returns table (
  team_id uuid, name text, colour text, total_points int,
  solved_count int, current_index int, route_length int,
  total_sec int, finished_at timestamptz, rank int
) language sql stable security definer set search_path = public as $$
  select s.team_id, s.name, s.colour, s.total_points::int, s.solved_count::int,
         s.current_index::int, coalesce(s.route_length,0)::int, s.total_sec::int,
         s.finished_at,
         rank() over (order by s.total_points desc, s.total_sec asc, s.name asc)::int
    from public.team_scores s
    join public.rooms r on r.id = s.room_id
   where upper(r.code) = upper(p_room_code)
   order by 10, 4 desc;
$$;

create or replace function public.room_public_info(p_room_code text)
returns table (id uuid, code text, name text, tagline text, status text,
               team_count int, clue_count int)
language sql stable security definer set search_path = public as $$
  select r.id, r.code, r.name, r.tagline, r.status,
         (select count(*)::int from teams t where t.room_id = r.id),
         (select count(*)::int from clues c where c.room_id = r.id)
    from public.rooms r where upper(r.code) = upper(p_room_code);
$$;

-- =====================================================================
--  GAME RPCs (security definer — clue tokens never leave the server)
-- =====================================================================

-- Join a room + team with the two codes ------------------------------
create or replace function public.join_game(p_room_code text, p_team_code text)
returns table (room_id uuid, room_code text, room_name text, team_id uuid, team_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_room rooms%rowtype;
  v_team teams%rowtype;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Not signed in'; end if;

  select * into v_room from rooms where upper(code) = upper(trim(p_room_code));
  if not found then raise exception 'No room with that code'; end if;
  if v_room.status = 'ended' then raise exception 'This heist has already ended'; end if;

  select * into v_team from teams
   where room_id = v_room.id and upper(join_code) = upper(trim(p_team_code));
  if not found then raise exception 'That team code is not valid for this room'; end if;

  -- one user belongs to one team per room
  if exists (select 1 from team_members m
              where m.room_id = v_room.id and m.user_id = v_uid and m.team_id <> v_team.id) then
    raise exception 'You are already locked into another team in this room';
  end if;

  insert into team_members (team_id, room_id, user_id, email)
  values (v_team.id, v_room.id, v_uid, (select email from auth.users where id = v_uid))
  on conflict (team_id, user_id) do nothing;

  insert into team_progress (team_id, room_id, current_index, step_started_at)
  values (v_team.id, v_room.id, 0, case when v_room.status = 'live' then now() else null end)
  on conflict (team_id) do nothing;

  return query select v_room.id, v_room.code, v_room.name, v_team.id, v_team.name;
end $$;

-- Current clue for my team (auto-resolves expired steps) --------------
create or replace function public.get_my_clue(p_team_id uuid)
returns table (
  step_index int, total_steps int, clue_id uuid, title text, body text, hint text,
  deadline timestamptz, time_limit_sec int, points_now int, max_points int,
  floor_pct int, finished boolean, room_status text, last_result jsonb
) language plpgsql security definer set search_path = public as $$
declare
  v_team teams%rowtype;
  v_room rooms%rowtype;
  v_tp   team_progress%rowtype;
  v_clue clues%rowtype;
  v_limit int; v_base int; v_elapsed int; v_guard int := 0;
  v_last jsonb;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into v_team from teams where id = p_team_id;
  if not found then raise exception 'Unknown team'; end if;
  if not exists (select 1 from team_members m where m.team_id = p_team_id and m.user_id = auth.uid())
     and not public.is_room_owner(v_team.room_id) then
    raise exception 'You are not on this team';
  end if;

  select * into v_room from rooms where id = v_team.room_id;
  select * into v_tp from team_progress where team_id = p_team_id;
  if not found then
    insert into team_progress (team_id, room_id, current_index, step_started_at)
    values (p_team_id, v_team.room_id, 0, case when v_room.status='live' then now() else null end)
    returning * into v_tp;
  end if;

  -- start the clock the moment the room goes live
  if v_room.status = 'live' and v_tp.step_started_at is null and v_tp.finished_at is null then
    update team_progress set step_started_at = now(), updated_at = now()
     where team_id = p_team_id returning * into v_tp;
  end if;

  -- roll forward through any steps whose window lapsed while nobody looked
  while v_guard < 100 loop
    v_guard := v_guard + 1;
    exit when v_tp.finished_at is not null or v_tp.step_started_at is null;
    exit when v_tp.current_index >= cardinality(v_team.route);

    select * into v_clue from clues where id = v_team.route[v_tp.current_index + 1];
    v_limit := coalesce(v_clue.time_limit_sec, v_room.time_limit_sec);
    v_elapsed := extract(epoch from (now() - v_tp.step_started_at))::int;
    exit when v_elapsed < v_limit;

    insert into step_results (room_id, team_id, clue_id, step_index, status, elapsed_sec, points)
    values (v_team.room_id, p_team_id, v_clue.id, v_tp.current_index, 'timeout', v_limit,
            v_room.timeout_points)
    on conflict (team_id, step_index) do nothing;

    update team_progress
       set current_index = current_index + 1,
           step_started_at = now(),
           finished_at = case when current_index + 1 >= cardinality(v_team.route)
                              then now() else null end,
           updated_at = now()
     where team_id = p_team_id
    returning * into v_tp;
  end loop;

  select to_jsonb(x) into v_last from (
    select s.status, s.points, s.elapsed_sec, s.step_index
      from step_results s where s.team_id = p_team_id
     order by s.step_index desc limit 1
  ) x;

  if v_tp.finished_at is not null or v_tp.current_index >= cardinality(v_team.route) then
    return query select v_tp.current_index, cardinality(v_team.route), null::uuid,
                        null::text, null::text, null::text, null::timestamptz,
                        0, 0, 0, v_room.floor_pct, true, v_room.status, v_last;
    return;
  end if;

  select * into v_clue from clues where id = v_team.route[v_tp.current_index + 1];
  v_limit := coalesce(v_clue.time_limit_sec, v_room.time_limit_sec);
  v_base  := coalesce(v_clue.points, v_room.base_points);
  v_elapsed := case when v_tp.step_started_at is null then 0
                    else extract(epoch from (now() - v_tp.step_started_at))::int end;

  return query select
    v_tp.current_index,
    cardinality(v_team.route),
    v_clue.id, v_clue.title, v_clue.body,
    case when v_tp.step_started_at is not null
          and v_elapsed > v_limit / 2 then v_clue.hint else null end,
    v_tp.step_started_at + make_interval(secs => v_limit),
    v_limit,
    public.compute_points(v_base, v_room.floor_pct, v_elapsed, v_limit, v_room.timeout_points),
    v_base,
    v_room.floor_pct,
    false,
    v_room.status,
    v_last;
end $$;

-- Submit a scanned QR token -------------------------------------------
create or replace function public.submit_scan(p_team_id uuid, p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_team teams%rowtype; v_room rooms%rowtype; v_tp team_progress%rowtype;
  v_clue clues%rowtype; v_scanned clues%rowtype;
  v_limit int; v_base int; v_elapsed int; v_points int;
  v_token text := upper(trim(coalesce(p_token,'')));
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into v_team from teams where id = p_team_id;
  if not found then raise exception 'Unknown team'; end if;
  if not exists (select 1 from team_members m where m.team_id = p_team_id and m.user_id = auth.uid()) then
    raise exception 'You are not on this team';
  end if;

  select * into v_room from rooms where id = v_team.room_id;
  if v_room.status <> 'live' then
    return jsonb_build_object('ok', false, 'reason', 'not_live',
      'message', 'The heist is not running right now.');
  end if;

  -- resolve any lapsed steps first
  perform public.get_my_clue(p_team_id);
  select * into v_tp from team_progress where team_id = p_team_id;

  if v_tp.finished_at is not null or v_tp.current_index >= cardinality(v_team.route) then
    return jsonb_build_object('ok', false, 'reason', 'finished',
      'message', 'Your team has already cleared every clue.');
  end if;

  select * into v_clue from clues where id = v_team.route[v_tp.current_index + 1];
  select * into v_scanned from clues where upper(qr_token) = v_token and room_id = v_room.id;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'unknown',
      'message', 'That code is not part of this heist.');
  end if;

  if v_scanned.id <> v_clue.id then
    return jsonb_build_object('ok', false, 'reason', 'wrong',
      'message', 'Wrong drop point. This QR belongs somewhere else in the route.');
  end if;

  v_limit := coalesce(v_clue.time_limit_sec, v_room.time_limit_sec);
  v_base  := coalesce(v_clue.points, v_room.base_points);
  v_elapsed := greatest(0, extract(epoch from (now() - coalesce(v_tp.step_started_at, now())))::int);
  v_points := public.compute_points(v_base, v_room.floor_pct, v_elapsed, v_limit, v_room.timeout_points);

  insert into step_results (room_id, team_id, clue_id, step_index, status, elapsed_sec, points, scanned_by)
  values (v_room.id, p_team_id, v_clue.id, v_tp.current_index, 'solved', v_elapsed, v_points, auth.uid())
  on conflict (team_id, step_index) do nothing;

  update team_progress
     set current_index = current_index + 1,
         step_started_at = now(),
         finished_at = case when current_index + 1 >= cardinality(v_team.route)
                            then now() else null end,
         updated_at = now()
   where team_id = p_team_id returning * into v_tp;

  return jsonb_build_object(
    'ok', true, 'points', v_points, 'elapsed_sec', v_elapsed,
    'max_points', v_base, 'step_index', v_tp.current_index - 1,
    'finished', v_tp.finished_at is not null,
    'message', 'Vault cracked. ' || v_points || ' credits banked.');
end $$;

-- Claim / award an in-game challenge ----------------------------------
create or replace function public.award_challenge(p_challenge_id uuid, p_team_id uuid, p_points int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_ch challenges%rowtype;
begin
  select * into v_ch from challenges where id = p_challenge_id;
  if not found then raise exception 'Unknown challenge'; end if;
  if not public.is_room_owner(v_ch.room_id) then raise exception 'Admins only'; end if;
  if v_ch.target = 'team' and v_ch.team_id is distinct from p_team_id then
    raise exception 'That challenge was not floated to this team';
  end if;

  insert into challenge_awards (challenge_id, room_id, team_id, points)
  values (p_challenge_id, v_ch.room_id, p_team_id, coalesce(p_points, v_ch.points))
  on conflict (challenge_id, team_id)
    do update set points = excluded.points;

  return jsonb_build_object('ok', true);
end $$;

-- Start / pause / end a room ------------------------------------------
create or replace function public.set_room_status(p_room_id uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_room_owner(p_room_id) then raise exception 'Admins only'; end if;
  if p_status not in ('draft','live','paused','ended') then raise exception 'Bad status'; end if;

  update rooms set status = p_status,
         started_at = case when p_status='live' and started_at is null then now() else started_at end,
         ended_at   = case when p_status='ended' then now() else null end
   where id = p_room_id;

  if p_status = 'live' then
    -- everyone's clock starts now
    insert into team_progress (team_id, room_id, current_index, step_started_at)
    select t.id, t.room_id, 0, now() from teams t where t.room_id = p_room_id
    on conflict (team_id) do nothing;

    update team_progress set step_started_at = now(), updated_at = now()
     where room_id = p_room_id and step_started_at is null and finished_at is null;
  end if;

  return jsonb_build_object('ok', true, 'status', p_status);
end $$;

-- Reset a team's run ---------------------------------------------------
create or replace function public.reset_team(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_room uuid;
begin
  select room_id into v_room from teams where id = p_team_id;
  if not public.is_room_owner(v_room) then raise exception 'Admins only'; end if;
  delete from step_results where team_id = p_team_id;
  delete from challenge_awards where team_id = p_team_id;
  update teams set bonus_points = 0 where id = p_team_id;
  update team_progress set current_index = 0, step_started_at = null,
         finished_at = null, updated_at = now() where team_id = p_team_id;
  return jsonb_build_object('ok', true);
end $$;

-- Admin view of every team's live state --------------------------------
create or replace function public.admin_room_state(p_room_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  if not public.is_room_owner(p_room_id) then raise exception 'Admins only'; end if;
  select jsonb_agg(x order by x->>'total_points' desc) into v_out from (
    select jsonb_build_object(
      'team_id', t.id, 'name', t.name, 'join_code', t.join_code, 'colour', t.colour,
      'total_points', coalesce(s.total_points,0), 'solved', coalesce(s.solved_count,0),
      'current_index', coalesce(tp.current_index,0), 'route_length', cardinality(t.route),
      'step_started_at', tp.step_started_at, 'finished_at', tp.finished_at,
      'members', (select count(*) from team_members m where m.team_id = t.id),
      'bonus', coalesce(s.bonus_points,0)
    ) as x
    from teams t
    left join team_scores s on s.team_id = t.id
    left join team_progress tp on tp.team_id = t.id
    where t.room_id = p_room_id
  ) q;
  return coalesce(v_out, '[]'::jsonb);
end $$;

-- =====================================================================
--  ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles         enable row level security;
alter table public.rooms            enable row level security;
alter table public.clues            enable row level security;
alter table public.teams            enable row level security;
alter table public.team_members     enable row level security;
alter table public.team_progress    enable row level security;
alter table public.step_results     enable row level security;
alter table public.challenges       enable row level security;
alter table public.challenge_awards enable row level security;

-- profiles
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- rooms: owner full control; members can read their room
drop policy if exists rooms_owner_all on public.rooms;
create policy rooms_owner_all on public.rooms
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists rooms_member_read on public.rooms;
create policy rooms_member_read on public.rooms
  for select using (public.is_room_member(id));

-- clues: OWNER ONLY. Players receive clue text through get_my_clue().
drop policy if exists clues_owner_all on public.clues;
create policy clues_owner_all on public.clues
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));

-- teams: owner writes; members read teams in their room (leaderboard)
drop policy if exists teams_owner_all on public.teams;
create policy teams_owner_all on public.teams
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
drop policy if exists teams_member_read on public.teams;
create policy teams_member_read on public.teams
  for select using (public.is_room_member(room_id));

-- team_members
drop policy if exists tm_owner_all on public.team_members;
create policy tm_owner_all on public.team_members
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
drop policy if exists tm_self_read on public.team_members;
create policy tm_self_read on public.team_members
  for select using (user_id = auth.uid() or public.is_room_member(room_id));

-- team_progress: read-only for players (all writes go through RPCs)
drop policy if exists tp_read on public.team_progress;
create policy tp_read on public.team_progress
  for select using (public.is_room_owner(room_id) or public.is_room_member(room_id));
drop policy if exists tp_owner_write on public.team_progress;
create policy tp_owner_write on public.team_progress
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));

-- step_results: readable in-room (drives the leaderboard), written by RPC
drop policy if exists sr_read on public.step_results;
create policy sr_read on public.step_results
  for select using (public.is_room_owner(room_id) or public.is_room_member(room_id));
drop policy if exists sr_owner_write on public.step_results;
create policy sr_owner_write on public.step_results
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));

-- challenges
drop policy if exists ch_owner_all on public.challenges;
create policy ch_owner_all on public.challenges
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
drop policy if exists ch_member_read on public.challenges;
create policy ch_member_read on public.challenges
  for select using (
    public.is_room_member(room_id)
    and status = 'open'
    and (target = 'all' or team_id = public.my_team_in_room(room_id))
  );

-- challenge awards
drop policy if exists ca_owner_all on public.challenge_awards;
create policy ca_owner_all on public.challenge_awards
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
drop policy if exists ca_member_read on public.challenge_awards;
create policy ca_member_read on public.challenge_awards
  for select using (public.is_room_member(room_id));

-- =====================================================================
--  GRANTS
-- =====================================================================
grant execute on function public.public_leaderboard(text)   to anon, authenticated;
grant execute on function public.room_public_info(text)     to anon, authenticated;
grant execute on function public.join_game(text, text)      to authenticated;
grant execute on function public.get_my_clue(uuid)          to authenticated;
grant execute on function public.submit_scan(uuid, text)    to authenticated;
grant execute on function public.award_challenge(uuid, uuid, int) to authenticated;
grant execute on function public.set_room_status(uuid, text)to authenticated;
grant execute on function public.reset_team(uuid)           to authenticated;
grant execute on function public.admin_room_state(uuid)     to authenticated;
revoke all on public.team_scores from anon, authenticated;

-- =====================================================================
--  REALTIME
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['step_results','challenge_awards','team_progress',
                           'challenges','teams','rooms'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
