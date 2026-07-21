import { Button } from "./Button.jsx";

export function Modal({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="ui-overlay" role="dialog" aria-modal="true">
      <div className="ui-modal">
        <header>
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose}>Chiudi</Button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Drawer({ open, title, children, onClose }) {
  if (!open) return null;
  return (
    <div className="ui-overlay ui-overlay--drawer" role="dialog" aria-modal="true">
      <aside className="ui-drawer">
        <header>
          <h2>{title}</h2>
          <Button variant="ghost" onClick={onClose}>Chiudi</Button>
        </header>
        {children}
      </aside>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="ui-actions">
        <Button variant="secondary" onClick={onCancel}>Annulla</Button>
        <Button onClick={onConfirm}>Conferma</Button>
      </div>
    </Modal>
  );
}
