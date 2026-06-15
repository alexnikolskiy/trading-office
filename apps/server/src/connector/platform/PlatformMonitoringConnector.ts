import type { BotHealth, InfraService, InfraSource, InfraSourceState } from '@trading-office/office-gateway';
import type { PlatformHttpClient } from './PlatformHttpClient';
import { mapRun, mapRuntimeCollection, mapMarket, mapExecution, mapCoverage } from './mappers';

type Attempt<T> = { ok: true; value: T } | { ok: false; error: unknown };
async function attempt<T>(fn: () => Promise<T>): Promise<Attempt<T>> {
  try { return { ok: true, value: await fn() }; } catch (error) { return { ok: false, error }; }
}
function aspectState<T>(a: Attempt<T>, map: (v: T) => InfraSourceState): InfraSourceState {
  return a.ok ? map(a.value) : 'error';
}

export interface PlatformInfra {
  services: InfraService[];
  sources: InfraSource[];
}

export class PlatformMonitoringConnector {
  constructor(
    private readonly client: PlatformHttpClient,
    private readonly nowMs: () => number = () => Date.now(),
  ) {}

  async getBotHealth(): Promise<BotHealth[]> {
    let live, paper;
    try {
      live = await this.client.getRuns('live');
      paper = await this.client.getRuns('paper');
    } catch {
      return []; // either mode failing → [] (bot-health source-state conveys why)
    }
    const now = this.nowMs();
    return [...live.items, ...paper.items]
      .filter((r) => r.mode !== 'backtest') // defense-in-depth; ?mode= is the primary filter
      .map((r) => mapRun(r, now));
  }

  async getPlatformInfra(): Promise<PlatformInfra> {
    const [runs, runtime, market, execution, coverage, discover] = await Promise.all([
      attempt(() => this.client.getRuns('live')),
      attempt(() => this.client.getRuntimeHealth()),
      attempt(() => this.client.getMarketHealth()),
      attempt(() => this.client.getExecutionHealth()),
      attempt(() => this.client.getCoverage()),
      attempt(() => this.client.getDiscover()),
    ]);
    const anyOtherOk = [runs, runtime, market, execution, coverage].some((a) => a.ok);
    const opsApiState: InfraSourceState = discover.ok ? 'live' : anyOtherOk ? 'degraded' : 'error';
    const services: InfraService[] = [
      { name: 'platform-ops-api', up: discover.ok, detail: discover.ok ? 'reachable' : officeMessage(discover.error) },
    ];
    const sources: InfraSource[] = [
      { domain: 'platform-ops-api', state: opsApiState, detail: `ops read ${opsApiState}` },
      { domain: 'platform-runtime', state: aspectState(runtime, mapRuntimeCollection), detail: 'runtime health' },
      { domain: 'platform-market', state: aspectState(market, mapMarket), detail: 'market health' },
      { domain: 'platform-execution', state: aspectState(execution, mapExecution), detail: 'execution activity' },
      { domain: 'platform-coverage', state: aspectState(coverage, mapCoverage), detail: 'feed coverage' },
      { domain: 'bot-health', state: runs.ok ? 'live' : 'error', detail: runs.ok ? 'platform ops read' : officeMessage(runs.error) },
    ];
    return { services, sources };
  }
}

export function officeMessage(err: unknown): string {
  const o = (err as { office?: { message?: string } })?.office;
  return o?.message ?? (err instanceof Error ? err.message : String(err));
}
