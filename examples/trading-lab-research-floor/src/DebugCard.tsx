import type { OfficeEntity } from '@trading-office/office-visual-kit';

/**
 * Preview-level debug overlay (NOT a production panel): shows everything the
 * scene knows about the hovered/selected entity.
 */

export interface DebugCardProps {
  hovered: OfficeEntity | null;
  selected: OfficeEntity | null;
}

function Row({ name, value }: { name: string; value: string }) {
  return (
    <div className="debug-row">
      <span className="debug-key">{name}</span>
      <span className="debug-value">{value}</span>
    </div>
  );
}

function EntityDetails({ entity }: { entity: OfficeEntity }) {
  const position = `${Math.round(entity.position.x)}, ${Math.round(entity.position.y)}`;
  const extraProps = Object.entries(entity.properties).filter(
    ([key]) => !['role', 'displayName', 'label', 'objectType', 'panelTarget'].includes(key),
  );

  return (
    <>
      <Row name="kind" value={entity.kind} />
      <Row name="id" value={entity.id} />
      {entity.kind === 'agent' ? (
        <>
          <Row name="role" value={entity.role} />
          <Row name="name" value={entity.displayName} />
          <Row name="status" value={entity.status} />
        </>
      ) : (
        <>
          <Row name="type" value={entity.type} />
          <Row name="label" value={entity.label} />
          {entity.panelTarget && <Row name="panel →" value={entity.panelTarget} />}
          <Row
            name="size"
            value={`${Math.round(entity.size.width)}×${Math.round(entity.size.height)}`}
          />
        </>
      )}
      <Row name="position" value={position} />
      {entity.mapObjectName && <Row name="map object" value={entity.mapObjectName} />}
      {extraProps.map(([key, value]) => (
        <Row key={key} name={key} value={String(value)} />
      ))}
    </>
  );
}

export function DebugCard({ hovered, selected }: DebugCardProps) {
  const entity = selected ?? hovered;

  return (
    <aside className="debug-card" data-mode={selected ? 'selected' : 'hover'}>
      <header className="debug-card-header">
        <span className="debug-card-title">
          {selected ? '◉ selected' : hovered ? '◌ hover' : 'entity inspector'}
        </span>
      </header>
      {entity ? (
        <EntityDetails entity={entity} />
      ) : (
        <p className="debug-empty">
          Hover an agent or an object.
          <br />
          Click to pin it here.
          <br />
          Click empty floor to clear.
        </p>
      )}
    </aside>
  );
}
