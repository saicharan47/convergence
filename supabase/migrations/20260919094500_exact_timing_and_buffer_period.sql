-- Exact server-side timing and organizer-controlled 20 minute buffer period.

alter table public.convergence_game_control
  add column if not exists buffer_active boolean not null default false,
  add column if not exists buffer_started_at timestamptz,
  add column if not exists buffer_ends_at timestamptz;

create or replace function public.convergence_admin_set_buffer(p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare ts timestamptz := clock_timestamp(); g public.convergence_game_control%rowtype;
begin
  if not (select private.is_organizer()) then raise exception 'organizer access required'; end if;
  if p_enabled then
    update public.convergence_game_control
    set running=false,buffer_active=true,buffer_started_at=ts,buffer_ends_at=ts+interval '20 minutes',updated_at=ts
    where id=1 returning * into g;
  else
    update public.convergence_game_control
    set running=false,buffer_active=false,buffer_ends_at=null,updated_at=ts
    where id=1 returning * into g;
  end if;
  return jsonb_build_object('ok',true,'buffer_active',g.buffer_active,'buffer_started_at',g.buffer_started_at,'buffer_ends_at',g.buffer_ends_at,'server_now',ts);
end;
$function$;

revoke all on function public.convergence_admin_set_buffer(boolean) from public;
revoke all on function public.convergence_admin_set_buffer(boolean) from anon;
grant execute on function public.convergence_admin_set_buffer(boolean) to authenticated;

-- All action timestamps use clock_timestamp() from the database transaction, not browser clocks.
-- The live function definitions are maintained in the database migration applied for this release.
