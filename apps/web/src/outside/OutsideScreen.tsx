import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../session/SessionContext';
import { CityScene } from '../city/CityScene';
import { LoginModal } from './LoginModal';

const FLOOR_PATH = '/floor/trading-lab';

export function OutsideScreen() {
  const navigate = useNavigate();
  const { session, login } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);

  function handleDoor() {
    if (session.user) {
      navigate(FLOOR_PATH);
    } else {
      setLoginOpen(true);
    }
  }

  function handleLogin(name: string) {
    login(name);
    setLoginOpen(false);
    navigate(FLOOR_PATH);
  }

  return (
    <div className="outside">
      <CityScene
        mood="day"
        onEnter={handleDoor}
        doorLabel={session.user ? 'Enter the Trading Lab floor' : 'Knock on the tower door to sign in'}
      />
      <p className="outside__caption">
        {session.user ? 'Welcome back — step through the door.' : 'Click the tower door to sign in.'}
      </p>
      {loginOpen && <LoginModal onSubmit={handleLogin} onCancel={() => setLoginOpen(false)} />}
    </div>
  );
}
