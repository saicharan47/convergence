-- Convergence spec completion: admin content studio, secure realtime refresh,
-- explicit state-machine transitions, test fixture, and organizer tooling.
-- This migration is idempotent against the current production schema.

alter table public.convergence_route_items
  add column if not exists code_plaintext text,
  add column if not exists answer_plaintext text,
  add column if not exists published boolean not null default true;

alter table public.convergence_sequences
  add column if not exists published boolean not null default false,
  add column if not exists deleted_at timestamptz;

alter table public.convergence_checkpoints
  add column if not exists qr_label text,
  add column if not exists active boolean not null default true,
  add column if not exists qr_token_plaintext text,
  add column if not exists checkpoint_code_plaintext text,
  add column if not exists snippet_answer_plaintext text;

create index if not exists convergence_route_items_published_idx
  on public.convergence_route_items(team_id,published);
create index if not exists convergence_sequences_active_idx
  on public.convergence_sequences(published,deleted_at);

create or replace function public.convergence_admin_upsert_route_item(
  p_team_id uuid,p_step_key text,p_title text,p_body text,p_instruction text,
  p_sticker_image_url text,p_clue_image_url text,p_physical_location text,
  p_code text,p_answer text,p_metadata jsonb default '{}'::jsonb
) returns boolean language plpgsql security definer set search_path=''
as $function$
declare tr text;
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  select track_id into tr from public.teams where id=p_team_id;
  if tr is null or not(select private.organizer_can_access_track(tr)) then raise exception 'team access denied'; end if;
  insert into public.convergence_route_items(
    team_id,step_key,title,body,instruction,sticker_image_url,clue_image_url,physical_location,
    code_hash,answer_hash,code_plaintext,answer_plaintext,metadata,updated_at,published
  )
  values(
    p_team_id,trim(p_step_key),coalesce(p_title,''),coalesce(p_body,''),coalesce(p_instruction,''),
    p_sticker_image_url,p_clue_image_url,p_physical_location,
    case when nullif(trim(p_code),'') is null then null else extensions.crypt(trim(p_code),extensions.gen_salt('bf')) end,
    case when nullif(trim(p_answer),'') is null then null else extensions.crypt(trim(p_answer),extensions.gen_salt('bf')) end,
    nullif(trim(p_code),''),nullif(trim(p_answer),''),coalesce(p_metadata,'{}'),clock_timestamp(),true
  )
  on conflict(team_id,step_key) do update set
    title=excluded.title,body=excluded.body,instruction=excluded.instruction,
    sticker_image_url=excluded.sticker_image_url,clue_image_url=excluded.clue_image_url,
    physical_location=excluded.physical_location,
    code_hash=case when excluded.code_plaintext is null then convergence_route_items.code_hash else excluded.code_hash end,
    answer_hash=case when excluded.answer_plaintext is null then convergence_route_items.answer_hash else excluded.answer_hash end,
    code_plaintext=case when excluded.code_plaintext is null then convergence_route_items.code_plaintext else excluded.code_plaintext end,
    answer_plaintext=case when excluded.answer_plaintext is null then convergence_route_items.answer_plaintext else excluded.answer_plaintext end,
    metadata=excluded.metadata,updated_at=clock_timestamp(),published=true;
  return true;
end $function$;

create or replace function public.convergence_admin_get_route_item(p_team_id uuid,p_step_key text)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare r public.convergence_route_items%rowtype;
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  select * into r from public.convergence_route_items where team_id=p_team_id and step_key=trim(p_step_key);
  if r.team_id is null then return null; end if;
  return jsonb_build_object(
    'team_id',r.team_id,'step_key',r.step_key,'title',r.title,'body',r.body,'instruction',r.instruction,
    'sticker_image_url',r.sticker_image_url,'clue_image_url',r.clue_image_url,'physical_location',r.physical_location,
    'code',r.code_plaintext,'answer',r.answer_plaintext,'metadata',r.metadata,'published',r.published
  );
end $function$;

create or replace function public.convergence_admin_upsert_checkpoint(
  p_stage integer,p_track_id text,p_qr_token text,p_checkpoint_code text,p_snippet text,p_snippet_answer text,
  p_qr_label text default null,p_active boolean default true
) returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  if not(select private.organizer_can_access_track(p_track_id)) then raise exception 'organizer access required'; end if;
  insert into public.convergence_checkpoints(
    stage,track_id,qr_token_hash,checkpoint_code_hash,snippet,snippet_answer_hash,
    qr_label,active,qr_token_plaintext,checkpoint_code_plaintext,snippet_answer_plaintext,updated_at
  )
  values(
    p_stage,upper(trim(p_track_id)),
    extensions.crypt(trim(p_qr_token),extensions.gen_salt('bf')),
    extensions.crypt(trim(p_checkpoint_code),extensions.gen_salt('bf')),
    coalesce(p_snippet,''),extensions.crypt(trim(p_snippet_answer),extensions.gen_salt('bf')),
    nullif(trim(p_qr_label),''),p_active,
    nullif(trim(p_qr_token),''),nullif(trim(p_checkpoint_code),''),nullif(trim(p_snippet_answer),''),
    clock_timestamp()
  )
  on conflict(stage,track_id) do update set
    qr_token_hash=excluded.qr_token_hash,checkpoint_code_hash=excluded.checkpoint_code_hash,
    snippet=excluded.snippet,snippet_answer_hash=excluded.snippet_answer_hash,
    qr_label=excluded.qr_label,active=excluded.active,
    qr_token_plaintext=excluded.qr_token_plaintext,
    checkpoint_code_plaintext=excluded.checkpoint_code_plaintext,
    snippet_answer_plaintext=excluded.snippet_answer_plaintext,updated_at=clock_timestamp();
  return true;
end $function$;

create or replace function public.convergence_admin_list_checkpoints(p_stage integer default null,p_track_id text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',c.id,'stage',c.stage,'track_id',c.track_id,'qr_label',c.qr_label,'active',c.active,
      'qr_token',c.qr_token_plaintext,'checkpoint_code',c.checkpoint_code_plaintext,
      'snippet',c.snippet,'snippet_answer',c.snippet_answer_plaintext
    ) order by c.stage,c.track_id)
    from public.convergence_checkpoints c
    where (p_stage is null or c.stage=p_stage)
      and (p_track_id is null or c.track_id=p_track_id)
      and (select private.organizer_can_access_track(c.track_id))
  ),'[]'::jsonb);
end $function$;

drop function if exists public.convergence_admin_list_sequences();
create function public.convergence_admin_list_sequences()
returns table(id uuid,name text,payload jsonb,assigned_team_id uuid,published boolean)
language plpgsql security definer set search_path=''
as $function$
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  return query select s.id,s.name,s.payload,s.assigned_team_id,s.published
  from public.convergence_sequences s where s.deleted_at is null order by s.name;
end $function$;

create or replace function public.convergence_admin_delete_sequence(p_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  update public.convergence_sequences set deleted_at=clock_timestamp(),published=false,assigned_team_id=null,updated_at=clock_timestamp() where id=p_id;
  if not found then raise exception 'sequence not found'; end if;
  return true;
end $function$;

create or replace function public.convergence_admin_duplicate_sequence(p_id uuid,p_name text)
returns uuid language plpgsql security definer set search_path=''
as $function$
declare v_id uuid;
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  insert into public.convergence_sequences(name,payload,published,deleted_at)
  select trim(p_name),payload,false,null from public.convergence_sequences where id=p_id and deleted_at is null
  returning id into v_id;
  if v_id is null then raise exception 'sequence not found'; end if;
  return v_id;
end $function$;

create or replace function public.convergence_admin_publish_sequence(p_id uuid,p_published boolean)
returns boolean language plpgsql security definer set search_path=''
as $function$
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  update public.convergence_sequences set published=p_published,updated_at=clock_timestamp() where id=p_id and deleted_at is null;
  if not found then raise exception 'sequence not found'; end if;
  return true;
end $function$;

create or replace function public.convergence_admin_assign_sequence(p_team_id uuid,p_sequence_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $function$
declare tr text; item jsonb; seq_payload jsonb; seq_published boolean;
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  select track_id into tr from public.teams where id=p_team_id;
  if tr is null or not(select private.organizer_can_access_track(tr)) then raise exception 'team access denied'; end if;
  select payload,published into seq_payload,seq_published from public.convergence_sequences where id=p_sequence_id and deleted_at is null;
  if seq_payload is null then raise exception 'sequence not found'; end if;
  if not seq_published then raise exception 'sequence must be published before assignment'; end if;
  update public.convergence_sequences set assigned_team_id=null,updated_at=clock_timestamp() where assigned_team_id=p_team_id;
  update public.convergence_sequences set assigned_team_id=p_team_id,updated_at=clock_timestamp() where id=p_sequence_id;
  delete from public.convergence_route_items where team_id=p_team_id and step_key in('RIDDLE_4','STICKER_4','STICKER_5','ANSWER_5');
  for item in select value from jsonb_array_elements(coalesce(seq_payload->'items','[]')) loop
    perform public.convergence_admin_upsert_route_item(
      p_team_id,item->>'step_key',coalesce(item->>'title',''),coalesce(item->>'body',''),coalesce(item->>'instruction',''),
      item->>'sticker_image_url',item->>'clue_image_url',item->>'physical_location',
      item->>'code',item->>'answer',coalesce(item->'metadata','{}')
    );
  end loop;
  update public.convergence_team_state set current_step='STAGE_4_ASSIGNMENT',status='PROMOTED',updated_at=clock_timestamp()
  where team_id=p_team_id and status='PROMOTED';
  return true;
end $function$;

create or replace function public.convergence_admin_manual_team_action(p_team_id uuid,p_action text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare tr text; s public.convergence_team_state%rowtype; ts timestamptz:=clock_timestamp(); target_status text; target_step text;
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  select t.track_id into tr from public.teams t where t.id=p_team_id;
  if tr is null or not(select private.organizer_can_access_track(tr)) then raise exception 'team access denied'; end if;
  select * into s from public.convergence_team_state where team_id=p_team_id for update;
  if s.team_id is null then raise exception 'team state not found'; end if;
  case upper(trim(p_action))
    when 'PROMOTE' then target_status:='PROMOTED'; target_step:=case when s.stage6_rank is not null then 'STAGE_7' when s.stage3_rank is not null then 'STAGE_4_ASSIGNMENT' else s.current_step end;
    when 'ELIMINATE' then target_status:='ELIMINATED'; target_step:=s.current_step;
    when 'RESTORE' then target_status:=case when s.stage6_rank is not null then 'FINALIST' when s.stage3_rank is not null then 'PROMOTED' else 'WAITING' end; target_step:=case when s.stage6_rank is not null then 'FINAL_RIDDLE' when s.stage3_rank is not null then 'STAGE_4_ASSIGNMENT' else 'HAND_IN' end;
    when 'RESET' then target_status:='WAITING'; target_step:='HAND_IN';
    else raise exception 'unknown team action';
  end case;
  update public.convergence_team_state set status=target_status,current_step=target_step,warnings=case when upper(trim(p_action))='RESET' then 0 else warnings end,paused_at=case when target_status in('PROMOTED','PAUSED') then ts else paused_at end,last_action_at=ts,updated_at=ts where team_id=p_team_id;
  perform public.convergence_audit_event(p_team_id,'ADMIN_OVERRIDE',null,jsonb_build_object('action',upper(trim(p_action)),'reason',p_reason,'action_timestamp',ts,'from_status',s.status,'to_status',target_status));
  return jsonb_build_object('ok',true,'team_id',p_team_id,'status',target_status,'step',target_step,'timestamp',ts);
end $function$;

create or replace function public.convergence_admin_get_pairs()
returns jsonb language plpgsql security definer set search_path=''
as $function$
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'team_id',p.team_id,'team_name',t.name,'track_id',t.track_id,'pair_key',p.pair_key,
      'logical_clue',p.logical_clue,'sticker_image_url',p.sticker_image_url,
      'physical_location',p.physical_location,'clue9_location',p.clue9_location
    ) order by p.pair_key,t.name)
    from public.convergence_team_pairs p join public.teams t on t.id=p.team_id
    where (select private.organizer_can_access_track(t.track_id))
  ),'[]'::jsonb);
end $function$;

create or replace function public.convergence_admin_export_config()
returns jsonb language plpgsql security definer set search_path=''
as $function$
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  return jsonb_build_object(
    'version',1,'exported_at',clock_timestamp(),
    'tracks',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]') from public.tracks t where t.id in('A','B','C','D')),
    'routes',(select coalesce(jsonb_agg(jsonb_build_object('team_id',r.team_id,'step_key',r.step_key,'title',r.title,'body',r.body,'instruction',r.instruction,'sticker_image_url',r.sticker_image_url,'clue_image_url',r.clue_image_url,'physical_location',r.physical_location,'code',r.code_plaintext,'answer',r.answer_plaintext,'metadata',r.metadata,'published',r.published) order by r.team_id,r.step_key),'[]') from public.convergence_route_items r join public.teams t on t.id=r.team_id where t.track_id in('A','B','C','D')),
    'sequences',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'payload',s.payload,'assigned_team_id',s.assigned_team_id,'published',s.published) order by s.name),'[]') from public.convergence_sequences s where s.deleted_at is null),
    'checkpoints',(select coalesce(jsonb_agg(jsonb_build_object('stage',c.stage,'track_id',c.track_id,'qr_label',c.qr_label,'active',c.active,'qr_token',c.qr_token_plaintext,'checkpoint_code',c.checkpoint_code_plaintext,'snippet',c.snippet,'snippet_answer',c.snippet_answer_plaintext) order by c.stage,c.track_id),'[]') from public.convergence_checkpoints c where c.track_id in('A','B','C','D')),
    'pairs',(select coalesce(jsonb_agg(jsonb_build_object('team_id',p.team_id,'pair_key',p.pair_key,'logical_clue',p.logical_clue,'sticker_image_url',p.sticker_image_url,'physical_location',p.physical_location,'clue9_location',p.clue9_location) order by p.pair_key,p.team_id),'[]') from public.convergence_team_pairs p join public.teams t on t.id=p.team_id where t.track_id in('A','B','C','D'))
  );
end $function$;

create or replace function public.convergence_admin_import_config(p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare x jsonb; route_count integer:=0; checkpoint_count integer:=0; sequence_count integer:=0; pair_count integer:=0;
begin
  if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
  for x in select value from jsonb_array_elements(coalesce(p_payload->'routes','[]')) loop
    perform public.convergence_admin_upsert_route_item((x->>'team_id')::uuid,x->>'step_key',x->>'title',x->>'body',x->>'instruction',x->>'sticker_image_url',x->>'clue_image_url',x->>'physical_location',x->>'code',x->>'answer',coalesce(x->'metadata','{}'));
    route_count:=route_count+1;
  end loop;
  for x in select value from jsonb_array_elements(coalesce(p_payload->'checkpoints','[]')) loop
    perform public.convergence_admin_upsert_checkpoint((x->>'stage')::integer,x->>'track_id',x->>'qr_token',x->>'checkpoint_code',x->>'snippet',x->>'snippet_answer',x->>'qr_label',coalesce((x->>'active')::boolean,true));
    checkpoint_count:=checkpoint_count+1;
  end loop;
  for x in select value from jsonb_array_elements(coalesce(p_payload->'sequences','[]')) loop
    if nullif(x->>'id','') is null then perform public.convergence_admin_upsert_sequence(null,x->>'name',coalesce(x->'payload','{}')); else perform public.convergence_admin_upsert_sequence((x->>'id')::uuid,x->>'name',coalesce(x->'payload','{}')); end if;
    sequence_count:=sequence_count+1;
  end loop;
  for x in select value from jsonb_array_elements(coalesce(p_payload->'pairs','[]')) loop
    perform public.convergence_admin_upsert_pair((x->>'team_id')::uuid,x->>'pair_key',x->>'logical_clue',x->>'sticker_image_url',x->>'physical_location',x->>'clue9_location');
    pair_count:=pair_count+1;
  end loop;
  return jsonb_build_object('routes',route_count,'checkpoints',checkpoint_count,'sequences',sequence_count,'pairs',pair_count);
end $function$;

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
  end if;
  perform public.convergence_admin_upsert_route_item(tid,'HAND_IN','Test Hand-In','Find the blue envelope at the test table.','Press "I found Clue 1" after reaching it.',null,null,'TEST TABLE',null,null,'{"test":true}');
  perform public.convergence_admin_upsert_route_item(tid,'STICKER_1','Test Sticker 1','A five-digit lock.','Enter 24680.',null,null,'TEST TABLE','24680',null,'{"test":true}');
  perform public.convergence_admin_upsert_route_item(tid,'STICKER_2','Test Sticker 2','Second lock.','Enter 13579.',null,null,'TEST TABLE','13579',null,'{"test":true}');
  perform public.convergence_admin_upsert_route_item(tid,'ANSWER_2','Test 7-Digit Answer','Test answer.','Enter 1234567.',null,null,'TEST TABLE',null,'1234567','{"test":true}');
  update public.convergence_team_state set current_step='HAND_IN',status='ACTIVE',warnings=0,last_action_at=ts,updated_at=ts where team_id=tid;
  return jsonb_build_object('ok',true,'team_id',tid,'team_name','TEST TEAM','password','convergence-test');
end $function$;

create or replace function public.verify_convergence_action(p_token text,p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path=''
as $function$
begin
  return public.verify_convergence_action_core(p_token,p_action,p_value);
end $function$;

-- Keep participant state server-side and prevent future/unpublished route leakage.
create or replace function public.convergence_client_state(p_token text)
returns jsonb language plpgsql security definer set search_path='public','extensions'
as $function$
declare tid uuid; t public.teams%rowtype; s public.convergence_team_state%rowtype; g public.convergence_game_control%rowtype;
r public.convergence_route_items%rowtype; r1 public.convergence_route_items%rowtype; pair public.convergence_team_pairs%rowtype;
cp public.convergence_checkpoints%rowtype; content jsonb; seq jsonb; ts timestamptz:=clock_timestamp();
begin
  tid:=public.convergence_team_from_token(p_token); if tid is null then return null; end if;
  select * into t from public.teams where id=tid;
  select * into s from public.convergence_team_state where team_id=tid;
  select * into g from public.convergence_game_control where id=1;
  if g.buffer_active and g.buffer_ends_at is not null and ts>=g.buffer_ends_at then
    update public.convergence_game_control set buffer_active=false,buffer_ends_at=null,updated_at=ts where id=1 and buffer_active=true;
    select * into g from public.convergence_game_control where id=1;
  end if;
  if s.status='WAITING' and g.running then
    update public.convergence_team_state set status='ACTIVE',started_at=coalesce(started_at,ts),updated_at=ts where team_id=tid returning * into s;
  end if;
  if s.status in('ELIMINATED','WINNER') then
    return jsonb_build_object('team_id',t.id,'name',t.name,'track_id',t.track_id,'status',s.status,'stage',g.current_stage,'step',s.current_step,'warnings',s.warnings,'game_running',g.running,'stage_started_at',g.stage_started_at,'started_at',s.started_at,'paused_at',s.paused_at,'completed_at',s.completed_at,'buffer_active',g.buffer_active,'buffer_started_at',g.buffer_started_at,'buffer_ends_at',g.buffer_ends_at,'server_now',ts);
  end if;
  select * into r from public.convergence_route_items where team_id=tid and step_key=s.current_step and published=true;
  if r.team_id is not null then
    content:=jsonb_build_object('step',r.step_key,'title',r.title,'body',r.body,'instruction',r.instruction,'sticker_image_url',r.sticker_image_url,'clue_image_url',r.clue_image_url,'physical_location',r.physical_location,'metadata',r.metadata);
  end if;
  if s.current_step='HAND_IN' then
    select * into r1 from public.convergence_route_items where team_id=tid and step_key='HAND_IN' and published=true;
    if r1.team_id is not null then content:=jsonb_build_object('step','HAND_IN','title',r1.title,'body',r1.body,'instruction',r1.instruction,'sticker_image_url',r1.sticker_image_url,'clue_image_url',r1.clue_image_url,'physical_location',r1.physical_location,'metadata',r1.metadata); end if;
  end if;
  if s.current_step in('SNIPPET_1','SNIPPET_2') then
    select * into cp from public.convergence_checkpoints where stage=case when s.current_step='SNIPPET_1' then 3 else 6 end and track_id=t.track_id and active=true;
    if cp.id is not null then content=jsonb_build_object('step',s.current_step,'title','Code Snippet','body',cp.snippet); end if;
  end if;
  select * into pair from public.convergence_team_pairs where team_id=tid;
  if s.current_step='CLUE_8' and pair.team_id is not null then content=jsonb_build_object('step','CLUE_8','title','Clue 8','body',pair.logical_clue,'sticker_image_url',pair.sticker_image_url,'physical_location',pair.physical_location,'pair_key',pair.pair_key); end if;
  if s.current_step='CLUE_9' then
    select * into r1 from public.convergence_route_items where team_id=tid and step_key='CLUE_9' and published=true;
    if r1.team_id is not null then content=jsonb_build_object('step','CLUE_9','title',r1.title,'body',r1.body,'instruction',r1.instruction,'clue_image_url',r1.clue_image_url,'physical_location',r1.physical_location,'metadata',r1.metadata); end if;
  end if;
  if s.current_step='FINAL_RIDDLE' then
    select payload into seq from public.convergence_sequences where assigned_team_id=tid and deleted_at is null limit 1;
    content=coalesce(seq->'final_riddle',content);
  end if;
  return jsonb_build_object('team_id',t.id,'name',t.name,'track_id',t.track_id,'status',s.status,'stage',g.current_stage,'step',s.current_step,'warnings',s.warnings,'game_running',g.running,'stage_started_at',g.stage_started_at,'started_at',s.started_at,'paused_at',s.paused_at,'completed_at',s.completed_at,'buffer_active',g.buffer_active,'buffer_started_at',g.buffer_started_at,'buffer_ends_at',g.buffer_ends_at,'server_now',ts,'content',content);
exception when others then
  select * into t from public.teams where id=tid; select * into s from public.convergence_team_state where team_id=tid; select * into g from public.convergence_game_control where id=1;
  if t.id is null or s.team_id is null or g.id is null then return null; end if;
  return jsonb_build_object('team_id',t.id,'name',t.name,'track_id',t.track_id,'status',s.status,'stage',g.current_stage,'step',s.current_step,'warnings',s.warnings,'game_running',g.running,'stage_started_at',g.stage_started_at,'started_at',s.started_at,'paused_at',s.paused_at,'completed_at',s.completed_at,'buffer_active',coalesce(g.buffer_active,false),'buffer_started_at',g.buffer_started_at,'buffer_ends_at',g.buffer_ends_at,'server_now',clock_timestamp(),'content',null);
end $function$;

drop trigger if exists convergence_team_state_realtime on public.convergence_team_state;
create or replace function public.convergence_team_state_realtime()
returns trigger language plpgsql security definer set search_path=''
as $function$
declare session_row record;
begin
  for session_row in select realtime_key from public.team_sessions where team_id=coalesce(new.team_id,old.team_id) and expires_at>clock_timestamp()
  loop
    perform realtime.send(
      jsonb_build_object('team_id',coalesce(new.team_id,old.team_id),'updated_at',clock_timestamp()),
      'state_changed','convergence:team:'||session_row.realtime_key,false
    );
  end loop;
  return coalesce(new,old);
end $function$;
create trigger convergence_team_state_realtime after insert or update or delete on public.convergence_team_state
for each row execute function public.convergence_team_state_realtime();

revoke execute on function public.convergence_admin_import_config(jsonb) from public,anon;
revoke execute on function public.convergence_admin_get_pairs() from public,anon;
revoke execute on function public.convergence_admin_list_checkpoints(integer,text) from public,anon;
revoke execute on function public.convergence_admin_delete_sequence(uuid) from public,anon;
revoke execute on function public.convergence_admin_duplicate_sequence(uuid,text) from public,anon;
revoke execute on function public.convergence_admin_publish_sequence(uuid,boolean) from public,anon;
revoke execute on function public.convergence_admin_manual_team_action(uuid,text,text) from public,anon;
revoke execute on function public.convergence_admin_export_config() from public,anon;
revoke execute on function public.convergence_admin_test_fixture() from public,anon;
grant execute on function public.convergence_admin_import_config(jsonb) to authenticated;
grant execute on function public.convergence_admin_get_pairs() to authenticated;
grant execute on function public.convergence_admin_list_checkpoints(integer,text) to authenticated;
grant execute on function public.convergence_admin_delete_sequence(uuid) to authenticated;
grant execute on function public.convergence_admin_duplicate_sequence(uuid,text) to authenticated;
grant execute on function public.convergence_admin_publish_sequence(uuid,boolean) to authenticated;
grant execute on function public.convergence_admin_manual_team_action(uuid,text,text) to authenticated;
grant execute on function public.convergence_admin_export_config() to authenticated;
grant execute on function public.convergence_admin_test_fixture() to authenticated;
