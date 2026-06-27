import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgentActivityPanel } from './AgentActivityPanel';
import * as RuntimeContext from '../../runtime/RuntimeContext';

describe('AgentActivityPanel tabs', () => {
  it('shows Logs by default and switches to Traces', async () => {
    vi.spyOn(RuntimeContext, 'useAgentStatuses').mockReturnValue({} as never);
    vi.spyOn(RuntimeContext, 'useGateway').mockReturnValue({
      getAgentActivity: async () => ({ agentId: 'analyst', status: 'idle', currentTask: null, logs: [] }),
      getAgentTraces: async () => ({ agentId: 'analyst', reasonCode: 'no-traces', traces: [] }),
      subscribeOfficeEvents: () => () => {},
    } as never);
    render(<AgentActivityPanel agentId="analyst" onClose={() => {}} />);
    fireEvent.click(await screen.findByRole('tab', { name: /traces/i }));
    expect(await screen.findByText(/no traces/i)).toBeTruthy();
  });
});
