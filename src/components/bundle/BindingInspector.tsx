import { ArrowDownToLine, Link2, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { attachedBundleRefs, bindingPathOptions, bundleAsset, nextBinding, ontologyPropertyOptions } from "../../lib/bundleEditor";
import type { BundleBinding, Diagnostic, WorkflowBundle } from "../../types";

interface BindingInspectorProps {
  bundle: WorkflowBundle;
  diagnostics: Diagnostic[];
  sources: Record<string, string>;
  onChange: (bundle: WorkflowBundle) => void;
}

const directions: BundleBinding["direction"][] = ["input", "output", "review", "approval"];
const transforms: Array<NonNullable<BundleBinding["transform"]>> = ["select", "rename", "merge", "filter", "deduplicate", "sort", "slice"];

function withBindings(bundle: WorkflowBundle, bindings: BundleBinding[]): WorkflowBundle {
  return { ...bundle, spec: { ...bundle.spec, bindings } };
}

export function BindingInspector({ bundle, diagnostics, sources, onChange }: BindingInspectorProps) {
  const bindings = bundle.spec.bindings ?? [];
  const keySequence = useRef(0);
  const bindingKeys = useRef<string[]>([]);
  while (bindingKeys.current.length < bindings.length) {
    keySequence.current += 1;
    bindingKeys.current.push(`binding-editor-${keySequence.current}`);
  }
  if (bindingKeys.current.length > bindings.length) bindingKeys.current.length = bindings.length;
  const renderedBindings = bindings.map((binding, index) => ({ binding, uiKey: bindingKeys.current[index] }));
  const refs = attachedBundleRefs(bundle);
  const properties = ontologyPropertyOptions(bundle.spec.ontology ? sources[bundle.spec.ontology.ref] : undefined);
  const bindingDiagnostics = diagnostics.filter((diagnostic) => diagnostic.path.startsWith("/spec/bindings"));

  const update = (index: number, binding: BundleBinding) => {
    onChange(
      withBindings(
        bundle,
        bindings.map((current, currentIndex) => (currentIndex === index ? binding : current)),
      ),
    );
  };

  const remove = (index: number) => {
    bindingKeys.current.splice(index, 1);
    onChange(
      withBindings(
        bundle,
        bindings.filter((_binding, currentIndex) => currentIndex !== index),
      ),
    );
  };

  const add = () => {
    const binding = nextBinding(bundle, sources);
    if (binding) onChange(withBindings(bundle, [...bindings, binding]));
  };

  return (
    <section className="binding-inspector" aria-labelledby="binding-inspector-title">
      <header>
        <div>
          <span className="eyebrow">Cross-artifact contract</span>
          <h2 id="binding-inspector-title">Bindings</h2>
          <p>Connect concrete fields and schemas. Every endpoint remains a reviewable JSON Pointer.</p>
        </div>
        <button className="compile-button" disabled={refs.length < 2} onClick={add} type="button">
          <Plus size={14} /> Add binding
        </button>
      </header>

      {bindings.length ? (
        <div className="binding-list">
          {renderedBindings.map(({ binding, uiKey }, index) => {
            const sourcePaths = bindingPathOptions(sources[binding.source.ref]);
            const targetPaths = bindingPathOptions(sources[binding.target.ref]);
            const issues = bindingDiagnostics.filter((diagnostic) => diagnostic.path.startsWith(`/spec/bindings/${index}`));
            return (
              <article className={issues.some((issue) => issue.severity === "error") ? "binding-card error" : "binding-card"} key={uiKey}>
                <header>
                  <Link2 size={15} />
                  <label>
                    <span>Binding ID</span>
                    <input
                      aria-label={`Binding ${index + 1} ID`}
                      value={binding.id}
                      onChange={(event) => update(index, { ...binding, id: event.target.value })}
                    />
                  </label>
                  <button
                    aria-label={`Delete binding ${binding.id}`}
                    className="icon-button danger"
                    onClick={() => remove(index)}
                    type="button"
                  >
                    <Trash2 size={14} />
                  </button>
                </header>

                <label className="binding-description">
                  <span>Description</span>
                  <input
                    aria-label={`Binding ${binding.id} description`}
                    value={binding.description ?? ""}
                    onChange={(event) => update(index, { ...binding, description: event.target.value || undefined })}
                  />
                </label>

                <div className="binding-endpoints">
                  <fieldset>
                    <legend>Source</legend>
                    <label>
                      <span>Asset</span>
                      <select
                        aria-label={`Binding ${binding.id} source asset`}
                        value={binding.source.ref}
                        onChange={(event) => {
                          const ref = event.target.value;
                          update(index, { ...binding, source: { ref, path: bindingPathOptions(sources[ref])[0]?.path ?? "/spec" } });
                        }}
                      >
                        {refs.map((ref) => (
                          <option key={ref} value={ref}>
                            {bundleAsset(ref)?.title ?? ref}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Field or schema</span>
                      <select
                        aria-label={`Binding ${binding.id} source path`}
                        value={binding.source.path}
                        onChange={(event) => update(index, { ...binding, source: { ...binding.source, path: event.target.value } })}
                      >
                        {!sourcePaths.some((option) => option.path === binding.source.path) ? (
                          <option value={binding.source.path}>{binding.source.path}</option>
                        ) : null}
                        {sourcePaths.map((option) => (
                          <option key={option.path} value={option.path}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>

                  <ArrowDownToLine aria-hidden="true" size={18} />

                  <fieldset>
                    <legend>Target</legend>
                    <label>
                      <span>Asset</span>
                      <select
                        aria-label={`Binding ${binding.id} target asset`}
                        value={binding.target.ref}
                        onChange={(event) => {
                          const ref = event.target.value;
                          update(index, { ...binding, target: { ref, path: bindingPathOptions(sources[ref])[0]?.path ?? "/spec" } });
                        }}
                      >
                        {refs.map((ref) => (
                          <option key={ref} value={ref}>
                            {bundleAsset(ref)?.title ?? ref}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Field or schema</span>
                      <select
                        aria-label={`Binding ${binding.id} target path`}
                        value={binding.target.path}
                        onChange={(event) => update(index, { ...binding, target: { ...binding.target, path: event.target.value } })}
                      >
                        {!targetPaths.some((option) => option.path === binding.target.path) ? (
                          <option value={binding.target.path}>{binding.target.path}</option>
                        ) : null}
                        {targetPaths.map((option) => (
                          <option key={option.path} value={option.path}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </fieldset>
                </div>

                <div className="binding-options">
                  <label>
                    <span>Direction</span>
                    <select
                      aria-label={`Binding ${binding.id} direction`}
                      value={binding.direction}
                      onChange={(event) => update(index, { ...binding, direction: event.target.value as BundleBinding["direction"] })}
                    >
                      {directions.map((direction) => (
                        <option key={direction} value={direction}>
                          {direction}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Ontology property</span>
                    <select
                      aria-label={`Binding ${binding.id} ontology property`}
                      disabled={!properties.length}
                      value={binding.ontologyPropertyRef ?? ""}
                      onChange={(event) => update(index, { ...binding, ontologyPropertyRef: event.target.value || undefined })}
                    >
                      <option value="">No semantic constraint</option>
                      {properties.map((property) => (
                        <option key={property.id} value={property.id}>
                          {property.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Safe transform</span>
                    <select
                      aria-label={`Binding ${binding.id} transform`}
                      value={binding.transform ?? ""}
                      onChange={(event) =>
                        update(index, {
                          ...binding,
                          transform: (event.target.value || undefined) as BundleBinding["transform"],
                        })
                      }
                    >
                      <option value="">None</option>
                      {transforms.map((transform) => (
                        <option key={transform} value={transform}>
                          {transform}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {issues.length ? (
                  <ul className="binding-issues">
                    {issues.map((issue) => (
                      <li key={`${issue.code}-${issue.path}`}>
                        <code>{issue.code}</code> {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="binding-empty-state">
          <Link2 size={22} />
          <strong>No explicit bindings yet</strong>
          <p>Attach at least one form or document, then connect it to a workflow input, output, review, or approval path.</p>
        </div>
      )}
    </section>
  );
}
