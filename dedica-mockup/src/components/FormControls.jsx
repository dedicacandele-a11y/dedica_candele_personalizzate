export function InfoTip({ title = "Informazione", children, example = "" }) {
  return <span className="ui-info-tip">
    <button type="button" aria-label="Apri spiegazione" title={`Informazioni: ${title}`} onClick={(event) => event.preventDefault()}>i</button>
    <span className="ui-info-popover" role="tooltip"><strong>{title}</strong><span>{children}</span>{example ? <small><b>Esempio:</b> {example}</small> : null}</span>
  </span>;
}

export function Field({ label, hint, help, example, children, as: Component = "div" }) {
  const generatedId = useId();
  const fieldId = isValidElement(children) && children.props.id ? children.props.id : generatedId;
  const control = isValidElement(children) ? cloneElement(children, { id: fieldId }) : children;
  return (
    <Component className="ui-field">
      <span className="ui-field-label"><label htmlFor={fieldId}>{label}</label>{help ? <InfoTip title={label} example={example}>{help}</InfoTip> : null}</span>
      {control}
      {hint ? <small>{hint}</small> : null}
    </Component>
  );
}

export function Input(props) {
  return <input className="ui-input" {...props} />;
}

export function Textarea(props) {
  return <textarea className="ui-input ui-textarea" {...props} />;
}
import { cloneElement, isValidElement, useId } from "react";
