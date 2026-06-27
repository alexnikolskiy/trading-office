import { describe, it, expect } from 'vitest';
import type { OfficeEvent, OfficeGateway } from '@trading-office/office-gateway';
import { OfficeRuntimeStore, type ConnectionStatus } from './OfficeRuntimeStore';
import { bindGatewayToStore } from './runtimeBinding';

/** Minimal fake gateway exposing just the live signals the binding consumes. */
class FakeGateway {
  eventCb: ((e: OfficeEvent) => void) | null = null;
  connCb: ((s: ConnectionStatus) => void) | null = null;
  eventUnsubscribed = false;
  connUnsubscribed = false;

  subscribeOfficeEvents(cb: (e: OfficeEvent) => void): () => void {
    this.eventCb = cb;
    return () => {
      this.eventUnsubscribed = true;
    };
  }
  subscribeConnection(cb: (s: ConnectionStatus) => void): () => void {
    this.connCb = cb;
    return () => {
      this.connUnsubscribed = true;
    };
  }
  emit(e: OfficeEvent) {
    this.eventCb?.(e);
  }
}

const asGateway = (g: FakeGateway): OfficeGateway => g as unknown as OfficeGateway;

describe('bindGatewayToStore', () => {
  it('pumps live office events into store.reduce (snapshot then status change)', () => {
    const gw = new FakeGateway();
    const store = new OfficeRuntimeStore();
    bindGatewayToStore(asGateway(gw), store);

    gw.emit({ type: 'agent_statuses_snapshot', ts: '1', statuses: { boss: 'thinking', analyst: 'idle' } });
    expect(store.getSnapshot().statuses).toEqual({ boss: 'thinking', analyst: 'idle' });

    gw.emit({ type: 'agent_status_changed', ts: '2', agentId: 'analyst', status: 'running' });
    expect(store.getSnapshot().statuses.analyst).toBe('running');
  });

  it('subscribes eagerly so the WebSocket opens before any panel is opened', () => {
    const gw = new FakeGateway();
    const store = new OfficeRuntimeStore();
    bindGatewayToStore(asGateway(gw), store);
    // The binding itself registered an events subscriber — this is what makes
    // HttpOfficeGateway.connect() fire up front (lazy-connect bug fix).
    expect(gw.eventCb).not.toBeNull();
  });

  it('wires connection state through to the store', () => {
    const gw = new FakeGateway();
    const store = new OfficeRuntimeStore();
    bindGatewayToStore(asGateway(gw), store);
    gw.connCb?.('reconnecting');
    expect(store.getSnapshot().connection).toBe('reconnecting');
  });

  it('treats a gateway without connection signalling as always connected (mock mode)', () => {
    const store = new OfficeRuntimeStore();
    const eventOnly = {
      subscribeOfficeEvents: (_cb: (e: OfficeEvent) => void) => () => {},
    } as unknown as OfficeGateway;
    store.setConnection('disconnected');
    bindGatewayToStore(eventOnly, store);
    expect(store.getSnapshot().connection).toBe('connected');
  });

  it('cleans up both subscriptions on unsubscribe', () => {
    const gw = new FakeGateway();
    const store = new OfficeRuntimeStore();
    const stop = bindGatewayToStore(asGateway(gw), store);
    stop();
    expect(gw.eventUnsubscribed).toBe(true);
    expect(gw.connUnsubscribed).toBe(true);
  });
});
