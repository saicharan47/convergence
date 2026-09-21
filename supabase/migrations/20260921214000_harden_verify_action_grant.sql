-- Harden participant action RPC privileges.
-- The preceding migration revoked EXECUTE from public/anon but accidentally
-- granted it back to PUBLIC. Keep the custom-token RPC callable by authenticated
-- participants only, and leave organizer/admin RPCs protected separately.
revoke execute on function public.verify_convergence_action_core(text,text,text) from public, anon;
grant execute on function public.verify_convergence_action_core(text,text,text) to authenticated;
