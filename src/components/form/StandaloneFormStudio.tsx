import { useEffect, useState } from "react";
import { parse } from "yaml";
import { ARTIFACT_INDEX } from "../../generated/catalog";
import { loadArtifactTemplate } from "../../lib/catalogRepository";
import { saveArtifactProject } from "../../lib/persistence";
import type { ProjectRecord } from "../../types";
import FormStudio from "./FormStudio";

export default function StandaloneFormStudio({
  initialProject,
  initialSource: providedSource,
  initialTemplateId,
  onBack,
}: {
  initialProject?: ProjectRecord;
  initialSource?: string;
  initialTemplateId?: string;
  onBack: () => void;
}) {
  const template = ARTIFACT_INDEX.find((artifact) => artifact.kind === "form" && artifact.id === initialTemplateId);
  const [savedSource, setSavedSource] = useState(initialProject?.yaml ?? providedSource ?? "");
  const [ontologySource, setOntologySource] = useState<string>();
  const [loading, setLoading] = useState(!initialProject?.yaml && !providedSource);
  const [loadError, setLoadError] = useState<string>();
  const [projectId, setProjectId] = useState<string | null>(initialProject?.id ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(initialProject?.updatedAt ?? null);
  useEffect(() => {
    let active = true;
    const selected = template ?? ARTIFACT_INDEX.find((artifact) => artifact.kind === "form");
    const industry = selected?.path.split("/")[0] ?? "";
    const ontology = ARTIFACT_INDEX.find((artifact) => artifact.kind === "ontology" && artifact.path.startsWith(`${industry}/`));
    void Promise.all([
      initialProject?.yaml || providedSource || !selected
        ? Promise.resolve(initialProject?.yaml ?? providedSource ?? "")
        : loadArtifactTemplate(selected.id).then((body) => body.yaml),
      ontology ? loadArtifactTemplate(ontology.id).then((body) => body.yaml) : Promise.resolve(undefined),
    ])
      .then(([source, ontologyYaml]) => {
        if (!active) return;
        setSavedSource(source);
        setOntologySource(ontologyYaml);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "The catalog form could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [initialProject?.yaml, providedSource, template]);

  const save = async (source: string) => {
    const form = parse(source) as { metadata?: { name?: string; title?: string } };
    const project = await saveArtifactProject({
      projectId,
      name: form.metadata?.title ?? form.metadata?.name ?? "Untitled form",
      yaml: source,
      lastValidYaml: source,
      target: initialProject?.target ?? "codex",
      valid: true,
      artifactKind: "form",
    });
    setProjectId(project.id);
    setSavedAt(project.updatedAt);
    setSavedSource(source);
  };

  if (loading) return <div className="workspace-loading">Opening form…</div>;
  if (loadError) return <div className="workspace-loading">Could not open form: {loadError}</div>;

  return (
    <FormStudio
      contextLabel={savedAt ? `Standalone form · saved ${new Date(savedAt).toLocaleTimeString()}` : "Standalone form project"}
      initialSource={savedSource}
      ontologySource={ontologySource}
      onBack={onBack}
      onSave={(source) => void save(source)}
      saveLabel="Save form"
    />
  );
}
