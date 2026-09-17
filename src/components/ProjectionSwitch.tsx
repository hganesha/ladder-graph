import { Box, Network } from "lucide-react";
import type { Projection } from "../lib/projection";

const PROJECTIONS: { id: Projection; label: string; title: string; Icon: typeof Box }[] = [
  { id: "isometric", label: "Isometric", title: "Isometric projection", Icon: Box },
  { id: "orthogonal", label: "Orthogonal", title: "Orthogonal top-down projection", Icon: Network },
];

export function ProjectionSwitch({ onChange, value }: { onChange: (projection: Projection) => void; value: Projection }) {
  return (
    <fieldset className="projection-switch">
      <legend className="sr-only">Canvas projection</legend>
      {PROJECTIONS.map(({ id, label, title, Icon }) => (
        <button
          key={id}
          type="button"
          className={value === id ? "active" : ""}
          aria-pressed={value === id}
          title={title}
          onClick={() => onChange(id)}
        >
          <Icon size={14} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </fieldset>
  );
}
