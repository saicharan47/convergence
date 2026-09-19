-- Server-side participant action rate limiting: max 10 attempts per team per 10 seconds.

CREATE OR REPLACE FUNCTION public.verify_convergence_action(p_token text, p_action text, p_value text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  tid uuid;
  s public.convergence_team_state%rowtype;
  g public.convergence_game_control%rowtype;
  r public.convergence_route_items%rowtype;
  ts timestamptz := clock_timestamp();
  next_step text;
  attempt_count integer;
begin
  tid:=public.convergence_team_from_token(p_token);
  if tid is null then return jsonb_build_object('ok',false,'reason','invalid_session'); end if;
  select * into s from public.convergence_team_state where team_id=tid for update;
  select * into g from public.convergence_game_control where id=1;

  if g.buffer_active and g.buffer_ends_at is not null and ts >= g.buffer_ends_at then
    update public.convergence_game_control
    set buffer_active=false,buffer_ends_at=null,updated_at=ts
    where id=1 and buffer_active=true;
    select * into g from public.convergence_game_control where id=1;
  end if;

  if s.status in('ELIMINATED','WINNER') then return jsonb_build_object('ok',false,'reason',lower(s.status)); end if;
  if g.buffer_active then return jsonb_build_object('ok',false,'reason','buffer_period','buffer_ends_at',g.buffer_ends_at,'server_now',ts); end if;
  if not g.running then return jsonb_build_object('ok',false,'reason','game_paused'); end if;



  if p_action='STICKER_CODE' and s.current_step='HAND_IN' then
    select count(*) into attempt_count
    from public.convergence_anticheat_events
    where team_id=tid and event_type='ACTION_ATTEMPT' and created_at >= ts - interval '10 seconds';
    if attempt_count >= 10 then
      return jsonb_build_object('ok',false,'reason','rate_limited','retry_after_seconds',10);
    end if;
    insert into public.convergence_anticheat_events(team_id,event_type,warning_number,created_at,metadata)
    values(tid,'ACTION_ATTEMPT',s.warnings,ts,jsonb_build_object('action',p_action,'step',s.current_step));
    select * into r from public.convergence_route_items where team_id=tid and step_key='STICKER_1';
    if r.team_id is not null and r.code_hash is not null and r.code_hash=extensions.crypt(trim(p_value),r.code_hash) then
      next_step:='STICKER_2';
      update public.convergence_team_state set current_step=next_step,last_action_at=ts,updated_at=ts where team_id=tid;
      perform public.convergence_audit_event(tid,'PHYSICAL_CODE_VERIFIED',g.current_stage,'STICKER_1',jsonb_build_object('next_step',next_step,'action_timestamp',ts));
      return jsonb_build_object('ok',true,'next_step',next_step,'timestamp',ts,'server_now',ts);
    end if;
  end if;
  return public.verify_convergence_action_core(p_token,p_action,p_value);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.verify_convergence_action_core(p_token text, p_action text, p_value text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tid uuid; t public.teams%rowtype; s public.convergence_team_state%rowtype; g public.convergence_game_control%rowtype; r public.convergence_route_items%rowtype; cp public.convergence_checkpoints%rowtype; n integer; ts timestamptz:=clock_timestamp(); next_step text;
begin
 tid:=public.convergence_team_from_token(p_token); if tid is null then return jsonb_build_object('ok',false,'reason','invalid_session'); end if;
 select * into t from public.teams where id=tid;
 select * into s from public.convergence_team_state where team_id=tid for update;
 select * into g from public.convergence_game_control where id=1;

 if g.buffer_active and g.buffer_ends_at is not null and ts>=g.buffer_ends_at then
   update public.convergence_game_control set buffer_active=false,buffer_ends_at=null,updated_at=ts where id=1 and buffer_active=true;
   select * into g from public.convergence_game_control where id=1;
 end if;
 if s.status in('ELIMINATED','WINNER') then return jsonb_build_object('ok',false,'reason',lower(s.status)); end if;
 if g.buffer_active then return jsonb_build_object('ok',false,'reason','buffer_period','buffer_ends_at',g.buffer_ends_at,'server_now',ts); end if;
 if not g.running then return jsonb_build_object('ok',false,'reason','game_paused'); end if;

 select count(*) into n
 from public.convergence_anticheat_events
 where team_id=tid and event_type='ACTION_ATTEMPT' and created_at >= ts - interval '10 seconds';
 if n >= 10 then
   return jsonb_build_object('ok',false,'reason','rate_limited','retry_after_seconds',10);
 end if;
 insert into public.convergence_anticheat_events(team_id,event_type,warning_number,created_at,metadata)
 values(tid,'ACTION_ATTEMPT',s.warnings,ts,jsonb_build_object('action',p_action,'step',s.current_step));

 select * into r from public.convergence_route_items where team_id=tid and step_key=s.current_step;

 if p_action='ACK_RIDDLE' then
   if s.current_step='RIDDLE_4' then next_step:='STICKER_4'; elsif s.current_step='RIDDLE_7' then next_step:='STICKER_7'; else return jsonb_build_object('ok',false,'reason','invalid_step'); end if;
   update public.convergence_team_state set current_step=next_step,last_action_at=ts,updated_at=ts where team_id=tid;
   perform public.convergence_audit_event(tid,'CLUE_REACHED',g.current_stage,s.current_step,jsonb_build_object('next_step',next_step,'action_timestamp',ts));
   return jsonb_build_object('ok',true,'next_step',next_step,'timestamp',ts,'server_now',ts);
 end if;

 if p_action='STICKER_CODE' and r.team_id is not null and r.code_hash is not null and r.code_hash=extensions.crypt(trim(p_value),r.code_hash) then
   next_step:=case s.current_step when 'STICKER_1' then 'STICKER_2' when 'STICKER_2' then 'ANSWER_2' when 'STICKER_4' then 'STICKER_5' when 'STICKER_5' then 'ANSWER_5' when 'STICKER_7' then 'CLUE_8' else s.current_step end;
   update public.convergence_team_state set current_step=next_step,last_action_at=ts,updated_at=ts where team_id=tid;
   perform public.convergence_audit_event(tid,'PHYSICAL_CODE_VERIFIED',g.current_stage,s.current_step,jsonb_build_object('next_step',next_step,'action_timestamp',ts));
   return jsonb_build_object('ok',true,'next_step',next_step,'timestamp',ts,'server_now',ts);
 end if;

 if p_action='ANSWER' and r.team_id is not null and r.answer_hash is not null and r.answer_hash=extensions.crypt(trim(p_value),r.answer_hash) then
   next_step:=case s.current_step when 'ANSWER_2' then 'CHECKPOINT_1_QR' when 'ANSWER_5' then 'CHECKPOINT_2_QR' else s.current_step end;
   update public.convergence_team_state set current_step=next_step,last_action_at=ts,updated_at=ts where team_id=tid;
   perform public.convergence_audit_event(tid,'ANSWER_VERIFIED',g.current_stage,s.current_step,jsonb_build_object('next_step',next_step,'action_timestamp',ts));
   return jsonb_build_object('ok',true,'next_step',next_step,'timestamp',ts,'server_now',ts);
 end if;

 if p_action='CHECKPOINT_QR' then
   select * into cp from public.convergence_checkpoints where stage=case when s.current_step='CHECKPOINT_1_QR' then 3 else 6 end and track_id=t.track_id;
   if cp.id is not null and cp.qr_token_hash=extensions.crypt(trim(p_value),cp.qr_token_hash) then
     next_step:=case when s.current_step='CHECKPOINT_1_QR' then 'CHECKPOINT_1_CODE' else 'CHECKPOINT_2_CODE' end;
     update public.convergence_team_state set current_step=next_step,last_action_at=ts,updated_at=ts where team_id=tid;
     perform public.convergence_audit_event(tid,'CHECKPOINT_REACHED',g.current_stage,s.current_step,jsonb_build_object('action_timestamp',ts));
     return jsonb_build_object('ok',true,'next_step',next_step,'timestamp',ts,'server_now',ts);
   end if;
 elsif p_action='CHECKPOINT_CODE' then
   select * into cp from public.convergence_checkpoints where stage=case when s.current_step='CHECKPOINT_1_CODE' then 3 else 6 end and track_id=t.track_id;
   if cp.id is not null and cp.checkpoint_code_hash=extensions.crypt(trim(p_value),cp.checkpoint_code_hash) then
     next_step:=case when s.current_step='CHECKPOINT_1_CODE' then 'SNIPPET_1' else 'SNIPPET_2' end;
     update public.convergence_team_state set current_step=next_step,last_action_at=ts,updated_at=ts where team_id=tid;
     perform public.convergence_audit_event(tid,'CHECKPOINT_CODE_VERIFIED',g.current_stage,s.current_step,jsonb_build_object('action_timestamp',ts));
     return jsonb_build_object('ok',true,'next_step',next_step,'snippet',cp.snippet,'timestamp',ts,'server_now',ts);
   end if;
 elsif p_action='SNIPPET' then
   select * into cp from public.convergence_checkpoints where stage=case when s.current_step='SNIPPET_1' then 3 else 6 end and track_id=t.track_id;
   if cp.id is not null and cp.snippet_answer_hash=extensions.crypt(trim(p_value),cp.snippet_answer_hash) then
     if s.current_step='SNIPPET_1' then
       perform pg_advisory_xact_lock(hashtext('convergence-stage-3'));
       select count(*) into n from public.convergence_team_state x join public.teams tx on tx.id=x.team_id where tx.track_id=t.track_id and x.stage3_rank is not null;
       if n>=10 then
         update public.convergence_team_state set status='ELIMINATED',last_action_at=ts,updated_at=ts where team_id=tid;
         perform public.convergence_audit_event(tid,'ELIMINATED',3,'SNIPPET_1',jsonb_build_object('reason','track_cutoff','action_timestamp',ts));
         return jsonb_build_object('ok',true,'status','ELIMINATED','timestamp',ts);
       end if;
       n:=n+1;
       update public.convergence_team_state set stage3_rank=n,status='PROMOTED',current_step='STAGE_4_ASSIGNMENT',paused_at=ts,last_action_at=ts,updated_at=ts where team_id=tid;
       perform public.convergence_audit_event(tid,'PROMOTED',3,'SNIPPET_1',jsonb_build_object('rank',n,'action_timestamp',ts));
       if n=10 then
         update public.convergence_team_state x set status='ELIMINATED',last_action_at=ts,updated_at=ts
         from public.teams tx
         where x.team_id=tx.id and tx.track_id=t.track_id
           and x.stage3_rank is null and x.status not in('ELIMINATED','WINNER');

         if (
           select count(*) from (
             select tx.track_id
             from public.convergence_team_state x
             join public.teams tx on tx.id=x.team_id
             where x.stage3_rank is not null
             group by tx.track_id
             having count(*) >= 10
           ) closed_tracks
         ) >= 4 then
           update public.convergence_game_control set running=false,updated_at=ts where id=1;
         end if;
       end if;
       return jsonb_build_object('ok',true,'status','PROMOTED','rank',n,'timestamp',ts,'server_now',ts);
     else
       perform pg_advisory_xact_lock(hashtext('convergence-stage-6'));
       select count(*) into n from public.convergence_team_state where stage6_rank is not null;
       if n>=20 then
         update public.convergence_team_state set status='ELIMINATED',last_action_at=ts,updated_at=ts where team_id=tid;
         perform public.convergence_audit_event(tid,'ELIMINATED',6,'SNIPPET_2',jsonb_build_object('reason','global_cutoff','action_timestamp',ts));
         return jsonb_build_object('ok',true,'status','ELIMINATED','timestamp',ts);
       end if;
       n:=n+1;
       update public.convergence_team_state set stage6_rank=n,status='PROMOTED',current_step='STAGE_7',paused_at=ts,last_action_at=ts,updated_at=ts where team_id=tid;
       perform public.convergence_audit_event(tid,'PROMOTED',6,'SNIPPET_2',jsonb_build_object('rank',n,'action_timestamp',ts));
       if n=20 then
         update public.convergence_team_state set status='ELIMINATED',last_action_at=ts,updated_at=ts where stage6_rank is null and status not in('ELIMINATED','WINNER');
         update public.convergence_game_control set running=false,updated_at=ts where id=1;
       end if;
       return jsonb_build_object('ok',true,'status','PROMOTED','rank',n,'timestamp',ts,'server_now',ts);
     end if;
   end if;
 elsif p_action='CLUE9_CODE' then
   select * into r from public.convergence_route_items where team_id=tid and step_key='CLUE_9';
   if r.team_id is not null and r.code_hash=extensions.crypt(trim(p_value),r.code_hash) then
     perform pg_advisory_xact_lock(hashtext('convergence-clue9'));
     select count(*) into n from public.convergence_clue9_claims;
     if n>=10 then
       update public.convergence_team_state set status='ELIMINATED',last_action_at=ts,updated_at=ts where team_id=tid;
       perform public.convergence_audit_event(tid,'ELIMINATED',9,'CLUE_9',jsonb_build_object('reason','clue9_cutoff','action_timestamp',ts));
       return jsonb_build_object('ok',true,'status','ELIMINATED','timestamp',ts);
     end if;
     n:=n+1;
     insert into public.convergence_clue9_claims(team_id,claimed_at,rank) values(tid,ts,n);
     update public.convergence_team_state set clue9_rank=n,status='FINALIST',current_step='FINAL_RIDDLE',last_action_at=ts,updated_at=ts where team_id=tid;
     perform public.convergence_audit_event(tid,'CLUE_9_CLAIMED',9,'CLUE_9',jsonb_build_object('rank',n,'action_timestamp',ts));
     if n=10 then
       update public.convergence_team_state set status='ELIMINATED',last_action_at=ts,updated_at=ts where clue9_rank is null and status not in('ELIMINATED','WINNER');
       update public.convergence_game_control set running=false,updated_at=ts where id=1;
     end if;
     return jsonb_build_object('ok',true,'status','FINALIST','rank',n,'timestamp',ts,'server_now',ts);
   end if;
 elsif p_action='FINAL_SUBMISSION' then
   if s.status<>'FINALIST' or s.current_step<>'FINAL_RIDDLE' then return jsonb_build_object('ok',false,'reason','not_finalist'); end if;
   perform pg_advisory_xact_lock(hashtext('convergence-treasure'));
   if exists(select 1 from public.convergence_team_state where status='WINNER') then return jsonb_build_object('ok',false,'reason','treasure_already_found'); end if;
   update public.convergence_team_state set status='WINNER',current_step='TREASURE_FOUND',completed_at=ts,last_action_at=ts,updated_at=ts where team_id=tid;
   update public.convergence_game_control set running=false,updated_at=ts where id=1;
   perform public.convergence_audit_event(tid,'TREASURE_FOUND',10,'FINAL_SUBMISSION',jsonb_build_object('action_timestamp',ts));
   return jsonb_build_object('ok',true,'status','WINNER','timestamp',ts,'server_now',ts);
 end if;
 return jsonb_build_object('ok',false,'reason','incorrect');
end;
$function$
;
