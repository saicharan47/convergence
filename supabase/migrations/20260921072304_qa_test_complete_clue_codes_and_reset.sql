-- QA-TEST complete nine-clue rehearsal data.
-- Stores only verification hashes in Git; plaintext physical codes are intentionally not committed.
-- Safe to re-run and only touches QA-TEST when it exists.

DO $$
DECLARE tid uuid; seq_id uuid;
BEGIN
  SELECT id INTO tid FROM public.teams WHERE name='QA-TEST' AND track_id='A' LIMIT 1;
  IF tid IS NULL THEN RETURN; END IF;

  INSERT INTO public.convergence_route_items
    (team_id,step_key,title,body,instruction,physical_location,code_hash,answer_hash,code_plaintext,answer_plaintext,metadata,published,updated_at)
  VALUES
    (tid,'HAND_IN','QA Hand-In','Find the marked QA envelope at the test table.','Tap I Found Clue 1 when you reach it.','QA TEST TABLE',NULL,NULL,NULL,NULL,'{"qa":true,"clue":1}',true,clock_timestamp()),
    (tid,'STICKER_1','Clue 1','QA physical Clue 1.','Enter the five-digit code from Clue 1.','QA CLUE 1','$2a$06$GtjFuTYQ.dbiD/xonWEDEu5Mf6ungrhqQQi8dOnQdQ6JuQFX1n3mW',NULL,NULL,NULL,'{"qa":true,"clue":1}',true,clock_timestamp()),
    (tid,'STICKER_2','Clue 2','QA physical Clue 2.','Enter the five-digit code from Clue 2.','QA CLUE 2','$2a$06$sKDgiSTOe6xHjV/nna3CF.OZXm1Q09IJKOyjEeCvDBfBjDeCSTZcW',NULL,NULL,NULL,'{"qa":true,"clue":2}',true,clock_timestamp()),
    (tid,'ANSWER_2','Clue 2 Answer','QA seven-digit answer.','Enter the seven-digit answer.','QA CLUE 2',NULL,'$2a$06$fMPflLz8..QQTh9UPzDumujaVe4ASUHXoZO1oM6yxtCAwpv7ozRg.',NULL,NULL,'{"qa":true,"clue":2}',true,clock_timestamp())
  ON CONFLICT (team_id,step_key) DO UPDATE SET
    title=excluded.title,body=excluded.body,instruction=excluded.instruction,physical_location=excluded.physical_location,
    code_hash=excluded.code_hash,answer_hash=excluded.answer_hash,code_plaintext=NULL,answer_plaintext=NULL,
    metadata=excluded.metadata,published=true,updated_at=clock_timestamp();

  INSERT INTO public.convergence_checkpoints
    (stage,track_id,qr_token_hash,checkpoint_code_hash,snippet,snippet_answer_hash,qr_label,active,qr_token_plaintext,checkpoint_code_plaintext,snippet_answer_plaintext,updated_at)
  VALUES
    (3,'A','$2a$06$LHx1DEet6Fsz72ayj96E0e.1EDevIbPb60uFbOUqIYSVPli36tcAC',
      '$2a$06$H9k6k37E3LgQe8htvjNJpuLdBGtFwnGPnkLThWm2fO1sGeCGLrrb.',
      'QA CHECKPOINT 1: What is the output of 6 x 7?',
      '$2a$06$Y0iQRFQKBEp83T6IAv.8DO/gQUDzd20pd.Kdbsz8vT9ybYj7AXh.i',
      'QA TRACK A · RED · CHECKPOINT 1',true,NULL,NULL,NULL,clock_timestamp())
  ON CONFLICT (stage,track_id) DO UPDATE SET
    qr_token_hash=excluded.qr_token_hash,checkpoint_code_hash=excluded.checkpoint_code_hash,
    snippet=excluded.snippet,snippet_answer_hash=excluded.snippet_answer_hash,qr_label=excluded.qr_label,
    active=true,qr_token_plaintext=NULL,checkpoint_code_plaintext=NULL,snippet_answer_plaintext=NULL,updated_at=clock_timestamp();

  INSERT INTO public.convergence_route_items
    (team_id,step_key,title,body,instruction,physical_location,code_hash,answer_hash,code_plaintext,answer_plaintext,metadata,published,updated_at)
  VALUES
    (tid,'RIDDLE_4','Clue 4 Riddle','QA Riddle 4: Find the next marked envelope.','Tap continue when solved.','QA CLUE 4',NULL,NULL,NULL,NULL,'{"qa":true,"clue":4}',true,clock_timestamp()),
    (tid,'STICKER_4','Clue 4','QA physical Clue 4.','Enter the five-digit code.','QA CLUE 4','$2a$06$UFcQHUTYQ9U.nvh4Dn.B8u.7ZS4fzuYNhoJinXBcY79WHBZI8bxsK',NULL,NULL,NULL,'{"qa":true,"clue":4}',true,clock_timestamp()),
    (tid,'STICKER_5','Clue 5','QA physical Clue 5.','Enter the five-digit code.','QA CLUE 5','$2a$06$9DXU3SFekieGHxBigmJA6uoAmh4jUY0vqb2nq7KVYR.5sM3mBxKhW',NULL,NULL,NULL,'{"qa":true,"clue":5}',true,clock_timestamp()),
    (tid,'ANSWER_5','Clue 5 Answer','QA seven-digit answer.','Enter the seven-digit answer.','QA CLUE 5',NULL,'$2a$06$36vAigabwhq.I/OAn8E6XOv/6nOYUUEyb4KYcYl2IX2Yg5FmEfx8y',NULL,NULL,'{"qa":true,"clue":5}',true,clock_timestamp()),
    (tid,'RIDDLE_7','Clue 7 Riddle','QA Riddle 7: Follow the final marked path.','Tap continue when solved.','QA CLUE 7',NULL,NULL,NULL,NULL,'{"qa":true,"clue":7}',true,clock_timestamp()),
    (tid,'STICKER_7','Clue 7','QA physical Clue 7.','Enter the five-digit code.','QA CLUE 7','$2a$06$3uvSTHHtfXSWNnh7JMdQuOiwHNfHf0ChUq.eIhJTPXLepd9RxDgLe',NULL,NULL,NULL,'{"qa":true,"clue":7}',true,clock_timestamp()),
    (tid,'CLUE_9','Clue 9','QA final qualifying clue.','Enter the five-digit Clue 9 code.','QA CLUE 9','$2a$06$rp7b0JACd01vyotTeLOnleLzTsCCyVquow4xMIq6QWNiZ2Ms1f6FO',NULL,NULL,NULL,'{"qa":true,"clue":9}',true,clock_timestamp())
  ON CONFLICT (team_id,step_key) DO UPDATE SET
    title=excluded.title,body=excluded.body,instruction=excluded.instruction,physical_location=excluded.physical_location,
    code_hash=excluded.code_hash,answer_hash=excluded.answer_hash,code_plaintext=NULL,answer_plaintext=NULL,
    metadata=excluded.metadata,published=true,updated_at=clock_timestamp();

  INSERT INTO public.convergence_checkpoints
    (stage,track_id,qr_token_hash,checkpoint_code_hash,snippet,snippet_answer_hash,qr_label,active,qr_token_plaintext,checkpoint_code_plaintext,snippet_answer_plaintext,updated_at)
  VALUES
    (6,'A','$2a$06$Me12iWe0n.aiHCqmF64phu3tMdMM6EJXWVf7v7dnNJNn/mTu9Deiq',
      '$2a$06$tWMF/KMl6rf1QBZhVzF7uuwwMWlna1YOqHWQkczJITnnGb4kq93iO',
      'QA CHECKPOINT 2: What is 12 x 7?',
      '$2a$06$B1Ct8H6bORNN6HHPy.jWTuXPi22o8boAsSfRzoJO2S6Qtr9tTagz6',
      'QA TRACK A · RED · CHECKPOINT 2',true,NULL,NULL,NULL,clock_timestamp())
  ON CONFLICT (stage,track_id) DO UPDATE SET
    qr_token_hash=excluded.qr_token_hash,checkpoint_code_hash=excluded.checkpoint_code_hash,
    snippet=excluded.snippet,snippet_answer_hash=excluded.snippet_answer_hash,qr_label=excluded.qr_label,
    active=true,qr_token_plaintext=NULL,checkpoint_code_plaintext=NULL,snippet_answer_plaintext=NULL,updated_at=clock_timestamp();

  INSERT INTO public.convergence_team_pairs(team_id,pair_key,logical_clue,physical_location,clue9_location,updated_at)
  VALUES(tid,'QA-PAIR-01','QA Clue 8: combine the two visible symbols at the marked location.','QA CLUE 8','QA CLUE 9',clock_timestamp())
  ON CONFLICT (team_id) DO UPDATE SET
    pair_key=excluded.pair_key,logical_clue=excluded.logical_clue,
    physical_location=excluded.physical_location,clue9_location=excluded.clue9_location,updated_at=clock_timestamp();

  SELECT id INTO seq_id FROM public.convergence_sequences WHERE name='QA-TEST-SEQUENCE' LIMIT 1;
  IF seq_id IS NULL THEN
    INSERT INTO public.convergence_sequences(name,payload,assigned_team_id,published,deleted_at,updated_at)
    VALUES('QA-TEST-SEQUENCE','{"items":[],"final_riddle":{"title":"Final Riddle","body":"QA final riddle"}}'::jsonb,tid,true,NULL,clock_timestamp());
  ELSE
    UPDATE public.convergence_sequences SET assigned_team_id=tid,published=true,deleted_at=NULL,updated_at=clock_timestamp() WHERE id=seq_id;
  END IF;

  DELETE FROM public.convergence_rate_limits WHERE team_id=tid;
  DELETE FROM public.convergence_anticheat_events WHERE team_id=tid;

  UPDATE public.convergence_team_state
  SET current_step='HAND_IN',status='ACTIVE',warnings=0,stage3_rank=NULL,stage6_rank=NULL,clue9_rank=NULL,
      paused_at=NULL,completed_at=NULL,started_at=coalesce(started_at,clock_timestamp()),
      last_action_at=clock_timestamp(),updated_at=clock_timestamp()
  WHERE team_id=tid;
END $$;
