-- Participant login is identified by team name + password only.
-- The room remains as an event grouping, but participants no longer enter a room code.
drop function if exists public.login_team(text, text, text);

create or replace function public.login_team(p_team_name text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
  v_token text;
  v_token_hash text;
  v_realtime_key text;
begin
  select tm.* into v_team
  from public.teams as tm
  join public.rooms as rm on rm.id = tm.room_id
  where rm.is_active = true
    and lower(tm.name) = lower(trim(p_team_name))
  order by tm.created_at asc
  limit 1;

  if not found or v_team.password_hash <> extensions.crypt(p_password, v_team.password_hash) then
    return null;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_realtime_key := encode(extensions.gen_random_bytes(24), 'hex');

  delete from public.team_sessions
  where team_id = v_team.id or expires_at < now();

  insert into public.team_sessions(token_hash, team_id, realtime_key)
  values (v_token_hash, v_team.id, v_realtime_key);

  insert into public.team_progress(team_id)
  values (v_team.id)
  on conflict (team_id) do nothing;

  return jsonb_build_object(
    'token', v_token,
    'realtime_key', v_realtime_key,
    'team_id', v_team.id,
    'name', v_team.name,
    'track_id', v_team.track_id
  );
end;
$$;

grant execute on function public.login_team(text, text) to anon, authenticated;
