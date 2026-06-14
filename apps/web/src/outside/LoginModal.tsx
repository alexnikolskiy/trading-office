import { useState, type FormEvent } from 'react';

/**
 * The entrance dialog, styled as an in-game "ACCESS TERMINAL". Collects a login
 * and a password to match the expected sign-in shape, but sign-in is still mock
 * (Phase 1): any value is accepted and only the login name is carried forward.
 */
export function LoginModal({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(name.trim() || 'Operator');
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="terminal"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in to Trading Lab"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onCancel();
        }}
        onSubmit={handleSubmit}
      >
        <div className="terminal__bar">
          <span className="terminal__dot" aria-hidden="true" />
          <span className="terminal__dot" aria-hidden="true" />
          <span className="terminal__dot" aria-hidden="true" />
          <span className="terminal__bartitle">ACCESS&nbsp;TERMINAL</span>
        </div>
        <div className="terminal__body">
          <p className="terminal__intro">
            <span className="terminal__prompt">&gt;</span> TRADING&nbsp;LAB · secure entry
            <span className="terminal__caret" aria-hidden="true" />
          </p>

          <label className="terminal__field">
            <span className="terminal__key">LOGIN</span>
            <input
              className="terminal__input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="operator"
              autoComplete="username"
              autoFocus
            />
          </label>

          <label className="terminal__field">
            <span className="terminal__key">PASSWORD</span>
            <input
              className="terminal__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </label>

          <p className="terminal__hint">Mock sign-in — no real authentication. Any value works.</p>

          <div className="terminal__actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary">
              Enter ▸
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
