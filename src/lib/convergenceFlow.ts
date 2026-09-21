export type ConvergenceFlowStep =
  | 'HAND_IN'
  | 'STICKER_1'
  | 'STICKER_2'
  | 'ANSWER_2'
  | 'CHECKPOINT_1_QR'
  | 'CHECKPOINT_1_CODE'
  | 'SNIPPET_1'
  | 'RIDDLE_4'
  | 'STICKER_4'
  | 'STICKER_5'
  | 'ANSWER_5'
  | 'CHECKPOINT_2_QR'
  | 'CHECKPOINT_2_CODE'
  | 'SNIPPET_2'
  | 'RIDDLE_7'
  | 'STICKER_7'
  | 'CLUE_8'
  | 'CLUE_9'
  | 'FINAL_RIDDLE';

export const CONVERGENCE_FLOW = [
  { position: 1, label: 'STAGE 1', title: 'HAND-IN + CLUE 1', steps: ['HAND_IN', 'STICKER_1'] },
  { position: 2, label: 'STAGE 2', title: 'CLUE 2', steps: ['STICKER_2', 'ANSWER_2'] },
  { position: 3, label: 'CHECKPOINT 1', title: 'CLUE 3', steps: ['CHECKPOINT_1_QR', 'CHECKPOINT_1_CODE', 'SNIPPET_1'] },
  { position: 4, label: 'STAGE 4', title: 'CLUE 4', steps: ['RIDDLE_4', 'STICKER_4'] },
  { position: 5, label: 'STAGE 5', title: 'CLUE 5', steps: ['STICKER_5', 'ANSWER_5'] },
  { position: 6, label: 'CHECKPOINT 2', title: 'CLUE 6', steps: ['CHECKPOINT_2_QR', 'CHECKPOINT_2_CODE', 'SNIPPET_2'] },
  { position: 7, label: 'STAGE 6', title: 'CLUE 7', steps: ['RIDDLE_7', 'STICKER_7'] },
  { position: 8, label: 'STAGE 7', title: 'CLUE 8 · PAIRED', steps: ['CLUE_8'] },
  { position: 9, label: 'STAGE 8', title: 'CLUE 9 · CLAIM', steps: ['CLUE_9'] },
  { position: 10, label: 'FINAL STAGE', title: 'FINAL RIDDLE', steps: ['FINAL_RIDDLE'] },
] as const;

export function getConvergenceFlow(step: string) {
  return CONVERGENCE_FLOW.find(flow => (flow.steps as readonly string[]).includes(step)) ?? CONVERGENCE_FLOW[0];
}

export function getConvergenceFlowLabel(step: string) {
  const flow = getConvergenceFlow(step);
  return `${flow.label} · ${flow.title}`;
}
