export function Card({ className = "", ...props }) {
  return <section className={`ui-card ${className}`.trim()} {...props} />;
}

export function Badge({ className = "", ...props }) {
  return <span className={`ui-badge ${className}`.trim()} {...props} />;
}

export function EmptyState({ title = "Nessun dato", description, action }) {
  return (
    <div className="ui-empty">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action}
    </div>
  );
}
