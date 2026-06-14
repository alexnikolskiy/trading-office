// taskType-prefix → confirmed task-completion event `type`s.
// PROVISIONAL until confirmed by the calibration procedure below. An EMPTY successTypes for a
// matched prefix means "terminal not confirmed" → the ConversationFollower (M3) degrades honestly
// (streams correlated deltas, finalizes via guard with "terminal status could not be confirmed").
export interface TerminalRule {
  prefixes: string[];
  successTypes: string[];
}

export const TERMINAL_TAXONOMY: TerminalRule[] = [
  { prefixes: ['strategy.onboard', 'strategy.analyze_source'], successTypes: ['strategy_analyst.completed'] },
  { prefixes: ['research.run_cycle'], successTypes: ['research.run_cycle.completed'] },
  { prefixes: ['hypothesis.build'], successTypes: ['evaluation.completed'] },
];

export const FAILURE_SUFFIXES = ['failed', 'rejected', 'error'];
export const PLAN_ADVANCE_FAILED = 'chat.plan.advance_failed';

export function successTypesFor(taskType: string): string[] {
  return TERMINAL_TAXONOMY.find((r) => r.prefixes.some((p) => taskType.startsWith(p)))?.successTypes ?? [];
}
export function isFailureType(type: string): boolean {
  if (type === PLAN_ADVANCE_FAILED) return true;
  const suffix = type.split(/[._]/).pop() ?? '';
  return FAILURE_SUFFIXES.includes(suffix);
}
