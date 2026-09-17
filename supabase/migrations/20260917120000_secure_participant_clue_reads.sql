-- Participant clue hardening.
-- Clue rows must not be directly enumerable by anonymous/authenticated clients.
-- Participants receive only their currently unlocked clue through a token-bound RPC.

drop policy if exists "public can read clues" on public.clues;
drop policy if exists "anon can read clues" on public.clues;
drop policy if exists "authenticated can read clues" on public.clues;

create or replace function public.get_team_current_clue(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.team_sessions%rowtype;
  t public.teams%rowtype;
  p public.team_progress%rowtype;
  c public.clues%rowtype;
  ts public.track_hunt_state%rowtype;
  hs public.hunt_state%rowtype;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return null;
  end if;

  select * into s
  from public.team_sessions
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and expires_at > now();
  if not found then return null; end if;

  select * into t from public.teams where id = s.team_id;
  select * into p from public.team_progress where team_id = t.id;
  select * into hs from public.hunt_state where id = 1;
  select * into ts from public.track_hunt_state where track_id = t.track_id;

  if not found or p.disqualified or p.current_clue < 1 or p.current_clue > 9
     or not coalesce(hs.started, false)
     or not coalesce(ts.enabled, false)
     or (ts.starts_at is not null and now() < ts.starts_at)
     or (ts.ends_at is not null and now() >= ts.ends_at) then
    return null;
  end if;

  select * into c
  from public.clues
  where track_id = t.track_id and clue_number = p.current_clue;
  if not found then return null; end if;

  return jsonb_build_object(
    'id', c.id,
    'track_id', c.track_id,
    'clue_number', c.clue_number,
    'title', c.title,
    'question', c.question,
    'instruction', c.instruction,
    'sticker_image_url', c.sticker_image_url,
    'clue_image_url', c.clue_image_url
  );
end;
$$;

revoke execute on function public.get_team_current_clue(text) from public;
grant execute on function public.get_team_current_clue(text) to anon, authenticated;
