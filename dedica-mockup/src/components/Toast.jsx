export function Toast({ message, tone = "neutral" }) {
  if (!message) return null;
  return <div className={`ui-toast ui-toast--${tone}`}>{message}</div>;
}
