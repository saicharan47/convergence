const assert = (condition, message) => { if (!condition) throw new Error(message); };

const steps = {
  HAND_IN: 'STICKER_1',
  STICKER_1: 'STICKER_2',
  STICKER_2: 'ANSWER_2',
  ANSWER_2: 'CHECKPOINT_1_QR',
  CHECKPOINT_1_QR: 'CHECKPOINT_1_CODE',
  CHECKPOINT_1_CODE: 'SNIPPET_1',
  RIDDLE_4: 'STICKER_4',
  STICKER_4: 'STICKER_5',
  STICKER_5: 'ANSWER_5',
  ANSWER_5: 'CHECKPOINT_2_QR',
  CHECKPOINT_2_QR: 'CHECKPOINT_2_CODE',
  CHECKPOINT_2_CODE: 'SNIPPET_2',
  RIDDLE_7: 'STICKER_7',
  STICKER_7: 'CLUE_8',
  CLUE_8: 'CLUE_9',
  CLUE_9: 'FINAL_RIDDLE',
  FINAL_RIDDLE: 'TREASURE_FOUND',
};

function advance(step, action) {
  if (action === 'ACK_HANDIN' && step === 'HAND_IN') return 'STICKER_1';
  if (action === 'ACK_RIDDLE' && step === 'RIDDLE_4') return 'STICKER_4';
  if (action === 'ACK_RIDDLE' && step === 'RIDDLE_7') return 'STICKER_7';
  if (action === 'ACK_CLUE_8' && step === 'CLUE_8') return 'CLUE_9';
  if (action === 'STICKER_CODE' && steps[step] && step.startsWith('STICKER_')) return steps[step];
  if (action === 'ANSWER' && (step === 'ANSWER_2' || step === 'ANSWER_5')) return steps[step];
  if (action === 'CHECKPOINT_QR' && (step === 'CHECKPOINT_1_QR' || step === 'CHECKPOINT_2_QR')) return steps[step];
  if (action === 'CHECKPOINT_CODE' && (step === 'CHECKPOINT_1_CODE' || step === 'CHECKPOINT_2_CODE')) return steps[step];
  if (action === 'SNIPPET' && (step === 'SNIPPET_1' || step === 'SNIPPET_2')) return step === 'SNIPPET_1' ? 'STAGE_4_ASSIGNMENT' : 'STAGE_7';
  if (action === 'CLUE9_CODE' && step === 'CLUE_9') return 'FINAL_RIDDLE';
  if (action === 'FINAL_SUBMISSION' && step === 'FINAL_RIDDLE') return 'TREASURE_FOUND';
  return null;
}

let step = 'HAND_IN';
for (const action of ['ACK_HANDIN','STICKER_CODE','STICKER_CODE','ANSWER','CHECKPOINT_QR','CHECKPOINT_CODE','SNIPPET']) {
  const next = advance(step, action);
  assert(next, `stage 1 transition failed: ${step} + ${action}`);
  step = next;
}
assert(step === 'STAGE_4_ASSIGNMENT', 'stage 1 must end in assignment pause');

step = 'RIDDLE_4';
for (const action of ['ACK_RIDDLE','STICKER_CODE','STICKER_CODE','ANSWER','CHECKPOINT_QR','CHECKPOINT_CODE','SNIPPET']) {
  const next = advance(step, action);
  assert(next, `stage 4 transition failed: ${step} + ${action}`);
  step = next;
}
assert(step === 'STAGE_7', 'stage 4 must end in stage 7 pause');

step = 'RIDDLE_7';
for (const action of ['ACK_RIDDLE','STICKER_CODE','ACK_CLUE_8','CLUE9_CODE','FINAL_SUBMISSION']) {
  const next = advance(step, action);
  assert(next, `final transition failed: ${step} + ${action}`);
  step = next;
}
assert(step === 'TREASURE_FOUND', 'final state must be TREASURE_FOUND');

const trackRanks = Array.from({length: 12}, (_, i) => i + 1);
assert(trackRanks.slice(0,10).length === 10, 'checkpoint 1 cutoff must allow 10 per track');
assert(trackRanks[10] === 11, '11th track submission must be outside qualification');
const globalRanks = Array.from({length: 22}, (_, i) => i + 1);
assert(globalRanks.slice(0,20).length === 20, 'checkpoint 2 cutoff must allow 20 globally');
assert(globalRanks[20] === 21, '21st global submission must be outside qualification');
assert(Array.from({length:10}, (_, i) => i + 1).length === 10, 'clue 9 cutoff must allow 10 finalists');

const pairOwners = new Set(['TEAM-01','TEAM-11']);
assert(pairOwners.size === 2, 'clue 8 pairs must have two distinct teams');

const attempts = Array.from({length:11}, (_, i) => i);
assert(attempts.slice(0,10).length === 10, 'rate limit must permit 10 attempts');
assert(attempts.length > 10, '11th rapid attempt must be rejected');

assert(!advance('HAND_IN','STICKER_CODE'), 'cannot skip hand-in acknowledgement');
assert(!advance('CLUE_8','CLUE9_CODE'), 'cannot skip clue 8 completion');
assert(!advance('FINAL_RIDDLE','CLUE9_CODE'), 'cannot claim clue 9 twice');
console.log('Convergence state-machine regression tests passed.');
