-- Convergence dynamic position / checkpoint / sticker system
-- Implements the uploaded Convergence specification without replacing the existing application.

drop function if exists public.convergence_admin_set_game(integer,boolean);
drop function if exists public.convergence_admin_reset_game();

alter table public.teams
  add column if not exists original_team_number integer,
  add column if not exists current_position integer;

alter table public.convergence_team_state
  add column if not exists current_position integer,
  add column if not exists current_clue integer,
  add column if not exists current_sticker_id uuid,
  add column if not exists checkpoint1_completed_at timestamptz,
  add column if not exists checkpoint2_completed_at timestamptz;

update public.teams t
set original_team_number=q.rn,current_position=q.rn
from (
  select id,row_number() over(partition by track_id order by created_at,id) rn
  from public.teams where track_id in('A','B','C','D')
) q where t.id=q.id and t.original_team_number is null;

update public.convergence_team_state s
set current_position=t.current_position,
    current_clue=case
      when s.current_step in('HAND_IN','STICKER_1') then 1
      when s.current_step='STICKER_2' then 2
      when s.current_step in('ANSWER_2','CHECKPOINT_1_QR','CHECKPOINT_1_CODE','SNIPPET_1','CHECKPOINT_1_WAIT') then 3
      when s.current_step in('TRANSITION_1','RIDDLE_4','STICKER_4') then 4
      when s.current_step in('STICKER_5','ANSWER_5') then 5
      when s.current_step in('CHECKPOINT_2_QR','CHECKPOINT_2_CODE','SNIPPET_2','CHECKPOINT_2_WAIT') then 6
      when s.current_step in('TRANSITION_2','RIDDLE_7','STICKER_7') then 7
      when s.current_step='CLUE_8' then 8 else 9 end
from public.teams t where t.id=s.team_id and s.current_position is null;

create unique index if not exists teams_track_original_number_uq
  on public.teams(track_id,original_team_number) where original_team_number is not null;
create index if not exists convergence_team_state_position_idx
  on public.convergence_team_state(current_position);

create table if not exists public.convergence_stickers(
 id uuid primary key default gen_random_uuid(),
 sticker_name text not null,image_url text,
 clue_number integer not null check(clue_number between 1 and 9),
 stage_group integer not null check(stage_group between 1 and 3),
 active boolean not null default true,
 updated_at timestamptz not null default clock_timestamp()
);

create table if not exists public.convergence_position_assignments(
 id uuid primary key default gen_random_uuid(),
 track_id text not null check(track_id in('A','B','C','D')),
 stage_group integer not null check(stage_group between 1 and 3),
 position integer not null check(position>0),
 clue_number integer not null check(clue_number between 1 and 9),
 title text not null default '',body text not null default '',instruction text not null default '',
 physical_location text,sticker_id uuid references public.convergence_stickers(id) on delete set null,
 sticker_image_url text,code_hash text,code_plaintext text,answer_hash text,answer_plaintext text,
 metadata jsonb not null default '{}'::jsonb,published boolean not null default false,
 updated_at timestamptz not null default clock_timestamp(),
 unique(track_id,stage_group,position,clue_number)
);

create table if not exists public.convergence_team_clue_history(
 id bigserial primary key,team_id uuid not null references public.teams(id) on delete cascade,
 stage_group integer not null,position_at_time integer,clue_number integer,
 sticker_id uuid references public.convergence_stickers(id) on delete set null,
 status text not null,event_type text not null,
 assigned_at timestamptz not null default clock_timestamp(),completed_at timestamptz,
 details jsonb not null default '{}'::jsonb
);

create table if not exists public.convergence_transition_riddles(
 checkpoint_number integer primary key check(checkpoint_number in(1,2)),
 riddle_text text not null default '',active boolean not null default true,
 updated_at timestamptz not null default clock_timestamp()
);

insert into public.convergence_transition_riddles(checkpoint_number,riddle_text)
values(1,'The first convergence is complete. Follow the next trail to uncover Clue 4.'),
      (2,'The second convergence is complete. Follow the final trail to uncover Clue 7.')
on conflict(checkpoint_number) do nothing;

alter table public.convergence_game_control
 add column if not exists common_clue9_title text not null default 'CLUE 9 — COMMON TREASURE',
 add column if not exists common_clue9_body text not null default '',
 add column if not exists common_clue9_instruction text not null default '',
 add column if not exists common_clue9_location text,
 add column if not exists common_clue9_code_hash text,
 add column if not exists common_clue9_code_plaintext text,
 add column if not exists common_clue9_sticker_id uuid references public.convergence_stickers(id) on delete set null,
 add column if not exists common_clue9_sticker_image_url text;

alter table public.convergence_stickers enable row level security;
alter table public.convergence_position_assignments enable row level security;
alter table public.convergence_team_clue_history enable row level security;
alter table public.convergence_transition_riddles enable row level security;
revoke all on table public.convergence_stickers,public.convergence_position_assignments,public.convergence_team_clue_history,public.convergence_transition_riddles from anon,authenticated;

create or replace function public.convergence_record_clue_history(p_team_id uuid,p_stage_group integer,p_position integer,p_clue_number integer,p_sticker_id uuid,p_status text,p_event_type text,p_completed_at timestamptz default null,p_details jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.convergence_team_clue_history(team_id,stage_group,position_at_time,clue_number,sticker_id,status,event_type,assigned_at,completed_at,details)
 values(p_team_id,p_stage_group,p_position,p_clue_number,p_sticker_id,p_status,p_event_type,clock_timestamp(),p_completed_at,coalesce(p_details,'{}'::jsonb));
end $$;
revoke execute on function public.convergence_record_clue_history(uuid,integer,integer,integer,uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;

create or replace function public.convergence_recalculate_track_positions(p_track_id text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_track_id not in('A','B','C','D') then raise exception 'invalid track'; end if;
 perform pg_advisory_xact_lock(hashtext('convergence-position-'||p_track_id));
 update public.teams t set current_position=null
 where t.track_id=p_track_id and exists(select 1 from public.convergence_team_state s where s.team_id=t.id and s.status='ELIMINATED');
 update public.teams t set current_position=q.pos
 from(select t2.id,row_number() over(order by t2.original_team_number,t2.created_at,t2.id) pos
      from public.teams t2 join public.convergence_team_state s2 on s2.team_id=t2.id
      where t2.track_id=p_track_id and s2.status<>'ELIMINATED') q
 where t.id=q.id;
 update public.convergence_team_state s set current_position=t.current_position,updated_at=clock_timestamp()
 from public.teams t where t.id=s.team_id and t.track_id=p_track_id;
end $$;
revoke execute on function public.convergence_recalculate_track_positions(text) from public,anon,authenticated;

create or replace function public.convergence_admin_upsert_position_assignment(
 p_track_id text,p_stage_group integer,p_position integer,p_clue_number integer,p_title text,p_body text,p_instruction text,
 p_physical_location text default null,p_sticker_id uuid default null,p_sticker_image_url text default null,
 p_code text default null,p_answer text default null,p_metadata jsonb default '{}'::jsonb,p_published boolean default false)
returns uuid language plpgsql security definer set search_path='' as $$
declare rid uuid;
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
 if p_track_id not in('A','B','C','D') then raise exception 'invalid track'; end if;
 if p_stage_group not between 1 and 3 then raise exception 'invalid stage group'; end if;
 if p_position<1 or p_position>(case p_stage_group when 1 then 15 when 2 then 10 else 5 end) then raise exception 'position outside stage capacity'; end if;
 insert into public.convergence_position_assignments(
 track_id,stage_group,position,clue_number,title,body,instruction,physical_location,sticker_id,sticker_image_url,
 code_hash,code_plaintext,answer_hash,answer_plaintext,metadata,published,updated_at)
 values(
 p_track_id,p_stage_group,p_position,p_clue_number,coalesce(p_title,''),coalesce(p_body,''),coalesce(p_instruction,''),
 nullif(p_physical_location,''),p_sticker_id,nullif(p_sticker_image_url,''),
 case when nullif(trim(coalesce(p_code,'')),'') is null then null else extensions.crypt(trim(p_code),extensions.gen_salt('bf')) end,
 nullif(p_code,''),
 case when nullif(trim(coalesce(p_answer,'')),'') is null then null else extensions.crypt(trim(p_answer),extensions.gen_salt('bf')) end,
 nullif(p_answer,''),coalesce(p_metadata,'{}'::jsonb),p_published,clock_timestamp())
 on conflict(track_id,stage_group,position,clue_number) do update set
 title=excluded.title,body=excluded.body,instruction=excluded.instruction,physical_location=excluded.physical_location,
 sticker_id=excluded.sticker_id,sticker_image_url=excluded.sticker_image_url,
 code_hash=case when nullif(trim(coalesce(p_code,'')),'') is null then public.convergence_position_assignments.code_hash else excluded.code_hash end,
 code_plaintext=case when nullif(trim(coalesce(p_code,'')),'') is null then public.convergence_position_assignments.code_plaintext else excluded.code_plaintext end,
 answer_hash=case when nullif(trim(coalesce(p_answer,'')),'') is null then public.convergence_position_assignments.answer_hash else excluded.answer_hash end,
 answer_plaintext=case when nullif(trim(coalesce(p_answer,'')),'') is null then public.convergence_position_assignments.answer_plaintext else excluded.answer_plaintext end,
 metadata=excluded.metadata,published=excluded.published,updated_at=clock_timestamp()
 returning id into rid;
 return rid;
end $$;
revoke execute on function public.convergence_admin_upsert_position_assignment(text,integer,integer,integer,text,text,text,text,uuid,text,text,text,jsonb,boolean) from public,anon;
grant execute on function public.convergence_admin_upsert_position_assignment(text,integer,integer,integer,text,text,text,text,uuid,text,text,text,jsonb,boolean) to authenticated;

create or replace function public.convergence_admin_list_position_assignments(p_track_id text default null,p_stage_group integer default null,p_position integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
 return coalesce((select jsonb_agg(to_jsonb(x) order by x.track_id,x.stage_group,x.position,x.clue_number)
 from(select id,track_id,stage_group,position,clue_number,title,body,instruction,physical_location,sticker_id,sticker_image_url,code_plaintext,answer_plaintext,metadata,published
      from public.convergence_position_assignments
      where(p_track_id is null or track_id=p_track_id)and(p_stage_group is null or stage_group=p_stage_group)and(p_position is null or position=p_position))x),'[]'::jsonb);
end $$;
revoke execute on function public.convergence_admin_list_position_assignments(text,integer,integer) from public,anon;
grant execute on function public.convergence_admin_list_position_assignments(text,integer,integer) to authenticated;

create or replace function public.convergence_admin_list_checkpoint_review(p_checkpoint integer)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
 if p_checkpoint not in(1,2) then raise exception 'checkpoint must be 1 or 2'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
 'id',t.id,'name',t.name,'track_id',t.track_id,'original_team_number',t.original_team_number,'current_position',s.current_position,
 'status',s.status,'current_step',s.current_step,'current_clue',s.current_clue,
 'checkpoint_complete',case when p_checkpoint=1 then s.current_step='CHECKPOINT_1_WAIT' else s.current_step='CHECKPOINT_2_WAIT' end,
 'warnings',s.warnings) order by t.track_id,s.current_position nulls last,t.original_team_number,t.name)
 from public.teams t join public.convergence_team_state s on s.team_id=t.id
 where t.track_id in('A','B','C','D') and s.status<>'ELIMINATED'),'[]'::jsonb);
end $$;
revoke execute on function public.convergence_admin_list_checkpoint_review(integer) from public,anon;
grant execute on function public.convergence_admin_list_checkpoint_review(integer) to authenticated;

create or replace function public.convergence_admin_finalize_checkpoint(p_checkpoint integer,p_eliminated_team_ids jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.convergence_game_control%rowtype;ts timestamptz:=clock_timestamp();ids uuid[];track text;cnt integer;distinct_cnt integer;next_clue integer;next_step text;phase integer;
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
 if p_checkpoint not in(1,2) then raise exception 'checkpoint must be 1 or 2'; end if;
 if jsonb_typeof(p_eliminated_team_ids)<>'array' or jsonb_array_length(p_eliminated_team_ids)<>20 then raise exception 'select exactly 20 teams: 5 per track'; end if;
 ids:=array(select value::uuid from jsonb_array_elements_text(p_eliminated_team_ids));
 select count(distinct value::uuid) into distinct_cnt from jsonb_array_elements_text(p_eliminated_team_ids);
 if distinct_cnt<>20 then raise exception 'team selection contains duplicates'; end if;
 perform pg_advisory_xact_lock(hashtext('convergence-checkpoint-'||p_checkpoint::text));
 select * into g from public.convergence_game_control where id=1 for update;
 if(p_checkpoint=1 and g.current_stage<>1)or(p_checkpoint=2 and g.current_stage<>2)then raise exception 'game is not at the requested checkpoint stage';end if;
 if p_checkpoint=1 then
   if exists(select 1 from public.convergence_team_state s join public.teams t on t.id=s.team_id where t.track_id in('A','B','C','D') and s.status<>'ELIMINATED' and s.current_step<>'CHECKPOINT_1_WAIT') then raise exception 'all active teams must complete Clue 3 before Checkpoint 1';end if;
   next_clue:=4;next_step:='TRANSITION_1';phase:=2;
 else
   if exists(select 1 from public.convergence_team_state s join public.teams t on t.id=s.team_id where t.track_id in('A','B','C','D') and s.status<>'ELIMINATED' and s.current_step<>'CHECKPOINT_2_WAIT') then raise exception 'all active teams must complete Clue 6 before Checkpoint 2';end if;
   next_clue:=7;next_step:='TRANSITION_2';phase:=3;
 end if;
 foreach track in array array['A','B','C','D'] loop
   select count(*) into cnt from public.teams t where t.id=any(ids) and t.track_id=track;
   if cnt<>5 then raise exception 'checkpoint % requires exactly 5 eliminations in Track %',p_checkpoint,track;end if;
 end loop;
 select count(*) into cnt from public.convergence_team_state s where s.team_id=any(ids) and s.status<>'ELIMINATED';
 if cnt<>20 then raise exception 'all selected teams must be active';end if;
 insert into public.convergence_team_clue_history(team_id,stage_group,position_at_time,clue_number,status,event_type,assigned_at,completed_at,details)
 select s.team_id,case when p_checkpoint=1 then 1 else 2 end,s.current_position,case when p_checkpoint=1 then 3 else 6 end,s.status,'CHECKPOINT_REVIEW',ts,ts,jsonb_build_object('checkpoint',p_checkpoint)
 from public.convergence_team_state s where s.team_id=any(ids);
 update public.convergence_team_state set status='ELIMINATED',current_position=null,updated_at=ts,last_action_at=ts where team_id=any(ids);
 perform public.convergence_recalculate_track_positions('A');perform public.convergence_recalculate_track_positions('B');perform public.convergence_recalculate_track_positions('C');perform public.convergence_recalculate_track_positions('D');
 update public.convergence_team_state s set status='ACTIVE',current_step=next_step,current_clue=next_clue,current_sticker_id=null,paused_at=null,last_action_at=ts,updated_at=ts,
 checkpoint1_completed_at=case when p_checkpoint=1 then ts else s.checkpoint1_completed_at end,
 checkpoint2_completed_at=case when p_checkpoint=2 then ts else s.checkpoint2_completed_at end
 where s.status<>'ELIMINATED' and s.team_id in(select id from public.teams where track_id in('A','B','C','D'));
 update public.convergence_game_control set running=false,current_stage=case when p_checkpoint=1 then 2 else 3 end,stage_started_at=null,updated_at=ts where id=1;
 insert into public.convergence_team_clue_history(team_id,stage_group,position_at_time,clue_number,status,event_type,assigned_at,details)
 select s.team_id,phase,s.current_position,next_clue,s.status,'POSITION_REASSIGNED',ts,jsonb_build_object('checkpoint',p_checkpoint,'new_position',s.current_position)
 from public.convergence_team_state s where s.status='ACTIVE' and s.team_id in(select id from public.teams where track_id in('A','B','C','D'));
 perform public.convergence_audit_event(null,'CHECKPOINT_FINALIZED',case when p_checkpoint=1 then 1 else 2 end,case when p_checkpoint=1 then 'CHECKPOINT_1' else 'CHECKPOINT_2' end,jsonb_build_object('checkpoint',p_checkpoint,'eliminated_team_ids',p_eliminated_team_ids,'finalized_at',ts));
 return jsonb_build_object('ok',true,'checkpoint',p_checkpoint,'eliminated',20,'active',case when p_checkpoint=1 then 40 else 20 end,'next_stage',case when p_checkpoint=1 then 2 else 3 end,'timestamp',ts);
end $$;
revoke execute on function public.convergence_admin_finalize_checkpoint(integer,jsonb) from public,anon;
grant execute on function public.convergence_admin_finalize_checkpoint(integer,jsonb) to authenticated;

create or replace function public.convergence_admin_set_transition_riddle(p_checkpoint integer,p_riddle_text text,p_active boolean default true)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 insert into public.convergence_transition_riddles(checkpoint_number,riddle_text,active,updated_at)
 values(p_checkpoint,coalesce(p_riddle_text,''),p_active,clock_timestamp())
 on conflict(checkpoint_number) do update set riddle_text=excluded.riddle_text,active=excluded.active,updated_at=clock_timestamp();
end $$;
revoke execute on function public.convergence_admin_set_transition_riddle(integer,text,boolean) from public,anon;
grant execute on function public.convergence_admin_set_transition_riddle(integer,text,boolean) to authenticated;

create or replace function public.convergence_admin_get_transition_riddles()
returns jsonb language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(to_jsonb(r) order by checkpoint_number),'[]'::jsonb) from public.convergence_transition_riddles r; $$;
revoke execute on function public.convergence_admin_get_transition_riddles() from public,anon;
grant execute on function public.convergence_admin_get_transition_riddles() to authenticated;

create or replace function public.convergence_admin_set_common_clue9(p_title text,p_body text,p_instruction text,p_location text,p_code text,p_sticker_id uuid default null,p_sticker_image_url text default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 update public.convergence_game_control set common_clue9_title=coalesce(p_title,'CLUE 9 — COMMON TREASURE'),common_clue9_body=coalesce(p_body,''),common_clue9_instruction=coalesce(p_instruction,''),common_clue9_location=nullif(p_location,''),
 common_clue9_code_hash=case when nullif(trim(coalesce(p_code,'')),'') is null then common_clue9_code_hash else extensions.crypt(trim(p_code),extensions.gen_salt('bf')) end,
 common_clue9_code_plaintext=case when nullif(trim(coalesce(p_code,'')),'') is null then common_clue9_code_plaintext else nullif(p_code,'') end,
 common_clue9_sticker_id=p_sticker_id,common_clue9_sticker_image_url=nullif(p_sticker_image_url,''),updated_at=clock_timestamp()
 where id=1;
end $$;
revoke execute on function public.convergence_admin_set_common_clue9(text,text,text,text,text,uuid,text) from public,anon;
grant execute on function public.convergence_admin_set_common_clue9(text,text,text,text,text,uuid,text) to authenticated;

create or replace function public.convergence_admin_list_stickers()
returns jsonb language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(to_jsonb(s) order by stage_group,clue_number,sticker_name),'[]'::jsonb) from public.convergence_stickers s; $$;
revoke execute on function public.convergence_admin_list_stickers() from public,anon;
grant execute on function public.convergence_admin_list_stickers() to authenticated;

create or replace function public.convergence_admin_create_sticker(p_sticker_name text,p_image_url text,p_clue_number integer,p_stage_group integer,p_active boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.convergence_stickers%rowtype;
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 insert into public.convergence_stickers(sticker_name,image_url,clue_number,stage_group,active,updated_at)
 values(coalesce(p_sticker_name,'Sticker'),nullif(p_image_url,''),p_clue_number,p_stage_group,p_active,clock_timestamp()) returning * into r;
 return to_jsonb(r);
end $$;
revoke execute on function public.convergence_admin_create_sticker(text,text,integer,integer,boolean) from public,anon;
grant execute on function public.convergence_admin_create_sticker(text,text,integer,integer,boolean) to authenticated;

create or replace function public.convergence_admin_get_team_history(p_team_id uuid)
returns jsonb language sql security definer set search_path='' as $$ select coalesce(jsonb_agg(to_jsonb(h) order by h.assigned_at,h.id),'[]'::jsonb) from public.convergence_team_clue_history h where h.team_id=p_team_id; $$;
revoke execute on function public.convergence_admin_get_team_history(uuid) from public,anon;
grant execute on function public.convergence_admin_get_team_history(uuid) to authenticated;

create or replace function public.convergence_client_state(p_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid;t public.teams%rowtype;s public.convergence_team_state%rowtype;g public.convergence_game_control%rowtype;a public.convergence_position_assignments%rowtype;p public.convergence_team_pairs%rowtype;r public.convergence_transition_riddles%rowtype;ts timestamptz:=clock_timestamp();phase integer;clue integer;content jsonb;
begin
 tid:=public.convergence_team_from_token(p_token);if tid is null then return null;end if;
 select * into t from public.teams where id=tid;select * into s from public.convergence_team_state where team_id=tid;select * into g from public.convergence_game_control where id=1;
 if g.buffer_active and g.buffer_ends_at is not null and ts>=g.buffer_ends_at then update public.convergence_game_control set buffer_active=false,buffer_ends_at=null,updated_at=ts where id=1 and buffer_active=true;select * into g from public.convergence_game_control where id=1;end if;
 clue:=coalesce(s.current_clue,9);phase:=case when clue between 1 and 3 then 1 when clue between 4 and 6 then 2 else 3 end;
 if s.current_step='TRANSITION_1' then select * into r from public.convergence_transition_riddles where checkpoint_number=1 and active=true;content:=jsonb_build_object('step',s.current_step,'title','CHECKPOINT 1 · TRANSITION RIDDLE','body',coalesce(r.riddle_text,''),'instruction','Solve the transition riddle, then proceed to Clue 4.');
 elsif s.current_step='TRANSITION_2' then select * into r from public.convergence_transition_riddles where checkpoint_number=2 and active=true;content:=jsonb_build_object('step',s.current_step,'title','CHECKPOINT 2 · TRANSITION RIDDLE','body',coalesce(r.riddle_text,''),'instruction','Solve the transition riddle, then proceed to Clue 7.');
 elsif s.current_step='CLUE_9' then content:=jsonb_build_object('step','CLUE_9','title',g.common_clue9_title,'body',g.common_clue9_body,'instruction',g.common_clue9_instruction,'physical_location',g.common_clue9_location,'sticker_image_url',g.common_clue9_sticker_image_url);
 elsif s.current_step='CLUE_8' then select * into p from public.convergence_team_pairs where team_id=tid;content:=jsonb_build_object('step','CLUE_8','title','CLUE 8 · PAIRED','body',coalesce(p.logical_clue,''),'instruction','Complete the paired clue and proceed when ready.','physical_location',p.physical_location,'sticker_image_url',p.sticker_image_url);
 else select * into a from public.convergence_position_assignments where track_id=t.track_id and stage_group=phase and position=s.current_position and clue_number=clue and published=true limit 1;content:=jsonb_build_object('step',s.current_step,'title',coalesce(a.title,''),'body',coalesce(a.body,''),'instruction',coalesce(a.instruction,''),'sticker_image_url',a.sticker_image_url,'physical_location',a.physical_location);
 end if;
 return jsonb_build_object('team_id',t.id,'name',t.name,'track_id',t.track_id,'status',s.status,'stage',g.current_stage,'step',s.current_step,'warnings',s.warnings,'game_running',g.running,'stage_started_at',g.stage_started_at,'started_at',s.started_at,'paused_at',s.paused_at,'completed_at',s.completed_at,'buffer_active',g.buffer_active,'buffer_started_at',g.buffer_started_at,'buffer_ends_at',g.buffer_ends_at,'server_now',ts,'current_position',s.current_position,'current_clue',clue,'current_sticker_id',s.current_sticker_id,'content',content);
end $$;
revoke execute on function public.convergence_client_state(text) from public;
grant execute on function public.convergence_client_state(text) to anon,authenticated;

-- The existing rate-limit wrapper calls this function; the state machine below is position based.
create or replace function public.verify_convergence_action_core_legacy(p_token text,p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare tid uuid;t public.teams%rowtype;s public.convergence_team_state%rowtype;g public.convergence_game_control%rowtype;a public.convergence_position_assignments%rowtype;cp public.convergence_checkpoints%rowtype;ts timestamptz:=clock_timestamp();next_step text;clue integer;phase integer;n integer;sticker uuid;
begin
 tid:=public.convergence_team_from_token(p_token);if tid is null then return jsonb_build_object('ok',false,'reason','invalid_session');end if;
 select * into t from public.teams where id=tid;select * into s from public.convergence_team_state where team_id=tid for update;select * into g from public.convergence_game_control where id=1;
 if g.buffer_active and g.buffer_ends_at is not null and ts>=g.buffer_ends_at then update public.convergence_game_control set buffer_active=false,buffer_ends_at=null,updated_at=ts where id=1 and buffer_active=true;select * into g from public.convergence_game_control where id=1;end if;
 if s.status in('ELIMINATED','WINNER') then return jsonb_build_object('ok',false,'reason',lower(s.status));end if;
 if g.buffer_active then return jsonb_build_object('ok',false,'reason','buffer_period','buffer_ends_at',g.buffer_ends_at,'server_now',ts);end if;
 if not g.running then return jsonb_build_object('ok',false,'reason','game_paused');end if;

 if s.current_step='HAND_IN' and p_action='ACK_HANDIN' then next_step:='STICKER_1';clue:=1;
 elsif s.current_step in('TRANSITION_1','TRANSITION_2') and p_action='ACK_TRANSITION' then next_step:=case s.current_step when 'TRANSITION_1' then 'RIDDLE_4' else 'RIDDLE_7' end;clue:=case s.current_step when 'TRANSITION_1' then 4 else 7 end;
 elsif s.current_step in('RIDDLE_4','RIDDLE_7') and p_action='ACK_RIDDLE' then next_step:=case s.current_step when 'RIDDLE_4' then 'STICKER_4' else 'STICKER_7' end;clue:=case s.current_step when 'RIDDLE_4' then 4 else 7 end;
 elsif s.current_step='CLUE_8' and p_action='ACK_CLUE_8' then next_step:='CLUE_9';clue:=9;
 elsif s.current_step like 'STICKER_%' and p_action='STICKER_CODE' then
   clue:=case s.current_step when 'STICKER_1' then 1 when 'STICKER_2' then 2 when 'STICKER_4' then 4 when 'STICKER_5' then 5 when 'STICKER_7' then 7 else 0 end;
   phase:=case when clue<=3 then 1 when clue<=6 then 2 else 3 end;
   select * into a from public.convergence_position_assignments where track_id=t.track_id and stage_group=phase and position=s.current_position and clue_number=clue and published=true limit 1;
   if clue=0 or a.id is null or a.code_hash is null or a.code_hash<>extensions.crypt(trim(coalesce(p_value,'')),a.code_hash) then return jsonb_build_object('ok',false,'reason','incorrect');end if;
   next_step:=case clue when 1 then 'STICKER_2' when 2 then 'ANSWER_2' when 4 then 'STICKER_5' when 5 then 'ANSWER_5' when 7 then 'CLUE_8' end;
 elsif s.current_step in('ANSWER_2','ANSWER_5') and p_action='ANSWER' then
   clue:=case s.current_step when 'ANSWER_2' then 2 else 5 end;phase:=case when clue<=3 then 1 else 2 end;
   select * into a from public.convergence_position_assignments where track_id=t.track_id and stage_group=phase and position=s.current_position and clue_number=clue and published=true limit 1;
   if a.id is null or a.answer_hash is null or a.answer_hash<>extensions.crypt(trim(coalesce(p_value,'')),a.answer_hash) then return jsonb_build_object('ok',false,'reason','incorrect');end if;
   next_step:=case clue when 2 then 'CHECKPOINT_1_QR' else 'CHECKPOINT_2_QR' end;clue:=clue+1;
 elsif s.current_step in('CHECKPOINT_1_QR','CHECKPOINT_2_QR') and p_action='CHECKPOINT_QR' then
   select * into cp from public.convergence_checkpoints where stage=case when s.current_step='CHECKPOINT_1_QR' then 3 else 6 end and track_id=t.track_id and active=true limit 1;
   if cp.id is null or cp.qr_token_hash<>extensions.crypt(trim(coalesce(p_value,'')),cp.qr_token_hash) then return jsonb_build_object('ok',false,'reason','incorrect');end if;
   next_step:=case s.current_step when 'CHECKPOINT_1_QR' then 'CHECKPOINT_1_CODE' else 'CHECKPOINT_2_CODE' end;clue:=case s.current_step when 'CHECKPOINT_1_QR' then 3 else 6 end;
 elsif s.current_step in('CHECKPOINT_1_CODE','CHECKPOINT_2_CODE') and p_action='CHECKPOINT_CODE' then
   select * into cp from public.convergence_checkpoints where stage=case when s.current_step='CHECKPOINT_1_CODE' then 3 else 6 end and track_id=t.track_id and active=true limit 1;
   if cp.id is null or cp.checkpoint_code_hash<>extensions.crypt(trim(coalesce(p_value,'')),cp.checkpoint_code_hash) then return jsonb_build_object('ok',false,'reason','incorrect');end if;
   next_step:=case s.current_step when 'CHECKPOINT_1_CODE' then 'SNIPPET_1' else 'SNIPPET_2' end;clue:=case s.current_step when 'CHECKPOINT_1_CODE' then 3 else 6 end;
   return jsonb_build_object('ok',true,'next_step',next_step,'snippet',cp.snippet,'timestamp',ts,'server_now',ts);
 elsif s.current_step in('SNIPPET_1','SNIPPET_2') and p_action='SNIPPET' then
   select * into cp from public.convergence_checkpoints where stage=case when s.current_step='SNIPPET_1' then 3 else 6 end and track_id=t.track_id and active=true limit 1;
   if cp.id is null or cp.snippet_answer_hash<>extensions.crypt(trim(coalesce(p_value,'')),cp.snippet_answer_hash) then return jsonb_build_object('ok',false,'reason','incorrect');end if;
   next_step:=case s.current_step when 'SNIPPET_1' then 'CHECKPOINT_1_WAIT' else 'CHECKPOINT_2_WAIT' end;clue:=case s.current_step when 'SNIPPET_1' then 3 else 6 end;
   update public.convergence_team_state set current_step=next_step,current_clue=clue,status='PAUSED',paused_at=ts,last_action_at=ts,updated_at=ts where team_id=tid;
   perform public.convergence_record_clue_history(tid,case when clue=3 then 1 else 2 end,s.current_position,clue,null,'PAUSED','CLUE_COMPLETED',ts,jsonb_build_object('checkpoint_wait',true));
   if not exists(select 1 from public.convergence_team_state s2 join public.teams t2 on t2.id=s2.team_id where t2.track_id in('A','B','C','D') and s2.status<>'ELIMINATED' and s2.current_step<>next_step) then update public.convergence_game_control set running=false,updated_at=ts where id=1;end if;
   return jsonb_build_object('ok',true,'next_step',next_step,'status','PAUSED','timestamp',ts,'server_now',ts);
 elsif s.current_step='CLUE_9' and p_action='CLUE9_CODE' then
   if g.common_clue9_code_hash is null or g.common_clue9_code_hash<>extensions.crypt(trim(coalesce(p_value,'')),g.common_clue9_code_hash) then return jsonb_build_object('ok',false,'reason','incorrect');end if;
   perform pg_advisory_xact_lock(hashtext('convergence-clue9'));select count(*) into n from public.convergence_clue9_claims;
   if n>=10 then update public.convergence_team_state set status='ELIMINATED',last_action_at=ts,updated_at=ts where team_id=tid;return jsonb_build_object('ok',true,'status','ELIMINATED','timestamp',ts);end if;
   n:=n+1;insert into public.convergence_clue9_claims(team_id,claimed_at,rank) values(tid,ts,n) on conflict(team_id) do nothing;
   update public.convergence_team_state set clue9_rank=n,status='FINALIST',current_step='FINAL_RIDDLE',current_clue=9,last_action_at=ts,updated_at=ts where team_id=tid;
   perform public.convergence_record_clue_history(tid,3,s.current_position,9,g.common_clue9_sticker_id,'FINALIST','CLUE_9_CLAIMED',ts,jsonb_build_object('rank',n));
   return jsonb_build_object('ok',true,'status','FINALIST','rank',n,'timestamp',ts,'server_now',ts);
 elsif s.current_step='FINAL_RIDDLE' and p_action='FINAL_SUBMISSION' then
   if s.status<>'FINALIST' then return jsonb_build_object('ok',false,'reason','not_finalist');end if;
   perform pg_advisory_xact_lock(hashtext('convergence-treasure'));
   if exists(select 1 from public.convergence_team_state where status='WINNER') then return jsonb_build_object('ok',false,'reason','treasure_already_found');end if;
   update public.convergence_team_state set status='WINNER',current_step='TREASURE_FOUND',completed_at=ts,last_action_at=ts,updated_at=ts where team_id=tid;
   update public.convergence_game_control set running=false,updated_at=ts where id=1;
   perform public.convergence_record_clue_history(tid,3,s.current_position,9,g.common_clue9_sticker_id,'WINNER','TREASURE_FOUND',ts,jsonb_build_object('winner_timestamp',ts));
   return jsonb_build_object('ok',true,'status','WINNER','timestamp',ts,'server_now',ts);
 end if;
 if next_step is not null then
   if next_step='STICKER_2' or next_step='ANSWER_2' or next_step='CHECKPOINT_1_QR' then phase:=1;
   elsif next_step='STICKER_5' or next_step='ANSWER_5' or next_step='CHECKPOINT_2_QR' then phase:=2;
   else phase:=3; end if;
   if next_step in('STICKER_1','STICKER_4','STICKER_7','STICKER_2','STICKER_5') then
     select sticker_id into sticker from public.convergence_position_assignments where track_id=t.track_id and stage_group=phase and position=s.current_position and clue_number=coalesce(clue,s.current_clue) and published=true limit 1;
   end if;
   update public.convergence_team_state set current_step=next_step,current_clue=coalesce(clue,current_clue),current_sticker_id=sticker,last_action_at=ts,updated_at=ts where team_id=tid;
   perform public.convergence_record_clue_history(tid,phase,s.current_position,coalesce(clue,s.current_clue),sticker,s.status,'STEP_ADVANCED',null,jsonb_build_object('from',s.current_step,'to',next_step,'timestamp',ts));
   return jsonb_build_object('ok',true,'next_step',next_step,'timestamp',ts,'server_now',ts);
 end if;
 return jsonb_build_object('ok',false,'reason','incorrect');
end $$;
revoke execute on function public.verify_convergence_action_core_legacy(text,text,text) from public,anon,authenticated;
grant execute on function public.verify_convergence_action_core_legacy(text,text,text) to public;

create or replace function public.convergence_admin_set_game(p_stage integer,p_running boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp();old public.convergence_game_control%rowtype;
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 if p_stage not between 1 and 3 then raise exception 'stage must be 1, 2, or 3';end if;
 select * into old from public.convergence_game_control where id=1 for update;
 if p_running then
   update public.convergence_game_control set current_stage=p_stage,running=true,stage_started_at=case when old.current_stage=p_stage and old.running then old.stage_started_at else ts end,buffer_active=false,buffer_started_at=null,buffer_ends_at=null,updated_at=ts where id=1;
   if p_stage=1 and old.current_stage<>1 then update public.convergence_team_state set status='ACTIVE',current_step='HAND_IN',current_clue=1,paused_at=null,updated_at=ts where status not in('ELIMINATED','WINNER') and team_id in(select id from public.teams where track_id in('A','B','C','D'));end if;
   if p_stage=2 then update public.convergence_team_state set status='ACTIVE',paused_at=null,updated_at=ts where status<>'ELIMINATED' and current_step='TRANSITION_1';end if;
   if p_stage=3 then update public.convergence_team_state set status='ACTIVE',paused_at=null,updated_at=ts where status<>'ELIMINATED' and current_step='TRANSITION_2';end if;
   perform public.convergence_recalculate_track_positions('A');perform public.convergence_recalculate_track_positions('B');perform public.convergence_recalculate_track_positions('C');perform public.convergence_recalculate_track_positions('D');
 else update public.convergence_game_control set running=false,updated_at=ts where id=1;end if;
 return jsonb_build_object('ok',true,'stage',p_stage,'running',p_running,'server_now',ts);
end $$;
revoke execute on function public.convergence_admin_set_game(integer,boolean) from public,anon;
grant execute on function public.convergence_admin_set_game(integer,boolean) to authenticated;

create or replace function public.convergence_admin_get_dashboard(p_track_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp();
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 return jsonb_build_object('game',(select to_jsonb(g) from public.convergence_game_control g where id=1),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'track_id',t.track_id,'status',s.status,'stage',g.current_stage,'step',s.current_step,'warnings',s.warnings,'original_team_number',t.original_team_number,'current_position',s.current_position,'current_clue',s.current_clue,'stage3_rank',s.stage3_rank,'stage6_rank',s.stage6_rank,'clue9_rank',s.clue9_rank,'started_at',s.started_at,'completed_at',s.completed_at,'last_action_at',s.last_action_at,'checkpoint1_completed_at',s.checkpoint1_completed_at,'checkpoint2_completed_at',s.checkpoint2_completed_at) order by t.track_id,s.current_position nulls last,t.original_team_number,t.name)
 from public.teams t join public.convergence_team_state s on s.team_id=t.id cross join public.convergence_game_control g
 where(p_track_id is null or t.track_id=p_track_id)and(select private.organizer_can_access_track(t.track_id))),'[]'::jsonb));
end $$;
revoke execute on function public.convergence_admin_get_dashboard(text) from public,anon;
grant execute on function public.convergence_admin_get_dashboard(text) to authenticated;

create or replace function public.convergence_admin_reset_game()
returns jsonb language plpgsql security definer set search_path='' as $$
declare ts timestamptz:=clock_timestamp();
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 update public.convergence_game_control set current_stage=1,running=false,stage_started_at=null,buffer_active=false,buffer_started_at=null,buffer_ends_at=null,updated_at=ts where id=1;
 update public.teams set current_position=original_team_number where track_id in('A','B','C','D') and original_team_number is not null;
 update public.convergence_team_state s set current_step='HAND_IN',current_clue=1,status='WAITING',warnings=0,stage3_rank=null,stage6_rank=null,clue9_rank=null,started_at=null,paused_at=null,completed_at=null,last_action_at=null,current_position=t.current_position,current_sticker_id=null,checkpoint1_completed_at=null,checkpoint2_completed_at=null,updated_at=ts from public.teams t where t.id=s.team_id;
 delete from public.convergence_clue9_claims;delete from public.convergence_team_clue_history;
 return jsonb_build_object('ok',true,'server_now',ts);
end $$;
revoke execute on function public.convergence_admin_reset_game() from public,anon;
grant execute on function public.convergence_admin_reset_game() to authenticated;

insert into storage.buckets(id,name,public) values('convergence-stickers','convergence-stickers',true) on conflict(id) do update set public=true;
drop policy if exists "convergence stickers organizer upload" on storage.objects;
create policy "convergence stickers organizer upload" on storage.objects for insert to authenticated with check(bucket_id='convergence-stickers' and(select private.is_organizer()));
drop policy if exists "convergence stickers organizer update" on storage.objects;
create policy "convergence stickers organizer update" on storage.objects for update to authenticated using(bucket_id='convergence-stickers' and(select private.is_organizer())) with check(bucket_id='convergence-stickers' and(select private.is_organizer()));
drop policy if exists "convergence stickers organizer delete" on storage.objects;
create policy "convergence stickers organizer delete" on storage.objects for delete to authenticated using(bucket_id='convergence-stickers' and(select private.is_organizer()));


create or replace function public.reset_global_hunt() returns boolean
language plpgsql security definer set search_path=''
as $$
declare ts timestamptz:=clock_timestamp();
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 update public.convergence_game_control set current_stage=1,running=false,stage_started_at=null,buffer_active=false,buffer_started_at=null,buffer_ends_at=null,updated_at=ts where id=1;
 update public.teams set current_position=original_team_number where track_id in('A','B','C','D') and original_team_number is not null;
 update public.convergence_team_state s set current_step='HAND_IN',current_clue=1,status='WAITING',warnings=0,stage3_rank=null,stage6_rank=null,clue9_rank=null,started_at=null,paused_at=null,completed_at=null,last_action_at=null,current_position=t.current_position,current_sticker_id=null,checkpoint1_completed_at=null,checkpoint2_completed_at=null,updated_at=ts from public.teams t where t.id=s.team_id;
 delete from public.convergence_clue9_claims;
 delete from public.convergence_team_clue_history;
 return true;
end $$;


create or replace function public.convergence_admin_move_team_position(p_team_id uuid,p_new_position integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare tr text;ids uuid[];idx integer;target integer;i integer;ts timestamptz:=clock_timestamp();tid uuid;
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 select t.track_id into tr from public.teams t join public.convergence_team_state s on s.team_id=t.id where t.id=p_team_id and s.status<>'ELIMINATED';
 if tr is null then raise exception 'team is not an active A-D team';end if;
 perform pg_advisory_xact_lock(hashtext('convergence-position-'||tr));
 select array_agg(s.team_id order by s.current_position,t.original_team_number,t.id) into ids from public.teams t join public.convergence_team_state s on s.team_id=t.id where t.track_id=tr and s.status<>'ELIMINATED';
 if p_new_position<1 or p_new_position>coalesce(array_length(ids,1),0) then raise exception 'position outside active track range';end if;
 idx:=array_position(ids,p_team_id);if idx is null then raise exception 'team not found in active order';end if;
 ids:=array_remove(ids,p_team_id);target:=least(p_new_position,array_length(ids,1)+1);
 if target=1 then ids:=array_prepend(p_team_id,ids);elsif target>array_length(ids,1) then ids:=array_append(ids,p_team_id);else ids:=ids[1:target-1]||array[p_team_id]::uuid[]||ids[target:];end if;
 for i in 1..array_length(ids,1) loop tid:=ids[i];update public.teams set current_position=i where id=tid;update public.convergence_team_state set current_position=i,updated_at=ts where team_id=tid;end loop;
 perform public.convergence_audit_event(p_team_id,'MANUAL_POSITION_OVERRIDE',null,tr,jsonb_build_object('new_position',p_new_position,'timestamp',ts));
 return jsonb_build_object('ok',true,'team_id',p_team_id,'track_id',tr,'position',p_new_position,'timestamp',ts);
end $$;
revoke execute on function public.convergence_admin_move_team_position(uuid,integer) from public,anon;
grant execute on function public.convergence_admin_move_team_position(uuid,integer) to authenticated;

create or replace function public.convergence_admin_restore_team(p_team_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare tr text;maxpos integer;phase integer;newclue integer;newstep text;ts timestamptz:=clock_timestamp();
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 select t.track_id into tr from public.teams t where t.id=p_team_id;
 if tr not in('A','B','C','D') then raise exception 'only A-D teams can be restored';end if;
 select coalesce(max(s.current_position),0)+1 into maxpos from public.teams t join public.convergence_team_state s on s.team_id=t.id where t.track_id=tr and s.status<>'ELIMINATED';
 select current_stage into phase from public.convergence_game_control where id=1;
 if phase=1 then newstep:='CHECKPOINT_1_WAIT';newclue:=3;elsif phase=2 then newstep:='TRANSITION_1';newclue:=4;else newstep:='TRANSITION_2';newclue:=7;end if;
 update public.teams set current_position=maxpos where id=p_team_id;
 update public.convergence_team_state set status='ACTIVE',current_position=maxpos,current_step=newstep,current_clue=newclue,current_sticker_id=null,paused_at=null,updated_at=ts where team_id=p_team_id;
 perform public.convergence_record_clue_history(p_team_id,phase,maxpos,newclue,null,'ACTIVE','ADMIN_RESTORE',null,jsonb_build_object('timestamp',ts));
 perform public.convergence_audit_event(p_team_id,'ADMIN_RESTORE_TEAM',phase,tr,jsonb_build_object('position',maxpos,'timestamp',ts));
 return jsonb_build_object('ok',true,'team_id',p_team_id,'position',maxpos,'step',newstep,'timestamp',ts);
end $$;
revoke execute on function public.convergence_admin_restore_team(uuid) from public,anon;
grant execute on function public.convergence_admin_restore_team(uuid) to authenticated;

create or replace function public.convergence_admin_reopen_checkpoint(p_checkpoint integer)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare ts timestamptz:=clock_timestamp();st integer;step text;clue integer;
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required';end if;
 if p_checkpoint not in(1,2) then raise exception 'checkpoint must be 1 or 2';end if;
 st:=case when p_checkpoint=1 then 1 else 2 end;step:=case when p_checkpoint=1 then 'CHECKPOINT_1_WAIT' else 'CHECKPOINT_2_WAIT' end;clue:=case when p_checkpoint=1 then 3 else 6 end;
 perform pg_advisory_xact_lock(hashtext('convergence-checkpoint-reopen-'||p_checkpoint::text));
 update public.convergence_game_control set current_stage=st,running=false,stage_started_at=null,updated_at=ts where id=1;
 update public.convergence_team_state set status='PAUSED',current_step=step,current_clue=clue,current_sticker_id=null,stage3_rank=null,stage6_rank=null,clue9_rank=null,paused_at=ts,updated_at=ts where team_id in(select id from public.teams where track_id in('A','B','C','D'));
 update public.teams set current_position=original_team_number where track_id in('A','B','C','D') and original_team_number is not null;
 perform public.convergence_recalculate_track_positions('A');perform public.convergence_recalculate_track_positions('B');perform public.convergence_recalculate_track_positions('C');perform public.convergence_recalculate_track_positions('D');
 if p_checkpoint=2 then delete from public.convergence_clue9_claims;end if;
 perform public.convergence_audit_event(null,'CHECKPOINT_REOPENED',p_checkpoint,case when p_checkpoint=1 then 'CHECKPOINT_1' else 'CHECKPOINT_2' end,jsonb_build_object('timestamp',ts));
 return jsonb_build_object('ok',true,'checkpoint',p_checkpoint,'stage',st,'running',false,'timestamp',ts);
end $$;
revoke execute on function public.convergence_admin_reopen_checkpoint(integer) from public,anon;
grant execute on function public.convergence_admin_reopen_checkpoint(integer) to authenticated;
