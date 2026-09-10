export default function EmptyState({ icon, title, subtitle, action }) {
  return (
    <div className="empty-state">
      {icon && <div className="empty-state-icon" aria-hidden="true">{icon}</div>}
      <h3>{title}</h3>
      {subtitle && <p>{subtitle}</p>}
      {action}
    </div>
  );
}
