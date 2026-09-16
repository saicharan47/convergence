-- Make the master hunt control authoritative for every track.
-- Starting the master switch immediately starts every track and every eligible team.
-- Resetting it stops every track and resets every team.

create or replace function public.set_global_hunt_status(p_started boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
begin
  if not (select private.is_organizer()) then
    raise exception 'organizer access required';
  end if;

  insert into public.hunt_state(id, started, started_at, updated_at)
  values (1, p_started, case when p_started then v_now else null end, v_now)
  on conflict (id) do update
    set started = excluded.started,
        started_at = excluded.started_at,
        updated_at = v_now;

  if p_started then
    insert into public.track_hunt_state(track_id, enabled, starts_at, ends_at, updated_at)
    select id, true, v_now, null, v_now
    from public.tracks
    on conflict (track_id) do update
      set enabled = true,
          starts_at = v_now,
          ends_at = null,
          updated_at = v_now;

    update public.team_progress p
    set hunt_started = true,
        start_time = coalesce(p.start_time, v_now),
        updated_at = v_now
    from public.teams t
    where t.id = p.team_id
      and not coalesce(p.disqualified, false);
  else
    update public.track_hunt_state
    set enabled = false,
        starts_at = null,
        ends_at = null,
        updated_at = v_now;

    update public.team_progress
    set current_clue = 1,
        hunt_started = false,
        start_time = null,
        finish_time = null,
        disqualified = false,
        updated_at = v_now;
  end if;

  return true;
end;
$$;

create or replace function public.reset_global_hunt()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_organizer()) then
    raise exception 'organizer access required';
  end if;

  perform public.set_global_hunt_status(false);
  return true;
end;
$$;
