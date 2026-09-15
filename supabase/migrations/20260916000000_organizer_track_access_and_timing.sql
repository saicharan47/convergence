-- Convergence hardening migration.
-- Adds organizer track scoping, per-track hunt schedules, and server-side timing enforcement.

alter table public.organizers add column if not exists track_id text references public.tracks(id) on delete set null;

create table if not exists public.track_hunt_state (
  track_id text primary key references public.tracks(id) on delete cascade,
  enabled boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint track_hunt_state_time_check check (ends_at is null or starts_at is null or ends_at > starts_at)
);

insert into public.track_hunt_state(track_id)
select id from public.tracks
on conflict (track_id) do nothing;

alter table public.track_hunt_state enable row level security;
drop policy if exists "public can read track hunt state" on public.track_hunt_state;
create policy "public can read track hunt state" on public.track_hunt_state for select to anon, authenticated using (true);

create or replace function private.organizer_can_access_track(p_track_id text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.organizers o where o.user_id = auth.uid() and (o.track_id is null or o.track_id = p_track_id));
$$;

-- Organizer reads/writes are limited to their assigned track. NULL track_id means global organizer.
drop policy if exists "organizers can read all teams" on public.teams;
create policy "organizers can read assigned teams" on public.teams for select to authenticated
using ((select private.organizer_can_access_track(track_id)));

drop policy if exists "organizers can read progress" on public.team_progress;
create policy "organizers can read assigned progress" on public.team_progress for select to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and (select private.organizer_can_access_track(t.track_id))));

drop policy if exists "organizers can update progress" on public.team_progress;
create policy "organizers can update assigned progress" on public.team_progress for update to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and (select private.organizer_can_access_track(t.track_id))))
with check (exists (select 1 from public.teams t where t.id = team_id and (select private.organizer_can_access_track(t.track_id))));

drop policy if exists "organizers can edit clues" on public.clues;
create policy "organizers can edit assigned clues" on public.clues for all to authenticated
using ((select private.organizer_can_access_track(track_id)))
with check ((select private.organizer_can_access_track(track_id)));

create or replace function public.get_organizer_profile()
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('user_id', o.user_id, 'track_id', o.track_id)
  from public.organizers o where o.user_id = auth.uid();
$$;

create or replace function public.get_track_hunt_state(p_track_id text)
returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object('track_id', s.track_id, 'enabled', s.enabled, 'starts_at', s.starts_at, 'ends_at', s.ends_at,
    'active_now', s.enabled and (s.starts_at is null or now() >= s.starts_at) and (s.ends_at is null or now() < s.ends_at))
  from public.track_hunt_state s where s.track_id = p_track_id;
$$;

create or replace function public.set_track_hunt_status(p_track_id text, p_enabled boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_now timestamptz := now(); v_starts_at timestamptz; v_ends_at timestamptz;
begin
  if not (select private.organizer_can_access_track(p_track_id)) then raise exception 'organizer access required'; end if;
  select starts_at, ends_at into v_starts_at, v_ends_at from public.track_hunt_state where track_id=p_track_id;
  if p_enabled and v_starts_at is null then v_starts_at := v_now; end if;
  if not p_enabled then v_starts_at := null; v_ends_at := null; end if;
  insert into public.track_hunt_state(track_id,enabled,starts_at,ends_at,updated_at)
  values (p_track_id,p_enabled,v_starts_at,v_ends_at,v_now)
  on conflict (track_id) do update set enabled=excluded.enabled, starts_at=excluded.starts_at, ends_at=excluded.ends_at, updated_at=v_now;
  if p_enabled and (v_starts_at is null or v_now >= v_starts_at) and (v_ends_at is null or v_now < v_ends_at) then
    update public.team_progress p set hunt_started=true, start_time=coalesce(p.start_time,v_starts_at,v_now), updated_at=v_now
    from public.teams t where t.id=p.team_id and t.track_id=p_track_id and not p.disqualified;
  elsif not p_enabled then
    update public.team_progress p set hunt_started=false, updated_at=v_now
    from public.teams t where t.id=p.team_id and t.track_id=p_track_id;
  end if;
  return true;
end;
$$;

create or replace function public.set_track_schedule(p_track_id text, p_starts_at timestamptz, p_ends_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.organizer_can_access_track(p_track_id)) then raise exception 'organizer access required'; end if;
  if p_ends_at is not null and p_starts_at is not null and p_ends_at <= p_starts_at then raise exception 'end time must be after start time'; end if;
  insert into public.track_hunt_state(track_id, enabled, starts_at, ends_at, updated_at)
  values (p_track_id, false, p_starts_at, p_ends_at, now())
  on conflict (track_id) do update set starts_at=excluded.starts_at, ends_at=excluded.ends_at, updated_at=now();
  return true;
end;
$$;

create or replace function public.get_organizer_overview(p_track_id text default null)
returns table(id uuid, team text, track_id text, progress integer, started_at timestamptz, finished_at timestamptz, disqualified boolean)
language sql security definer set search_path = '' as $$
  select t.id, t.name, t.track_id, least(coalesce(p.current_clue,1),10), p.start_time, p.finish_time, coalesce(p.disqualified,false)
  from public.teams t left join public.team_progress p on p.team_id=t.id
  where (p_track_id is null or t.track_id=p_track_id) and (select private.organizer_can_access_track(t.track_id))
  order by t.track_id, least(coalesce(p.current_clue,1),10) desc, t.name;
$$;

create or replace function public.set_global_hunt_status(p_started boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if not (select private.is_organizer()) then raise exception 'organizer access required'; end if;
  insert into public.hunt_state(id, started, started_at, updated_at)
  values (1, p_started, case when p_started then now() else null end, now())
  on conflict (id) do update set started=excluded.started, started_at=excluded.started_at, updated_at=now();
  return true;
end;
$$;

create or replace function public.get_team_state(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.team_sessions%rowtype; t public.teams%rowtype; p public.team_progress%rowtype; ts public.track_hunt_state%rowtype; hs public.hunt_state%rowtype; effective_started boolean; effective_start timestamptz;
begin
  select * into s from public.team_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
  if not found then return null; end if;
  select * into t from public.teams where id=s.team_id;
  select * into p from public.team_progress where team_id=s.team_id;
  select * into ts from public.track_hunt_state where track_id=t.track_id;
  select * into hs from public.hunt_state where id=1;
  effective_started := coalesce(hs.started,false) and coalesce(ts.enabled,false) and (ts.starts_at is null or now() >= ts.starts_at) and (ts.ends_at is null or now() < ts.ends_at) and not coalesce(p.disqualified,false);
  effective_start := coalesce(p.start_time, ts.starts_at);
  return jsonb_build_object('team_id',t.id,'name',t.name,'track_id',t.track_id,'realtime_key',s.realtime_key,
    'progress',jsonb_build_object('team_id',p.team_id,'current_clue',p.current_clue,'start_time',effective_start,'finish_time',p.finish_time,'hunt_started',effective_started,'disqualified',p.disqualified),
    'track_schedule',jsonb_build_object('enabled',coalesce(ts.enabled,false),'starts_at',ts.starts_at,'ends_at',ts.ends_at,'active_now',effective_started));
end;
$$;

create or replace function public.verify_clue_code(p_token text, p_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare s public.team_sessions%rowtype; t public.teams%rowtype; p public.team_progress%rowtype; c public.clues%rowtype; expected_hash text; next_clue integer; ts public.track_hunt_state%rowtype; hs public.hunt_state%rowtype;
begin
  select * into s from public.team_sessions where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and expires_at>now();
  if not found then return jsonb_build_object('ok',false); end if;
  select * into t from public.teams where id=s.team_id;
  select * into p from public.team_progress where team_id=s.team_id for update;
  select * into hs from public.hunt_state where id=1;
  select * into ts from public.track_hunt_state where track_id=t.track_id;
  if not found or p.disqualified or p.current_clue>9 or coalesce(hs.started,false)=false or coalesce(ts.enabled,false)=false or (ts.starts_at is not null and now()<ts.starts_at) or (ts.ends_at is not null and now()>=ts.ends_at) then return jsonb_build_object('ok',false,'reason','hunt_not_active'); end if;
  select * into c from public.clues where track_id=t.track_id and clue_number=p.current_clue;
  if not found then return jsonb_build_object('ok',false); end if;
  select code_hash into expected_hash from public.team_clue_codes where team_id=t.id and clue_id=c.id;
  if expected_hash is null or expected_hash<>extensions.crypt(trim(p_code),expected_hash) then return jsonb_build_object('ok',false); end if;
  next_clue:=p.current_clue+1;
  update public.team_progress set current_clue=next_clue, finish_time=case when next_clue=10 then coalesce(finish_time,now()) else finish_time end, updated_at=now() where team_id=t.id;
  return jsonb_build_object('ok',true,'next_clue',next_clue);
end;
$$;
