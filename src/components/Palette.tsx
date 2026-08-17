import {
  Boxes,
  ChevronDown,
  Combine,
  GitMerge,
  Layers3,
  Lightbulb,
  MessagesSquare,
  PanelLeftClose,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NODE_META, PALETTE_ORDER, ROLE_TEMPLATES } from "../lib/nodeMeta";
import { groupRoleTemplates, roleSubcategory } from "../lib/roleCategories";
import { useStudioStore } from "../store/useStudioStore";

export function Palette() {
  const [query, setQuery] = useState("");
  const addNode = useStudioStore((state) => state.addNode);
  const addRole = useStudioStore((state) => state.addRole);
  const addMacro = useStudioStore((state) => state.addMacro);
  const selectedId = useStudioStore((state) => state.selectedNodeId);
  const workflow = useStudioStore((state) => state.analysis?.normalized);
  const selectNode = useStudioStore((state) => state.selectNode);
  const togglePalette = useStudioStore((state) => state.togglePalette);
  const activeGroup = useMemo(() => {
    const selected = workflow?.spec.nodes.find((node) => node.id === selectedId);
    if (selected?.kind === "group") return selected;
    return workflow?.spec.nodes.find((node) => node.kind === "group" && node.config?.members?.includes(selectedId ?? ""));
  }, [selectedId, workflow]);
  const groups = useMemo(() => {
    const normalized = query.toLowerCase().trim();
    return PALETTE_ORDER.filter(
      (kind) =>
        !normalized || `${NODE_META[kind].label} ${NODE_META[kind].hint} ${NODE_META[kind].category}`.toLowerCase().includes(normalized),
    );
  }, [query]);
  const roleGroups = useMemo(() => groupRoleTemplates(ROLE_TEMPLATES, query), [query]);
  const visibleRoleCount = useMemo(() => roleGroups.reduce((count, category) => count + category.roles.length, 0), [roleGroups]);

  return (
    <aside className="palette panel" aria-label="Node and template palette">
      <div className="panel-title">
        <span>Library</span>
        <div className="panel-title-actions">
          <small>{ROLE_TEMPLATES.length} agents</small>
          <button className="panel-collapse" type="button" title="Close library" aria-label="Close library" onClick={togglePalette}>
            <PanelLeftClose size={14} />
          </button>
        </div>
      </div>
      <label className="search-field">
        <Search size={14} />
        <span className="sr-only">Search nodes and templates</span>
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search library" />
      </label>
      {activeGroup && (
        <div className="group-context">
          <span>
            Adding inside <strong>{activeGroup.name}</strong>
          </span>
          <button title="Leave group" aria-label="Leave group" onClick={() => selectNode(null)}>
            <X size={13} />
          </button>
        </div>
      )}
      <details aria-label="Visual macros" open>
        <summary>
          Visual macros <ChevronDown size={13} />
        </summary>
        <div className="macro-grid">
          <button onClick={() => void addMacro("parallel")}>
            <GitMerge size={15} />
            <span>Parallel</span>
          </button>
          <button onClick={() => void addMacro("pipeline")}>
            <Layers3 size={15} />
            <span>Pipeline</span>
          </button>
          <button onClick={() => void addMacro("reduce")}>
            <Combine size={15} />
            <span>Reduce</span>
          </button>
          <button onClick={() => void addMacro("verify")}>
            <ShieldCheck size={15} />
            <span>Verify</span>
          </button>
          <button onClick={() => void addMacro("debate")}>
            <MessagesSquare size={15} />
            <span>Debate</span>
          </button>
          <button onClick={() => void addMacro("brainstorm")}>
            <Lightbulb size={15} />
            <span>Brainstorm</span>
          </button>
        </div>
      </details>
      <details aria-label="Primitives" open={Boolean(query) && groups.length > 0}>
        <summary>
          Primitives <ChevronDown size={13} />
        </summary>
        <div className="palette-list">
          {groups.map((kind) => {
            const meta = NODE_META[kind];
            return (
              <button key={kind} onClick={() => void addNode(kind)}>
                <span className="palette-dot" style={{ background: meta.color }} />
                <span>
                  <strong>{meta.label}</strong>
                  <small>{meta.hint}</small>
                </span>
              </button>
            );
          })}
        </div>
      </details>
      <details aria-label="Agent templates" open={Boolean(query) && visibleRoleCount > 0}>
        <summary>
          Agent templates · {visibleRoleCount} <ChevronDown size={13} />
        </summary>
        <div className="role-categories">
          {roleGroups.map((category) => (
            <details
              aria-label={`${category.label} agent templates (${category.roles.length})`}
              className="role-category"
              key={category.id}
              open={Boolean(query)}
            >
              <summary>
                <span>
                  <strong>{category.label}</strong>
                  <small>{category.roles.length}</small>
                </span>
                <ChevronDown size={12} />
              </summary>
              <p>{category.description}</p>
              <div className="role-tree">
                {category.roles.map((role) => (
                  <button key={role.id} onClick={() => void addRole(role.name)}>
                    <Boxes size={13} />
                    <span>
                      <small>{roleSubcategory(role)}</small>
                      <strong>{role.name}</strong>
                    </span>
                  </button>
                ))}
              </div>
            </details>
          ))}
          {visibleRoleCount === 0 && <p className="role-empty">No agent templates match this search.</p>}
        </div>
      </details>
      <div className="palette-foot">
        <span>Edges are contracts.</span>
        <span>Loops require a hard bound.</span>
      </div>
    </aside>
  );
}
