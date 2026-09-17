-- Organizer-managed participant team roster and CSV import support.
create table if not exists public.team_members (
  id uuid primary key default extensions.gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_members_name_check check (length(trim(name)) > 0)
);

create index if not exists team_members_team_id_idx on public.team_members(team_id);
alter table public.team_members enable row level security;

create policy "organizers can read assigned team members" on public.team_members for select to authenticated
using (exists (select 1 from public.teams t where t.id = team_id and (select private.organizer_can_access_track(t.track_id))));

create or replace function public.get_organizer_teams(p_track_id text default null)
returns table(id uuid, name text, track_id text, created_at timestamptz, member_count integer)
language sql security definer set search_path = '' as $$
  select t.id, t.name, t.track_id, t.created_at,
    (select count(*)::integer from public.team_members m where m.team_id=t.id)
  from public.teams t
  where (p_track_id is null or t.track_id=p_track_id)
    and (select private.organizer_can_access_track(t.track_id))
  order by t.track_id, t.name;
$$;

create or replace function public.get_organizer_team_members(p_team_id uuid)
returns table(id uuid, team_id uuid, name text, email text, phone text)
language sql security definer set search_path = '' as $$
  select m.id, m.team_id, m.name, m.email, m.phone
  from public.team_members m
  join public.teams t on t.id=m.team_id
  where m.team_id=p_team_id and (select private.organizer_can_access_track(t.track_id))
  order by m.created_at, m.name;
$$;

create or replace function public.upsert_organizer_team(
  p_team_id uuid default null,
  p_name text default null,
  p_password text default null,
  p_track_id text default null,
  p_members jsonb default '[]'::jsonb
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_team_id uuid := p_team_id;
  v_room_id uuid;
  v_name text := trim(coalesce(p_name,''));
  v_track text := trim(coalesce(p_track_id,''));
  member_row jsonb;
begin
  if not (select private.organizer_can_access_track(v_track)) then raise exception 'organizer access required'; end if;
  if v_name='' then raise exception 'team name is required'; end if;
  if not exists (select 1 from public.tracks where id=v_track) then raise exception 'invalid track'; end if;

  if v_team_id is not null then
    if not exists (select 1 from public.teams where id=v_team_id and (select private.organizer_can_access_track(track_id))) then raise exception 'team access denied'; end if;
    update public.teams set name=v_name, track_id=v_track,
      password_hash=case when nullif(p_password,'') is null then password_hash else extensions.crypt(p_password, extensions.gen_salt('bf')) end
      where id=v_team_id;
  else
    select id into v_room_id from public.rooms where is_active=true order by created_at asc limit 1;
    if v_room_id is null then
      insert into public.rooms(code,is_active) values ('EVENT-' || upper(substr(encode(extensions.gen_random_bytes(5),'hex'),1,8)),true) returning id into v_room_id;
    end if;
    insert into public.teams(room_id,name,password_hash,track_id) values (v_room_id,v_name,extensions.crypt(coalesce(nullif(p_password,''),'change-me'),extensions.gen_salt('bf')),v_track) returning id into v_team_id;
    insert into public.team_progress(team_id) values (v_team_id) on conflict (team_id) do nothing;
  end if;

  delete from public.team_members where team_id=v_team_id;
  for member_row in select value from jsonb_array_elements(coalesce(p_members,'[]'::jsonb)) loop
    if length(trim(coalesce(member_row->>'name',''))) > 0 then
      insert into public.team_members(team_id,name,email,phone) values (v_team_id,trim(member_row->>'name'),nullif(trim(member_row->>'email'),''),nullif(trim(member_row->>'phone'),''));
    end if;
  end loop;
  return v_team_id;
end;
$$;

create or replace function public.delete_organizer_team(p_team_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_track text;
begin
  select track_id into v_track from public.teams where id=p_team_id;
  if v_track is null or not (select private.organizer_can_access_track(v_track)) then raise exception 'team access denied'; end if;
  delete from public.team_sessions where team_id=p_team_id;
  delete from public.team_clue_codes where team_id=p_team_id;
  delete from public.team_progress where team_id=p_team_id;
  delete from public.teams where id=p_team_id;
  return true;
end;
$$;

create or replace function public.import_organizer_teams(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  row_data jsonb;
  v_id uuid;
  v_count integer := 0;
  v_created integer := 0;
  v_updated integer := 0;
  v_name text;
  v_track text;
  v_password text;
  v_members jsonb;
begin
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'CSV rows must be an array'; end if;
  if jsonb_array_length(p_rows) > 500 then raise exception 'CSV import is limited to 500 teams per batch'; end if;
  for row_data in select value from jsonb_array_elements(p_rows) loop
    v_name := trim(coalesce(row_data->>'team_name', row_data->>'name',''));
    v_track := trim(coalesce(row_data->>'track_id', row_data->>'track',''));
    v_password := coalesce(row_data->>'password','');
    v_members := coalesce(row_data->'members','[]'::jsonb);
    if v_name='' or v_track='' then continue; end if;
    if not exists (select 1 from public.tracks where id=v_track) then raise exception 'invalid track: %', v_track; end if;
    if not (select private.organizer_can_access_track(v_track)) then raise exception 'organizer access required for track %', v_track; end if;
    select id into v_id from public.teams where lower(name)=lower(v_name) and track_id=v_track order by created_at asc limit 1;
    if v_id is not null then
      perform public.upsert_organizer_team(v_id,v_name,v_password,v_track,v_members);
      v_updated := v_updated + 1;
    else
      v_id := public.upsert_organizer_team(null,v_name,v_password,v_track,v_members);
      v_created := v_created + 1;
    end if;
    v_count := v_count + 1;
  end loop;
  return jsonb_build_object('processed',v_count,'created',v_created,'updated',v_updated);
end;
$$;

grant execute on function public.get_organizer_teams(text) to authenticated;
grant execute on function public.get_organizer_team_members(uuid) to authenticated;
grant execute on function public.upsert_organizer_team(uuid,text,text,text,jsonb) to authenticated;
grant execute on function public.delete_organizer_team(uuid) to authenticated;
grant execute on function public.import_organizer_teams(jsonb) to authenticated;
