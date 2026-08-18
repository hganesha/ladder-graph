import { useMemo, useState } from "react";
import { parse } from "yaml";
import { ARTIFACT_TEMPLATES } from "../../generated/artifactCatalog";
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
  const template = ARTIFACT_TEMPLATES.find((artifact) => artifact.kind === "form" && artifact.id === initialTemplateId);
  const initialSource =
    initialProject?.yaml ?? providedSource ?? template?.yaml ?? ARTIFACT_TEMPLATES.find((artifact) => artifact.kind === "form")?.yaml ?? "";
  const [savedSource, setSavedSource] = useState(initialSource);
  const [projectId, setProjectId] = useState<string | null>(initialProject?.id ?? null);
  const [savedAt, setSavedAt] = useState<number | null>(initialProject?.updatedAt ?? null);
  const industry = template?.path.split("/")[0] ?? "";
  const ontologySource = useMemo(
    () => ARTIFACT_TEMPLATES.find((artifact) => artifact.kind === "ontology" && artifact.path.startsWith(`${industry}/`))?.yaml,
    [industry],
  );

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
