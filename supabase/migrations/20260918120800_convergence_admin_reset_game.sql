-- Authoritative Convergence organizer reset.
-- Keeps participant sessions intact while resetting server-side hunt state.

create or replace function public.convergence_admin_reset_game()
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not (select private.is_organizer()) then
    raise exception 'organizer access required';
  end if;

  update public.convergence_game_control
  set current_stage = 1,
      running = false,
      stage_started_at = null,
      updated_at = now()
  where id = 1;

  update public.convergence_team_state
  set current_step = 'HAND_IN',
      status = 'WAITING',
      warnings = 0,
      stage3_rank = null,
      stage6_rank = null,
      clue9_rank = null,
      started_at = null,
      paused_at = null,
      completed_at = null,
      last_action_at = null,
      updated_at = now();

  return true;
end;
$function$;

revoke all on function public.convergence_admin_reset_game() from public;
revoke all on function public.convergence_admin_reset_game() from anon;
grant execute on function public.convergence_admin_reset_game() to authenticated;
