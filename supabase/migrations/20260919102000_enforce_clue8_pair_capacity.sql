-- A Clue 8 pair key may be assigned to at most two teams, atomically.

CREATE OR REPLACE FUNCTION public.convergence_admin_upsert_pair(p_team_id uuid, p_pair_key text, p_logical_clue text, p_sticker_image_url text, p_physical_location text, p_clue9_location text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare tr text; pair_count integer;
begin
 if not(select private.is_organizer()) then raise exception 'organizer access required'; end if;
 if nullif(trim(p_pair_key),'') is null then raise exception 'pair key required'; end if;
 perform pg_advisory_xact_lock(hashtext('convergence-pair-'||trim(p_pair_key)));
 select count(*) into pair_count from public.convergence_team_pairs
 where pair_key=trim(p_pair_key) and team_id<>p_team_id;
 if pair_count >= 2 then raise exception 'pair already has two teams'; end if;
 select track_id into tr from public.teams where id=p_team_id;
 if tr is null or not(select private.organizer_can_access_track(tr)) then raise exception 'team access denied'; end if;
 insert into public.convergence_team_pairs(team_id,pair_key,logical_clue,sticker_image_url,physical_location,clue9_location,updated_at)
 values(p_team_id,trim(p_pair_key),p_logical_clue,p_sticker_image_url,p_physical_location,p_clue9_location,now())
 on conflict(team_id) do update set pair_key=excluded.pair_key,logical_clue=excluded.logical_clue,sticker_image_url=excluded.sticker_image_url,physical_location=excluded.physical_location,clue9_location=excluded.clue9_location,updated_at=now();
 return true;
end $function$
;
