import type { OfficeEvent, OfficeGateway } from '@trading-office/office-gateway';
import type { ConnectionStatus, OfficeRuntimeStore } from './OfficeRuntimeStore';

interface ConnectionSignaling {
  subscribeConnection(cb: (s: ConnectionStatus) => void): () => void;
}
function isConnectionSignaling(g: unknown): g is ConnectionSignaling {
  return typeof (g as { subscribeConnection?: unknown }).subscribeConnection === 'function';
}

/**
 * Binds a gateway's live signals to the floor store:
 *  - connection state → store.setConnection
 *  - the office event stream (agent_statuses_snapshot / agent_status_changed) → store.reduce
 *
 * Subscribing to the event stream EAGERLY also opens the WebSocket up-front
 * (HttpOfficeGateway.connect fires on its first subscriber), so the floor
 * receives the on-connect status snapshot without a panel having to be opened
 * first. Without this binding the store is never driven by live events and the
 * floor shows stale seed statuses forever. Returns an unsubscribe.
 */
export function bindGatewayToStore(gateway: OfficeGateway, store: OfficeRuntimeStore): () => void {
  const unsubs: Array<() => void> = [];

  if (isConnectionSignaling(gateway)) {
    unsubs.push(gateway.subscribeConnection((s) => store.setConnection(s)));
  } else {
    store.setConnection('connected'); // mock mode: always connected
  }

  if (typeof gateway.subscribeOfficeEvents === 'function') {
    unsubs.push(gateway.subscribeOfficeEvents((e: OfficeEvent) => store.reduce(e)));
  }

  return () => {
    for (const u of unsubs) u();
  };
}
