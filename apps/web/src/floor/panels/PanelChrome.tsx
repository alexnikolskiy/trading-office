import { type ReactNode } from 'react';

export function PanelChrome({
  title,
  badge,
  onClose,
  children,
  flush = false,
}: {
  title: string;
  badge?: string;
  onClose: () => void;
  children: ReactNode;
  /** Drop the body's padding/scroll so a panel (e.g. chat) can own its layout. */
  flush?: boolean;
}) {
  return (
    <section className="panel">
      <header className="panel__head">
        <h2 className="panel__title">{title}</h2>
        {badge && <span className="panel__badge">{badge}</span>}
        <button className="panel__close" onClick={onClose} aria-label="Close panel">
          ×
        </button>
      </header>
      <div className={`panel__body${flush ? ' panel__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

export function PanelState({ resource }: { resource: { loading: boolean; error: Error | null } }) {
  if (resource.loading) return <p className="panel__state">Loading…</p>;
  if (resource.error) return <p className="panel__state">Failed: {resource.error.message}</p>;
  return null;
}
