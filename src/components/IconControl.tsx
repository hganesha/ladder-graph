import { lazy, Suspense, useRef, useState } from "react";
import { resolveCatalogIcon } from "../lib/nodeIcons";
import type { IconRef } from "../types";
import { NodeIcon } from "./NodeIcon";

const IconPicker = lazy(() => import("./IconPicker"));

export function IconControl({
  automaticName,
  label,
  onChange,
  value,
}: {
  automaticName: string;
  label: string;
  onChange: (icon: IconRef | undefined) => void;
  value?: IconRef;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const explicitName = resolveCatalogIcon(value);
  const shownName = explicitName ?? automaticName;
  const close = () => {
    setOpen(false);
    window.setTimeout(() => trigger.current?.focus(), 0);
  };
  return (
    <div className="node-icon-control">
      <span>{label}</span>
      <button aria-haspopup="dialog" className="node-icon-trigger" onClick={() => setOpen(true)} ref={trigger} type="button">
        <span className="node-icon-trigger-preview">
          <NodeIcon name={shownName} size={18} />
        </span>
        <span>
          <strong>{explicitName ? shownName.replaceAll("-", " ") : `Automatic: ${automaticName.replaceAll("-", " ")}`}</strong>
          <small>
            {explicitName ? "Custom Lucide icon" : value ? `Unavailable override: ${value.name}` : "Derived from this node's meaning"}
          </small>
        </span>
      </button>
      {open ? (
        <Suspense fallback={<div className="icon-picker-loading">Loading icons…</div>}>
          <IconPicker
            automaticName={automaticName}
            currentName={explicitName}
            onClose={close}
            onSelect={(name) => {
              onChange(name ? { set: "lucide", name } : undefined);
              close();
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
