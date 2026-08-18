import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { ICON_CATALOG } from "../generated/iconCatalog";
import { NodeIcon } from "./NodeIcon";

const categories = ["all", ...new Set(ICON_CATALOG.map((icon) => icon.category))];
const PAGE_SIZE = 160;

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
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [query, setQuery] = useState("");
  const searchInput = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const matchingIcons = useMemo(
    () =>
      ICON_CATALOG.filter((icon) => {
        if (category !== "all" && icon.category !== category) return false;
        if (!deferredQuery) return true;
        return `${icon.name} ${icon.label} ${icon.category} ${icon.keywords.join(" ")}`.toLowerCase().includes(deferredQuery);
      }),
    [category, deferredQuery],
  );
  const icons = matchingIcons.slice(0, limit);

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
          <input
            aria-label="Search icons"
            ref={searchInput}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(PAGE_SIZE);
            }}
            placeholder="Search icons…"
            value={query}
          />
          <output>{matchingIcons.length.toLocaleString()} icons</output>
        </label>
        <fieldset className="icon-picker-categories">
          <legend className="sr-only">Icon categories</legend>
          {categories.map((item) => (
            <button
              aria-pressed={category === item}
              key={item}
              onClick={() => {
                setCategory(item);
                setLimit(PAGE_SIZE);
              }}
              type="button"
            >
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
          {icons.length < matchingIcons.length ? (
            <button className="icon-picker-more" onClick={() => setLimit((current) => current + PAGE_SIZE)} type="button">
              Show {Math.min(PAGE_SIZE, matchingIcons.length - icons.length)} more
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
