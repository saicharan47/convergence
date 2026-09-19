-- Use database server time for anti-cheat warning timestamps.

CREATE OR REPLACE FUNCTION public.record_convergence_violation(p_token text, p_event_type text, p_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tid uuid; s public.convergence_team_state%rowtype; w integer; ts timestamptz:=clock_timestamp();
begin
 tid:=public.convergence_team_from_token(p_token); if tid is null then return jsonb_build_object('ok',false); end if;
 select * into s from public.convergence_team_state where team_id=tid for update;
 if s.status in('ELIMINATED','WINNER') then return jsonb_build_object('ok',false,'status',s.status); end if;
 w:=least(3,s.warnings+1);
 update public.convergence_team_state set warnings=w,status=case when w=3 then 'ELIMINATED' else status end,last_action_at=ts,updated_at=ts where team_id=tid;
 insert into public.convergence_anticheat_events(team_id,event_type,warning_number,metadata) values(tid,p_event_type,w,coalesce(p_metadata,'{}'));

 return jsonb_build_object('ok',true,'warning',w,'status',case when w=3 then 'ELIMINATED' else s.status end);
end $function$
;
