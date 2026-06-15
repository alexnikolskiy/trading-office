import type { AgentStatusMap, AgentActivity, Hypothesis, BacktestSummary } from '@trading-office/office-gateway';
import type { TradingLabHttpClient } from './TradingLabHttpClient';
import type { LabReadSourceTracker } from './labReadSource';
import { mapAgentStatuses, mapAgentActivity, mapHypothesis, mapBacktest, mapOfficeAgentIdToLab, NO_LAB_SOURCE_AGENTS } from './mappers';

export class TradingLabReadConnector {
  constructor(
    private readonly client: TradingLabHttpClient,
    private readonly now: () => string = () => new Date().toISOString(),
    // Optional: records each aggregate read's outcome so the InfraAggregator can
    // surface the `trading-lab-read` source. When absent, reads still degrade
    // gracefully (empty projection); the outcome simply isn't tracked.
    private readonly labReadSource?: Pick<LabReadSourceTracker, 'recordSuccess' | 'recordFailure'>,
  ) {}

  // Aggregate reads degrade like the platform connector: an upstream lab failure
  // becomes an empty/default projection + a typed source state, never a 500.
  async getAgentStatuses(): Promise<AgentStatusMap> {
    try {
      const { data } = await this.client.getAgents();
      const statuses = this.seedNoSource(mapAgentStatuses(data));
      this.labReadSource?.recordSuccess();
      return statuses;
    } catch (err) {
      this.labReadSource?.recordFailure(err);
      return this.seedNoSource({});
    }
  }

  async getAgentActivity(agentId: string): Promise<AgentActivity> {
    const labId = mapOfficeAgentIdToLab(agentId);
    if (!labId) {
      // No trading-lab source for this office agent (e.g. evaluator, perf-monitor) — honest gap, NO lab call.
      return {
        agentId,
        status: 'idle',
        currentTask: null,
        logs: [{ ts: this.now(), level: 'info', text: 'No trading-lab source connected yet' }],
      };
    }
    // Strict per-agent detail/proxy: lets the typed upstream error propagate so the
    // app error handler can map it to a typed status (401/502), not a generic 500.
    // mapAgentActivity maps the lab agentId back to the office id (e.g. system → boss).
    return mapAgentActivity(await this.client.getAgent(labId));
  }

  async getHypotheses(): Promise<Hypothesis[]> {
    try {
      const { data } = await this.client.getHypotheses();
      const hypotheses = data.map(mapHypothesis);
      this.labReadSource?.recordSuccess();
      return hypotheses;
    } catch (err) {
      this.labReadSource?.recordFailure(err);
      return [];
    }
  }

  async getBacktests(): Promise<BacktestSummary[]> {
    try {
      const { data } = await this.client.getBacktests();
      const backtests = data.map(mapBacktest);
      this.labReadSource?.recordSuccess();
      return backtests;
    } catch (err) {
      this.labReadSource?.recordFailure(err);
      return [];
    }
  }

  /** Documented no-source office agents → honest idle, so the floor doesn't keep a misleading initial status. */
  private seedNoSource(statuses: AgentStatusMap): AgentStatusMap {
    for (const id of NO_LAB_SOURCE_AGENTS) {
      if (!(id in statuses)) statuses[id] = 'idle';
    }
    return statuses;
  }
}
