-- Participant action verification uses the short-lived custom team token,
-- not a Supabase Auth user session. Keep the function out of PUBLIC while
-- allowing both anon and authenticated clients to call it with a valid token.
revoke execute on function public.verify_convergence_action_core(text,text,text) from public;
grant execute on function public.verify_convergence_action_core(text,text,text) to anon, authenticated;
