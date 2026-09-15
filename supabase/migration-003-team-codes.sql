-- =====================================================================
--  MIGRATION 003 — team code is the second gate again
--  Room code gets you to the door; your crew's unique code gets you in.
--  Run after schema.sql and migration-002-auth.sql. Safe to re-run.
-- =====================================================================

-- new rooms require the team code by default
alter table public.rooms alter column require_team_code set default true;

-- turn it on for rooms created before this migration
update public.rooms set require_team_code = true where require_team_code = false;

-- ---------------------------------------------------------------------
-- Resolve a team code to its crew, so the join screen can confirm
-- "✓ Tokyo" before the player commits. Reveals a name only to someone
-- who already holds the correct code.
-- ---------------------------------------------------------------------
create or replace function public.peek_team(p_room_code text, p_team_code text)
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

grant execute on function public.peek_team(text, text) to anon, authenticated;
