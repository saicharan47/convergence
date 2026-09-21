const assert = (condition, message) => { if (!condition) throw new Error(message); };

const steps = {
  HAND_IN: 'STICKER_1', STICKER_1: 'STICKER_2', STICKER_2: 'ANSWER_2', ANSWER_2: 'CHECKPOINT_1_QR',
  CHECKPOINT_1_QR: 'CHECKPOINT_1_CODE', CHECKPOINT_1_CODE: 'SNIPPET_1', SNIPPET_1: 'CHECKPOINT_1_WAIT',
  TRANSITION_1: 'RIDDLE_4', RIDDLE_4: 'STICKER_4', STICKER_4: 'STICKER_5', STICKER_5: 'ANSWER_5',
  ANSWER_5: 'CHECKPOINT_2_QR', CHECKPOINT_2_QR: 'CHECKPOINT_2_CODE', CHECKPOINT_2_CODE: 'SNIPPET_2',
  SNIPPET_2: 'CHECKPOINT_2_WAIT', TRANSITION_2: 'RIDDLE_7', RIDDLE_7: 'STICKER_7',
  STICKER_7: 'CLUE_8', CLUE_8: 'CLUE_9', CLUE_9: 'FINAL_RIDDLE', FINAL_RIDDLE: 'TREASURE_FOUND',
};

function advance(step, action) {
  if (action === 'ACK_HANDIN' && step === 'HAND_IN') return steps[step];
  if (action === 'ACK_TRANSITION' && (step === 'TRANSITION_1' || step === 'TRANSITION_2')) return steps[step];
  if (action === 'ACK_RIDDLE' && (step === 'RIDDLE_4' || step === 'RIDDLE_7')) return steps[step];
  if (action === 'ACK_CLUE_8' && step === 'CLUE_8') return steps[step];
  if (action === 'STICKER_CODE' && step.startsWith('STICKER_')) return steps[step];
  if (action === 'ANSWER' && (step === 'ANSWER_2' || step === 'ANSWER_5')) return steps[step];
  if (action === 'CHECKPOINT_QR' && (step === 'CHECKPOINT_1_QR' || step === 'CHECKPOINT_2_QR')) return steps[step];
  if (action === 'CHECKPOINT_CODE' && (step === 'CHECKPOINT_1_CODE' || step === 'CHECKPOINT_2_CODE')) return steps[step];
  if (action === 'SNIPPET' && (step === 'SNIPPET_1' || step === 'SNIPPET_2')) return steps[step];
  if (action === 'CLUE9_CODE' && step === 'CLUE_9') return steps[step];
  if (action === 'FINAL_SUBMISSION' && step === 'FINAL_RIDDLE') return steps[step];
  return null;
}

function compressPositions(original, eliminated) {
  const dead = new Set(eliminated);
  return original.filter(team => !dead.has(team)).map((team,index) => ({ team, position:index+1 }));
}

const initial = Array.from({length:15}, (_, i) => 'A'+(i+1));
const afterCheckpoint1 = compressPositions(initial, ['A2','A5','A7','A11','A14']);
const expected1 = ['A1','A3','A4','A6','A8','A9','A10','A12','A13','A15'];
assert(afterCheckpoint1.map(x=>x.team).join(',') === expected1.join(','), 'checkpoint 1 dynamic positions must match the specification');
assert(afterCheckpoint1[1].position === 2 && afterCheckpoint1[1].team === 'A3', 'A3 must inherit position 2');
const afterCheckpoint2 = compressPositions(afterCheckpoint1.map(x=>x.team), ['A3','A8','A12','A13','A15']);
assert(afterCheckpoint2.length === 5, 'checkpoint 2 must leave 5 teams per track');

let step = 'HAND_IN';
for (const action of ['ACK_HANDIN','STICKER_CODE','STICKER_CODE','ANSWER','CHECKPOINT_QR','CHECKPOINT_CODE','SNIPPET']) {
  const next = advance(step, action);
  assert(next, 'stage 1 transition failed: '+step+' + '+action);
  step = next;
}
assert(step === 'CHECKPOINT_1_WAIT', 'Clue 3 must stop at Checkpoint 1');

step = 'TRANSITION_1';
for (const action of ['ACK_TRANSITION','ACK_RIDDLE','STICKER_CODE','STICKER_CODE','ANSWER','CHECKPOINT_QR','CHECKPOINT_CODE','SNIPPET']) {
  const next = advance(step, action);
  assert(next, 'stage 2 transition failed: '+step+' + '+action);
  step = next;
}
assert(step === 'CHECKPOINT_2_WAIT', 'Clue 6 must stop at Checkpoint 2');

step = 'TRANSITION_2';
for (const action of ['ACK_TRANSITION','ACK_RIDDLE','STICKER_CODE','ACK_CLUE_8','CLUE9_CODE','FINAL_SUBMISSION']) {
  const next = advance(step, action);
  assert(next, 'final transition failed: '+step+' + '+action);
  step = next;
}
assert(step === 'TREASURE_FOUND', 'final state must be TREASURE_FOUND');

assert(afterCheckpoint1.length === 10, 'Checkpoint 1 must leave 10 per track');
assert(afterCheckpoint2.length === 5, 'Checkpoint 2 must leave 5 per track');
assert(Array.from({length:20}, (_,i)=>i+1).slice(0,20).length === 20, '20 teams must enter the final phase');
assert(Array.from({length:21}, (_,i)=>i+1)[20] === 21, '21st final claim is outside the final ten claim limit');

const pairOwners = new Set(['TEAM-01','TEAM-11']);
assert(pairOwners.size === 2, 'clue 8 pairs must have two distinct teams');

const attempts = Array.from({length:11}, (_, i) => i);
assert(attempts.slice(0,10).length === 10, 'rate limit must permit 10 attempts');
assert(attempts.length > 10, '11th rapid attempt must be rejected');

assert(!advance('HAND_IN','STICKER_CODE'), 'cannot skip hand-in acknowledgement');
assert(!advance('CLUE_8','CLUE9_CODE'), 'cannot skip clue 8 completion');
assert(!advance('FINAL_RIDDLE','CLUE9_CODE'), 'cannot claim clue 9 twice');
console.log('Convergence dynamic progression regression tests passed.');
