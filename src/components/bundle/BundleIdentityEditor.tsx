import { BadgeInfo } from "lucide-react";
import type { WorkflowBundle } from "../../types";

export function BundleIdentityEditor({
  bundle,
  onChange,
}: {
  bundle: WorkflowBundle;
  onChange: (metadata: WorkflowBundle["metadata"]) => void;
}) {
  const update = (field: "name" | "title" | "description" | "version", value: string) => {
    onChange({ ...bundle.metadata, [field]: value });
  };
  return (
    <section className="bundle-identity-editor" aria-labelledby="bundle-identity-title">
      <header>
        <span aria-hidden="true">
          <BadgeInfo size={16} />
        </span>
        <div>
          <span className="eyebrow">Bundle identity</span>
          <h2 id="bundle-identity-title">Name and version</h2>
        </div>
      </header>
      <div>
        <label>
          <span>Title</span>
          <input aria-label="Bundle title" onChange={(event) => update("title", event.target.value)} value={bundle.metadata.title ?? ""} />
        </label>
        <label>
          <span>Slug</span>
          <input aria-label="Bundle slug" onChange={(event) => update("name", event.target.value)} value={bundle.metadata.name} />
        </label>
        <label>
          <span>Version</span>
          <input
            aria-label="Bundle version"
            onChange={(event) => update("version", event.target.value)}
            placeholder="1.0.0"
            value={bundle.metadata.version ?? ""}
          />
        </label>
        <label className="bundle-description-field">
          <span>Description</span>
          <textarea
            aria-label="Bundle description"
            onChange={(event) => update("description", event.target.value)}
            rows={2}
            value={bundle.metadata.description ?? ""}
          />
        </label>
      </div>
    </section>
  );
}
