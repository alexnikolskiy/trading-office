import { z } from 'zod';
import type { AgentStatus } from '@trading-office/office-visual-kit';

// AgentStatus' union SSOT is the kit; validate structurally at the wire (string),
// keep the precise union at the type level via z.custom<AgentStatus>().
export const agentStatusSchema = z.custom<AgentStatus>((v) => typeof v === 'string');
export const agentStatusMapSchema = z.record(z.string(), agentStatusSchema);

export const traceLineSchema = z.object({
  ts: z.string(),
  level: z.enum(['debug', 'info', 'warn', 'error']),
  text: z.string(),
});

export const agentActivitySchema = z.object({
  agentId: z.string(),
  status: agentStatusSchema,
  currentTask: z.string().nullable(),
  logs: z.array(traceLineSchema),
});

export const hypothesisSchema = z.object({
  id: z.string(),
  title: z.string(),
  stage: z.enum(['proposed', 'testing', 'validated', 'rejected']),
  summary: z.string(),
});

export const backtestSummarySchema = z.object({
  id: z.string(),
  strategy: z.string(),
  symbol: z.string(),
  period: z.string(),
  pnlPct: z.number(),
  sharpe: z.number(),
  winRatePct: z.number(),
  maxDrawdownPct: z.number(),
});

export const botHealthSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: z.enum(['running', 'paused', 'error']),
  uptime: z.string(),
  lastHeartbeat: z.string(),
});

export const knowledgeEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  kind: z.enum(['doc', 'experiment', 'note']),
  updated: z.string(),
  tags: z.array(z.string()),
});

export const infraServiceSchema = z.object({ name: z.string(), up: z.boolean(), detail: z.string() });
export const infraStatusSchema = z.object({
  services: z.array(infraServiceSchema),
  queues: z.array(z.object({ name: z.string(), depth: z.number() })),
  lastSync: z.string(),
});

export const operatorMessageSchema = z.object({
  text: z.string(),
  source: z.enum(['web']),
  target: z.enum(['orchestrator']),
  floorId: z.string(),
});
export const operatorMessageAcceptedSchema = z.object({
  operatorMessageId: z.string(),
  conversationId: z.string(),
  status: z.literal('accepted'),
});
export const operatorReplySchema = z.object({
  replyMessageId: z.string(),
  operatorMessageId: z.string(),
  conversationId: z.string(),
  text: z.string(),
  ts: z.string(),
});

export const officeErrorSchema = z.object({ code: z.string(), message: z.string() });
export const officeErrorBodySchema = z.object({ error: officeErrorSchema });
