import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { MockOfficeGateway } from './MockOfficeGateway';
import { HttpOfficeGateway } from './HttpOfficeGateway';
import { OfficeRuntimeStore } from './OfficeRuntimeStore';
import type { OfficeGateway } from './OfficeGateway';
import type { AgentStatusMap } from './types';

interface RuntimeContextValue {
  gateway: OfficeGateway;
  store: OfficeRuntimeStore;
}

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

function createGateway(): OfficeGateway {
  const mode = import.meta.env.VITE_OFFICE_MODE ?? 'mock';
  if (mode === 'connected') {
    const baseUrl = import.meta.env.VITE_OFFICE_GATEWAY_URL ?? 'http://localhost:8787';
    return new HttpOfficeGateway({ baseUrl, wsUrl: import.meta.env.VITE_OFFICE_GATEWAY_WS_URL });
  }
  return new MockOfficeGateway();
}

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const value = useMemo<RuntimeContextValue>(
    () => ({ gateway: createGateway(), store: new OfficeRuntimeStore() }),
    [],
  );
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

function useRuntime(): RuntimeContextValue {
  const ctx = useContext(RuntimeContext);
  if (!ctx) throw new Error('useRuntime must be used within <RuntimeProvider>');
  return ctx;
}

export function useGateway(): OfficeGateway {
  return useRuntime().gateway;
}

export function useRuntimeStore(): OfficeRuntimeStore {
  return useRuntime().store;
}

export function useAgentStatuses(): AgentStatusMap {
  const { store } = useRuntime();
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot().statuses);
}
