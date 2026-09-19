-- Stage 4 can activate a promoted team only after an organizer has assigned its sequence.

CREATE OR REPLACE FUNCTION public.convergence_admin_set_game(p_stage integer, p_running boolean)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ts timestamptz := clock_timestamp();
  old_stage integer;
begin
  if not (select private.is_organizer()) then raise exception 'organizer access required'; end if;
  if p_stage not between 1 and 10 then raise exception 'invalid stage'; end if;

  select current_stage into old_stage
  from public.convergence_game_control
  where id = 1
  for update;

  update public.convergence_game_control
  set current_stage = p_stage,
      running = p_running,
      stage_started_at = case
        when p_running and (old_stage is distinct from p_stage or stage_started_at is null) then ts
        else stage_started_at
      end,
      buffer_active = case when p_running then false else buffer_active end,
      buffer_started_at = case when p_running then null else buffer_started_at end,
      buffer_ends_at = case when p_running then null else buffer_ends_at end,
      updated_at = ts
  where id = 1;

  if p_stage=1 and p_running then
    update public.convergence_team_state
    set status='ACTIVE',
        current_step='HAND_IN',
        started_at=coalesce(started_at,ts),
        updated_at=ts
    where status='WAITING';
  end if;

  if p_stage=4 and p_running then
    update public.convergence_team_state
    set status='ACTIVE',current_step='RIDDLE_4',updated_at=ts
    where status='PROMOTED'
      and current_step='STAGE_4_ASSIGNMENT'
      and exists (
        select 1 from public.convergence_sequences seq
        where seq.assigned_team_id = public.convergence_team_state.team_id
      );
  end if;

  if p_stage=7 and p_running then
    update public.convergence_team_state
    set status='ACTIVE',current_step='RIDDLE_7',updated_at=ts
    where status='PROMOTED' and current_step='STAGE_7';
  end if;

  return true;
end;
$function$
;
