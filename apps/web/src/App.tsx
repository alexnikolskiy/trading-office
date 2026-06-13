import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { RequireSession } from './app/RequireSession';
import { OutsideScreen } from './outside/OutsideScreen';
import { SessionProvider } from './session/SessionContext';
import { RuntimeProvider } from './runtime/RuntimeContext';
import { FloorScreen } from './floor/FloorScreen';

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <RuntimeProvider>
          <Routes>
            <Route path="/" element={<OutsideScreen />} />
            <Route
              path="/floor/trading-lab/*"
              element={
                <RequireSession>
                  <FloorScreen />
                </RequireSession>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RuntimeProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
