-- Convergence security hardening.
-- Organizer-only RPCs must never be callable by anonymous players.
revoke execute on function public.get_organizer_profile() from anon;
revoke execute on function public.get_organizer_overview(text) from anon;
revoke execute on function public.set_global_hunt_status(boolean) from anon;
revoke execute on function public.reset_global_hunt() from anon;
revoke execute on function public.set_track_hunt_status(text, boolean) from anon;
revoke execute on function public.set_track_schedule(text, timestamptz, timestamptz) from anon;
revoke execute on function public.manually_advance_clue(uuid) from anon;
revoke execute on function public.manually_rewind_clue(uuid) from anon;
revoke execute on function public.disqualify_team(uuid, boolean) from anon;
revoke execute on function public.reset_team_progress(uuid) from anon;

grant execute on function public.get_organizer_profile() to authenticated;
grant execute on function public.get_organizer_overview(text) to authenticated;
grant execute on function public.set_global_hunt_status(boolean) to authenticated;
grant execute on function public.reset_global_hunt() to authenticated;
grant execute on function public.set_track_hunt_status(text, boolean) to authenticated;
grant execute on function public.set_track_schedule(text, timestamptz, timestamptz) to authenticated;
grant execute on function public.manually_advance_clue(uuid) to authenticated;
grant execute on function public.manually_rewind_clue(uuid) to authenticated;
grant execute on function public.disqualify_team(uuid, boolean) to authenticated;
grant execute on function public.reset_team_progress(uuid) to authenticated;

-- Keep the existing direct organizer membership check functional while exposing only the signed-in user's own row.
drop policy if exists "organizers can read own membership" on public.organizers;
create policy "organizers can read own membership" on public.organizers
for select to authenticated using (user_id = auth.uid());
