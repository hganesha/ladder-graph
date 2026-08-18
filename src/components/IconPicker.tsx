import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ICON_CATALOG } from "../generated/iconCatalog";
import { NodeIcon } from "./NodeIcon";

const categories = ["all", ...new Set(ICON_CATALOG.map((icon) => icon.category))];

export default function IconPicker({
  automaticName,
  currentName,
  onClose,
  onSelect,
}: {
  automaticName: string;
  currentName?: string;
  onClose: () => void;
  onSelect: (name?: string) => void;
}) {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const icons = useMemo(
    () =>
      ICON_CATALOG.filter((icon) => {
        if (category !== "all" && icon.category !== category) return false;
        if (!deferredQuery) return true;
        return `${icon.name} ${icon.label} ${icon.category} ${icon.keywords.join(" ")}`.toLowerCase().includes(deferredQuery);
      }),
    [category, deferredQuery],
  );

  useEffect(() => {
    searchInput.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="icon-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-label="Choose node icon" aria-modal="true" className="icon-picker" role="dialog">
        <header>
          <div>
            <span>Lucide icon</span>
            <strong>Choose an icon</strong>
          </div>
          <button aria-label="Close icon picker" className="icon-button" onClick={onClose} type="button">
            <X size={15} />
          </button>
        </header>
        <label className="icon-picker-search">
          <Search size={14} />
          <span className="sr-only">Search icons</span>
          <input ref={searchInput} onChange={(event) => setQuery(event.target.value)} placeholder="Search icons…" value={query} />
        </label>
        <fieldset className="icon-picker-categories">
          <legend className="sr-only">Icon categories</legend>
          {categories.map((item) => (
            <button aria-pressed={category === item} key={item} onClick={() => setCategory(item)} type="button">
              {item}
            </button>
          ))}
        </fieldset>
        <button className="icon-picker-automatic" onClick={() => onSelect()} type="button">
          <NodeIcon name={automaticName} size={19} />
          <span>
            <strong>Automatic</strong>
            <small>Use {automaticName.replaceAll("-", " ")} from semantic defaults</small>
          </span>
        </button>
        <div className="icon-picker-grid">
          {icons.map((icon) => (
            <button
              aria-label={`Use ${icon.label} icon`}
              aria-pressed={currentName === icon.name}
              key={icon.name}
              onClick={() => onSelect(icon.name)}
              title={icon.label}
              type="button"
            >
              <NodeIcon name={icon.name} size={20} />
              <span>{icon.label}</span>
            </button>
          ))}
          {!icons.length ? <p>No icons match that search.</p> : null}
        </div>
      </section>
    </div>
  );
}
