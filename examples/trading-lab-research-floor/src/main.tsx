import { createRoot } from 'react-dom/client';
import { TradingLabResearchFloorPreview } from './TradingLabResearchFloorPreview';

// No <StrictMode>: the Pixi Application lifecycle (async init/destroy) does
// not enjoy React's double-invoked effects in dev. The kit cleans up
// correctly either way, but the preview stays simple and predictable.
createRoot(document.getElementById('root')!).render(
  <TradingLabResearchFloorPreview />,
);
