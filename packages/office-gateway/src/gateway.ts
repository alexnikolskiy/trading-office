import type {
  AgentActivity,
  AgentStatusMap,
  AgentTraces,
  BacktestSummary,
  BotHealth,
  Hypothesis,
  InfraStatus,
  KnowledgeEntry,
  OperatorConfirm,
  OperatorMessage,
  OperatorMessageAccepted,
} from './dto';
import type { OfficeEvent } from './events';

/**
 * The single boundary the browser crosses for office data. Read-only except
 * sendOperatorMessage, which is INERT: it is accepted and answered with a
 * simulated reply lifecycle over the event stream — never an execution action.
 */
export interface OfficeGateway {
  getAgentStatuses(): Promise<AgentStatusMap>;
  getAgentActivity(agentId: string): Promise<AgentActivity>;
  getAgentTraces(agentId: string): Promise<AgentTraces>;
  getHypotheses(): Promise<Hypothesis[]>;
  getBacktests(): Promise<BacktestSummary[]>;
  getBotHealth(): Promise<BotHealth[]>;
  getKnowledge(): Promise<KnowledgeEntry[]>;
  getInfraStatus(): Promise<InfraStatus>;
  sendOperatorMessage(msg: OperatorMessage): Promise<OperatorMessageAccepted>;
  /** Structured confirm/cancel of a pending proposal — INERT: a research enqueue request, never an execution action. */
  confirmAction(input: OperatorConfirm): Promise<OperatorMessageAccepted>;
  subscribeOfficeEvents?(cb: (e: OfficeEvent) => void): () => void;
}
