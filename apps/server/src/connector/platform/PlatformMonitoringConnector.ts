import type { BotHealth, InfraService, InfraSource } from '@trading-office/office-gateway';
import type { PlatformHttpClient } from './PlatformHttpClient';
import { mapRun } from './mappers';

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
    const sources: InfraSource[] = [];
    try {
      await this.client.getRuns('live'); // reachability probe
      sources.push({ domain: 'bot-health', state: 'live', detail: 'platform ops read' });
    } catch (err) {
      sources.push({ domain: 'bot-health', state: 'error', detail: officeMessage(err) });
    }
    return { services: [], sources };
  }
}

export function officeMessage(err: unknown): string {
  const o = (err as { office?: { message?: string } })?.office;
  return o?.message ?? (err instanceof Error ? err.message : String(err));
}
