import { METHOD_LABELS, METHOD_COLORS } from "../lib/constants";

interface MethodBadgeProps {
  method: string;
  size?: "sm" | "md" | "lg";
}

export default function MethodBadge({ method, size = "md" }: MethodBadgeProps) {
  const color = METHOD_COLORS[method] || "#757575";
  const label = METHOD_LABELS[method] || method;
  const className = "method-badge method-badge-" + size;

  return (
    <span className={className} style={{ borderColor: color, color: color }}>
      <strong>{method}</strong>
      {size !== "sm" && <span className="method-label">{label}</span>}
    </span>
  );
}
