create table if not exists public.convergence_rate_limits(
  team_id uuid primary key references public.teams(id) on delete cascade,
  window_started_at timestamptz not null,
  attempt_count integer not null default 0
);
alter table public.convergence_rate_limits enable row level security;
revoke all on table public.convergence_rate_limits from anon,authenticated;

create or replace function public.convergence_rate_limit_check(p_team_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare ts timestamptz:=clock_timestamp(); started timestamptz; attempts integer;
begin
  insert into public.convergence_rate_limits(team_id,window_started_at,attempt_count)
  values(p_team_id,ts,1)
  on conflict(team_id) do update set
    window_started_at=case when public.convergence_rate_limits.window_started_at<=ts-interval '10 seconds' then ts else public.convergence_rate_limits.window_started_at end,
    attempt_count=case when public.convergence_rate_limits.window_started_at<=ts-interval '10 seconds' then 1 else public.convergence_rate_limits.attempt_count+1 end
  returning window_started_at,attempt_count into started,attempts;
  return attempts<=10;
end $function$;

drop function if exists public.verify_convergence_action_core_legacy(text,text,text);\nalter function public.verify_convergence_action_core(text,text,text) rename to verify_convergence_action_core_legacy;

create or replace function public.verify_convergence_action_core(p_token text,p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare tid uuid;
begin
  tid:=public.convergence_team_from_token(p_token);
  if tid is null then return jsonb_build_object('ok',false,'reason','invalid_session'); end if;
  if not public.convergence_rate_limit_check(tid) then return jsonb_build_object('ok',false,'reason','rate_limited','retry_after_seconds',10); end if;
  return public.verify_convergence_action_core_legacy(p_token,p_action,p_value);
end $function$;

revoke execute on function public.convergence_rate_limit_check(uuid) from public,anon,authenticated;
revoke execute on function public.verify_convergence_action_core_legacy(text,text,text) from public,anon,authenticated;
grant execute on function public.verify_convergence_action_core(text,text,text) to anon,authenticated;

create or replace function public.convergence_admin_test_fixture()
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare tid uuid; ts timestamptz:=clock_timestamp();
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  select id into tid from public.teams where track_id='TEST' and name='TEST TEAM' limit 1;
  if tid is null then
    insert into public.teams(name,password_hash,track_id) values('TEST TEAM',extensions.crypt('convergence-test',extensions.gen_salt('bf')),'TEST') returning id into tid;
    insert into public.convergence_team_state(team_id) values(tid);
  else
    update public.teams set password_hash=extensions.crypt('convergence-test',extensions.gen_salt('bf')) where id=tid;
    insert into public.convergence_team_state(team_id) values(tid) on conflict(team_id) do nothing;
  end if;
  delete from public.convergence_rate_limits where team_id=tid;
  perform public.convergence_admin_upsert_route_item(tid,'HAND_IN','Test Hand-In','Find the blue envelope at the test table.','Press "I found Clue 1" after reaching it.',null,null,'TEST TABLE',null,null,'{"test":true}');
  perform public.convergence_admin_upsert_route_item(tid,'STICKER_1','Test Sticker 1','A five-digit lock.','Enter 24680.',null,null,'TEST TABLE','24680',null,'{"test":true}');
  perform public.convergence_admin_upsert_route_item(tid,'STICKER_2','Test Sticker 2','Second lock.','Enter 13579.',null,null,'TEST TABLE','13579',null,'{"test":true}');
  perform public.convergence_admin_upsert_route_item(tid,'ANSWER_2','Test 7-Digit Answer','Test answer.','Enter 1234567.',null,null,'TEST TABLE',null,'1234567','{"test":true}');
  update public.convergence_team_state set current_step='HAND_IN',status='ACTIVE',warnings=0,last_action_at=ts,updated_at=ts where team_id=tid;
  return jsonb_build_object('ok',true,'team_id',tid,'team_name','TEST TEAM','password','convergence-test');
end $function$;
