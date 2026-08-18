import { Bot, BookOpen, Boxes, FileText, PackageOpen, Search, Sparkles, Workflow, X } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { INPUT_CONTRACT_PRESETS } from "../lib/inputContracts";
import {
  CATALOG_SEARCH_KIND_LABELS,
  CATALOG_SEARCH_KIND_ORDER,
  createCatalogSearchIndex,
  searchCatalog,
  type CatalogSearchEntry,
  type CatalogSearchKind,
  type CatalogSearchMatch,
  type CatalogSearchSubject,
} from "../lib/catalogSearch";
import type { InputModality } from "../types";

const RECENT_SEARCHES_KEY = "ladder-catalog-recent-searches";
const INITIAL_LIMITS: Record<CatalogSearchKind, number> = {
  subject: 4,
  workflow: 6,
  bundle: 6,
  agent: 6,
  form: 6,
  document: 6,
  ontology: 6,
};
const SEARCH_KINDS = new Set<CatalogSearchKind>(["subject", "workflow", "bundle", "agent", "form", "document", "ontology"]);
const SEARCH_MODALITIES = new Set(["all", "text", "image", "audio", "video", "document", "mixed"]);

const KIND_ICONS = {
  subject: Sparkles,
  workflow: Workflow,
  bundle: PackageOpen,
  agent: Bot,
  form: FileText,
  document: BookOpen,
  ontology: Boxes,
};

const ACTION_LABELS = {
  "browse-subject": "Browse subject",
  "open-workflow": "Open workflow",
  "open-bundle": "Open bundle",
  "create-with-agent": "Create with agent",
  "open-form": "Open form",
  "inspect-document": "Inspect document",
  "open-ontology": "Open ontology",
};

function readRecentSearches() {
  try {
    const value = JSON.parse(window.localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 3) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) return;
  const recent = [normalized, ...readRecentSearches().filter((item) => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())].slice(
    0,
    10,
  );
  window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent));
}

function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter((term) => term.length >= 2)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!terms.length) return text;
  const expression = new RegExp(`(${terms.join("|")})`, "gi");
  let offset = 0;
  return text.split(expression).map((part) => {
    const key = `${offset}-${part}`;
    offset += part.length;
    return terms.some((term) => new RegExp(`^${term}$`, "i").test(part)) ? (
      <mark key={key}>{part}</mark>
    ) : (
      <Fragment key={key}>{part}</Fragment>
    );
  });
}

export interface UniversalCatalogSearchProps {
  subjects: CatalogSearchSubject[];
  variant?: "inline" | "dialog";
  query?: string;
  onQueryChange?: (query: string) => void;
  onClose?: () => void;
  onBrowseSubject: (subject: string) => void;
  onOpenWorkflow: (templateId: string) => void | Promise<void>;
  onOpenBundle: (templateId: string) => void;
  onCreateWithAgent: (templateId: string) => void | Promise<void>;
  onOpenForm: (templateId: string) => void;
  onInspectDocument: (templateId: string) => void;
  onOpenOntology: (templateId: string) => void;
}

export function UniversalCatalogSearch({
  subjects,
  variant = "inline",
  query: controlledQuery,
  onQueryChange,
  onClose,
  onBrowseSubject,
  onOpenWorkflow,
  onOpenBundle,
  onCreateWithAgent,
  onOpenForm,
  onInspectDocument,
  onOpenOntology,
}: UniversalCatalogSearchProps) {
  const [internalQuery, setInternalQuery] = useState("");
  const [selectedKinds, setSelectedKinds] = useState<CatalogSearchKind[]>(() => {
    if (variant !== "inline") return [];
    return (new URLSearchParams(window.location.search).get("type") ?? "")
      .split(",")
      .filter((kind): kind is CatalogSearchKind => SEARCH_KINDS.has(kind as CatalogSearchKind));
  });
  const [subjectArea, setSubjectArea] = useState(() =>
    variant === "inline" ? (new URLSearchParams(window.location.search).get("subject") ?? "") : "",
  );
  const [modality, setModality] = useState<"all" | InputModality>(() => {
    const requested = variant === "inline" ? (new URLSearchParams(window.location.search).get("modality") ?? "all") : "all";
    return SEARCH_MODALITIES.has(requested) ? (requested as "all" | InputModality) : "all";
  });
  const [expandedKinds, setExpandedKinds] = useState<CatalogSearchKind[]>([]);
  const [focused, setFocused] = useState(variant === "dialog");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => (typeof window === "undefined" ? [] : readRecentSearches()));
  const inputRef = useRef<HTMLInputElement>(null);
  const query = controlledQuery ?? internalQuery;
  const normalizedLength = query.trim().replace(/\s+/g, " ").length;
  const index = useMemo(() => createCatalogSearchIndex(subjects), [subjects]);
  const unfilteredResponse = useMemo(() => searchCatalog(index, query), [index, query]);
  const response = useMemo(
    () => searchCatalog(index, query, { kinds: selectedKinds, subjectArea: subjectArea || undefined, modality }),
    [index, modality, query, selectedKinds, subjectArea],
  );

  const setQuery = (value: string) => {
    if (controlledQuery === undefined) setInternalQuery(value);
    onQueryChange?.(value);
    setActiveIndex(0);
  };

  useEffect(() => {
    if (variant !== "dialog") return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [variant]);

  useEffect(() => {
    if (variant !== "inline") return;
    const parameters = new URLSearchParams(window.location.search);
    if (query) parameters.set("q", query);
    else parameters.delete("q");
    if (selectedKinds.length) parameters.set("type", selectedKinds.join(","));
    else parameters.delete("type");
    if (subjectArea) parameters.set("subject", subjectArea);
    else parameters.delete("subject");
    if (modality !== "all") parameters.set("modality", modality);
    else parameters.delete("modality");
    const next = `${window.location.pathname}${parameters.size ? `?${parameters.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }, [modality, query, selectedKinds, subjectArea, variant]);

  const visibleByKind = useMemo(
    () =>
      Object.fromEntries(
        CATALOG_SEARCH_KIND_ORDER.map((kind) => [
          kind,
          expandedKinds.includes(kind) ? response.groups[kind] : response.groups[kind].slice(0, INITIAL_LIMITS[kind]),
        ]),
      ) as Record<CatalogSearchKind, CatalogSearchMatch[]>,
    [expandedKinds, response.groups],
  );
  const visibleResults = useMemo(() => CATALOG_SEARCH_KIND_ORDER.flatMap((kind) => visibleByKind[kind]), [visibleByKind]);
  const visibleResultIndexes = useMemo(() => new Map(visibleResults.map((result, index) => [result.key, index])), [visibleResults]);
  const availableSubjects = unfilteredResponse.subjectAreas;
  const showDiscovery = focused && normalizedLength < 2;

  const activate = (entry: CatalogSearchEntry) => {
    saveRecentSearch(query);
    setRecentSearches(readRecentSearches());
    switch (entry.action) {
      case "browse-subject":
        onBrowseSubject(entry.id);
        setQuery("");
        break;
      case "open-workflow":
        void onOpenWorkflow(entry.id);
        break;
      case "open-bundle":
        onOpenBundle(entry.id);
        break;
      case "create-with-agent":
        void onCreateWithAgent(entry.id);
        break;
      case "open-form":
        onOpenForm(entry.id);
        break;
      case "inspect-document":
        onInspectDocument(entry.id);
        break;
      case "open-ontology":
        onOpenOntology(entry.id);
        break;
    }
    if (variant === "dialog") onClose?.();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!visibleResults.length) return;
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + visibleResults.length) % visibleResults.length);
      return;
    }
    if (event.key === "Home" && visibleResults.length) {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }
    if (event.key === "End" && visibleResults.length) {
      event.preventDefault();
      setActiveIndex(visibleResults.length - 1);
      return;
    }
    if (event.key === "Enter" && visibleResults[activeIndex]) {
      event.preventDefault();
      activate(visibleResults[activeIndex]);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else onClose?.();
    }
  };

  const toggleKind = (kind: CatalogSearchKind) => {
    setSelectedKinds((current) => (current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]));
    setActiveIndex(0);
  };

  const searchBody = (
    <section
      className={`catalog-search ${variant === "dialog" ? "catalog-search-dialog" : "catalog-search-inline"}`}
      aria-label="Catalog search"
    >
      <header className="catalog-search-header">
        {variant === "dialog" ? (
          <div>
            <span className="eyebrow">Universal catalog</span>
            <h2 id="catalog-search-dialog-title">Find a starting point</h2>
          </div>
        ) : null}
        {variant === "dialog" ? (
          <button className="icon-button" aria-label="Close catalog search" onClick={onClose} type="button">
            <X size={17} aria-hidden="true" />
          </button>
        ) : null}
      </header>
      <label className="catalog-search-field">
        <span className="sr-only">Search the Ladder catalog</span>
        <Search size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          aria-label="Search the Ladder catalog"
          aria-activedescendant={visibleResults[activeIndex] ? `catalog-result-${visibleResults[activeIndex].key}` : undefined}
          aria-autocomplete="list"
          aria-controls="catalog-search-results"
          aria-expanded={normalizedLength >= 2 || showDiscovery}
          autoComplete="off"
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search workflows, bundles, agents, forms, documents, and ontologies…"
          role="combobox"
          value={query}
        />
        {query ? (
          <button aria-label="Clear catalog search" onClick={() => setQuery("")} type="button">
            <X size={16} aria-hidden="true" />
          </button>
        ) : (
          <kbd>{variant === "dialog" ? "⌘ K" : "/"}</kbd>
        )}
      </label>

      {showDiscovery ? (
        <div className="catalog-search-discovery">
          {recentSearches.length ? (
            <div>
              <div className="catalog-discovery-heading">
                <strong>Recent searches</strong>
                <button
                  onClick={() => {
                    window.localStorage.removeItem(RECENT_SEARCHES_KEY);
                    setRecentSearches([]);
                  }}
                  type="button"
                >
                  Clear
                </button>
              </div>
              <div className="catalog-suggestion-list">
                {recentSearches.slice(0, 3).map((recent) => (
                  <button key={recent} onClick={() => setQuery(recent)} type="button">
                    <Search size={13} aria-hidden="true" /> {recent}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div>
            <strong>Try a task or partial word</strong>
            <div className="catalog-suggestion-list">
              {["claim review", "accessibility", "approval form"].map((suggestion) => (
                <button key={suggestion} onClick={() => setQuery(suggestion)} type="button">
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {normalizedLength === 1 ? <p className="catalog-search-prompt">Type one more character to search the catalog.</p> : null}

      {normalizedLength >= 2 ? (
        <div className="catalog-search-experience">
          <fieldset className="catalog-search-filters">
            <legend className="sr-only">Filter catalog results</legend>
            <div className="catalog-type-filters">
              <button
                aria-pressed={selectedKinds.length === 0}
                className={selectedKinds.length === 0 ? "active" : undefined}
                onClick={() => setSelectedKinds([])}
                type="button"
              >
                All <small>{unfilteredResponse.total}</small>
              </button>
              {CATALOG_SEARCH_KIND_ORDER.map((kind) => (
                <button
                  aria-pressed={selectedKinds.includes(kind)}
                  className={selectedKinds.includes(kind) ? "active" : undefined}
                  key={kind}
                  onClick={() => toggleKind(kind)}
                  type="button"
                >
                  {CATALOG_SEARCH_KIND_LABELS[kind]} <small>{unfilteredResponse.counts[kind]}</small>
                </button>
              ))}
            </div>
            {availableSubjects.length > 1 ? (
              <label>
                <span className="sr-only">Filter search results by subject area</span>
                <select
                  aria-label="Filter search results by subject area"
                  onChange={(event) => setSubjectArea(event.target.value)}
                  value={subjectArea}
                >
                  <option value="">All subjects</option>
                  {availableSubjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label>
              <span className="sr-only">Filter search results by modality</span>
              <select
                aria-label="Filter search results by modality"
                onChange={(event) => setModality(event.target.value as "all" | InputModality)}
                value={modality}
              >
                <option value="all">All modalities</option>
                {INPUT_CONTRACT_PRESETS.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <div className="sr-only" aria-live="polite">
            {response.total} {response.total === 1 ? "result" : "results"} for {query}
          </div>
          <div className="catalog-result-summary">
            <strong>
              {response.total} {response.total === 1 ? "result" : "results"}
            </strong>
            <span>for “{query.trim()}”</span>
            {response.didUseTypoRecovery ? <small>Including similar spellings</small> : null}
          </div>

          <div className="catalog-search-results" id="catalog-search-results" role="listbox" aria-label="Catalog search results">
            {response.total ? (
              CATALOG_SEARCH_KIND_ORDER.map((kind) => {
                const Icon = KIND_ICONS[kind];
                const group = visibleByKind[kind];
                if (!group.length) return null;
                return (
                  <section className="catalog-result-group" key={kind} aria-labelledby={`catalog-group-${kind}`}>
                    <header>
                      <h3 id={`catalog-group-${kind}`}>
                        <Icon size={16} aria-hidden="true" /> {CATALOG_SEARCH_KIND_LABELS[kind]}
                      </h3>
                      <span>{response.counts[kind]}</span>
                    </header>
                    <div className="catalog-result-list">
                      {group.map((entry) => {
                        const resultIndex = visibleResultIndexes.get(entry.key) ?? 0;
                        return (
                          <button
                            aria-label={`${entry.title}, ${CATALOG_SEARCH_KIND_LABELS[entry.kind]}, ${ACTION_LABELS[entry.action]}`}
                            aria-selected={activeIndex === resultIndex}
                            className={activeIndex === resultIndex ? "active" : undefined}
                            id={`catalog-result-${entry.key}`}
                            key={entry.key}
                            onClick={() => activate(entry)}
                            onMouseEnter={() => setActiveIndex(resultIndex)}
                            role="option"
                            type="button"
                          >
                            <span className={`catalog-result-icon kind-${entry.kind}`} aria-hidden="true">
                              <Icon size={18} />
                            </span>
                            <span className="catalog-result-copy">
                              <span className="catalog-result-title-row">
                                <strong>
                                  <Highlight query={query} text={entry.title} />
                                </strong>
                                <small>{entry.eyebrow ?? CATALOG_SEARCH_KIND_LABELS[entry.kind]}</small>
                              </span>
                              <span className="catalog-result-description">
                                <Highlight query={query} text={entry.description} />
                              </span>
                              <span className="catalog-result-meta">
                                {entry.subjectAreas.slice(0, 2).map((subject) => (
                                  <span key={subject}>{subject}</span>
                                ))}
                                {entry.detail ? <span>{entry.detail}</span> : null}
                                {entry.tags.slice(0, 3).map((tag) => (
                                  <span key={tag}>{tag}</span>
                                ))}
                              </span>
                              <span className="catalog-match-reason">{entry.reason}</span>
                            </span>
                            <strong className="catalog-result-action">{ACTION_LABELS[entry.action]}</strong>
                          </button>
                        );
                      })}
                    </div>
                    {response.counts[kind] > group.length ? (
                      <button className="catalog-show-all" onClick={() => setExpandedKinds((current) => [...current, kind])} type="button">
                        Show all {response.counts[kind]} {CATALOG_SEARCH_KIND_LABELS[kind].toLocaleLowerCase()}
                      </button>
                    ) : null}
                  </section>
                );
              })
            ) : (
              <div className="catalog-no-results">
                <Search size={24} aria-hidden="true" />
                <h3>No catalog results for “{query.trim()}”</h3>
                <p>Try a shorter term, remove a filter, or browse all subject areas.</p>
                {selectedKinds.length || subjectArea || modality !== "all" ? (
                  <button
                    onClick={() => {
                      setSelectedKinds([]);
                      setSubjectArea("");
                      setModality("all");
                    }}
                    type="button"
                  >
                    Clear filters
                  </button>
                ) : (
                  <button onClick={() => setQuery("")} type="button">
                    Clear search and browse all
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );

  if (variant === "dialog") {
    return (
      <div className="catalog-search-scrim" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
        <div aria-labelledby="catalog-search-dialog-title" aria-modal="true" className="catalog-search-modal" role="dialog">
          {searchBody}
        </div>
      </div>
    );
  }
  return searchBody;
}
