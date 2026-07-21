export function Button({ as: Component = "button", variant = "primary", className = "", ...props }) {
  return <Component className={`ui-button ui-button--${variant} ${className}`.trim()} {...props} />;
}
