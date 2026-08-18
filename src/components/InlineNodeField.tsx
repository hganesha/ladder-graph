import { Pencil } from "lucide-react";
import { type KeyboardEvent, type MouseEvent, useEffect, useRef, useState } from "react";

type InlineNodeFieldElement = "h3" | "p" | "strong";

export function InlineNodeField({
  as,
  value,
  placeholder,
  label,
  multiline = false,
  editable = false,
  showAffordance = false,
  onCommit,
}: {
  as: InlineNodeFieldElement;
  value?: string;
  placeholder: string;
  label: string;
  multiline?: boolean;
  editable?: boolean;
  showAffordance?: boolean;
  onCommit?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const cancelledBlur = useRef(false);
  const Display = as;

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [editing, value]);

  const startEditing = (event?: MouseEvent | KeyboardEvent) => {
    if (!editable || !onCommit) return;
    event?.stopPropagation();
    cancelledBlur.current = false;
    setDraft(value ?? "");
    setEditing(true);
  };

  const commit = () => {
    const next = draft.trim();
    if (!multiline && !next) {
      setDraft(value ?? "");
      setEditing(false);
      return;
    }
    setEditing(false);
    if (next !== (value ?? "")) onCommit?.(next);
  };

  const cancel = () => {
    cancelledBlur.current = true;
    setDraft(value ?? "");
    setEditing(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    event.stopPropagation();
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    if ((!multiline && event.key === "Enter") || (multiline && event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
      event.preventDefault();
      commit();
    }
  };

  if (editing) {
    const sharedProps = {
      "aria-label": `Edit ${label}`,
      autoFocus: true,
      className: `inline-node-editor nodrag nowheel ${multiline ? "multiline" : ""}`,
      onBlur: () => {
        if (cancelledBlur.current) {
          cancelledBlur.current = false;
          return;
        }
        commit();
      },
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
      onClick: (event: MouseEvent) => event.stopPropagation(),
      onDoubleClick: (event: MouseEvent) => event.stopPropagation(),
      onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => event.currentTarget.select(),
      onKeyDown: handleKeyDown,
      onPointerDown: (event: React.PointerEvent) => event.stopPropagation(),
      value: draft,
    };
    return multiline ? <textarea {...sharedProps} rows={2} /> : <input {...sharedProps} type="text" />;
  }

  return (
    <Display
      aria-label={editable ? `${label}. Double-click to edit` : undefined}
      className={`inline-node-value ${value ? "" : "placeholder"}`}
      onClick={showAffordance ? startEditing : undefined}
      onDoubleClick={startEditing}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === "F2") {
          event.preventDefault();
          startEditing(event);
        }
      }}
      role={editable ? "button" : undefined}
      tabIndex={editable ? 0 : undefined}
      title={editable ? `Double-click to edit ${label}` : undefined}
    >
      <span>{value || placeholder}</span>
      {editable && showAffordance ? <Pencil aria-hidden="true" className="inline-node-pencil" size={10} /> : null}
    </Display>
  );
}
