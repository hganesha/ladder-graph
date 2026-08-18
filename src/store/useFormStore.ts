import { stringify } from "yaml";
import { create } from "zustand";
import { compiler } from "../compiler/client";
import type {
  ArtifactAnalysisResult,
  Diagnostic,
  FormField,
  FormPage,
  FormSection,
  LadderForm,
  Ontology,
  OntologyProperty,
} from "../types";

export type FormStudioMode = "builder" | "preview" | "source";
export type FormViewport = "desktop" | "narrow";

interface FormSelection {
  pageId: string | null;
  sectionId: string | null;
  fieldId: string | null;
}

interface FormStudioState {
  source: string;
  lastValidSource: string;
  form: LadderForm | null;
  ontology: Ontology | null;
  diagnostics: Diagnostic[];
  busy: boolean;
  mode: FormStudioMode;
  viewport: FormViewport;
  selection: FormSelection;
  past: string[];
  future: string[];
  load: (source: string, ontologySource?: string) => Promise<void>;
  setSource: (source: string, recordHistory?: boolean) => Promise<void>;
  setMode: (mode: FormStudioMode) => void;
  setViewport: (viewport: FormViewport) => void;
  selectPage: (pageId: string) => void;
  selectSection: (pageId: string, sectionId: string) => void;
  selectField: (pageId: string, sectionId: string, fieldId: string) => void;
  patchMetadata: (patch: Partial<LadderForm["metadata"]>) => Promise<void>;
  patchPage: (patch: Partial<FormPage>) => Promise<void>;
  patchSection: (patch: Partial<FormSection>) => Promise<void>;
  patchField: (patch: Partial<FormField>) => Promise<void>;
  addPage: () => Promise<void>;
  addSection: () => Promise<void>;
  addField: () => Promise<void>;
  addOntologyField: (property: OntologyProperty) => Promise<void>;
  duplicateSelected: () => Promise<void>;
  deleteSelected: () => Promise<void>;
  moveSelected: (direction: -1 | 1) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const EMPTY_SELECTION: FormSelection = { pageId: null, sectionId: null, fieldId: null };
let analysisRevision = 0;

function compilerFailure(error: unknown): Diagnostic {
  return {
    code: "LF900",
    severity: "error",
    path: "/",
    message: `Compiler unavailable: ${error instanceof Error ? error.message : String(error)}`,
  };
}

function cloneForm(form: LadderForm) {
  return structuredClone(form);
}

function slug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, "-")
      .replace(/^-|-$/gu, "") || "item"
  );
}

function uniqueId(values: string[], base: string) {
  const existing = new Set(values);
  let candidate = slug(base);
  let index = 2;
  while (existing.has(candidate)) candidate = `${slug(base)}-${index++}`;
  return candidate;
}

function allIds(form: LadderForm) {
  return form.spec.pages.flatMap((page) => [
    page.id,
    ...page.sections.flatMap((section) => [section.id, ...section.fields.map((field) => field.id)]),
  ]);
}

function selectedParts(form: LadderForm | null, selection: FormSelection) {
  const page = form?.spec.pages.find((item) => item.id === selection.pageId);
  const section = page?.sections.find((item) => item.id === selection.sectionId);
  const field = section?.fields.find((item) => item.id === selection.fieldId);
  return { page, section, field };
}

function defaultSelection(form: LadderForm | null): FormSelection {
  const page = form?.spec.pages[0];
  const section = page?.sections[0];
  return { pageId: page?.id ?? null, sectionId: section?.id ?? null, fieldId: section?.fields[0]?.id ?? null };
}

function fieldFromProperty(property: OntologyProperty, id: string): FormField {
  const dataType = property.dataType === "decimal" ? "number" : property.dataType;
  const widget = property.allowedValues?.length
    ? "select"
    : dataType === "boolean"
      ? "checkbox"
      : dataType === "date"
        ? "date"
        : dataType === "datetime"
          ? "datetime"
          : dataType === "number" || dataType === "integer"
            ? "number"
            : dataType === "array" || dataType === "object"
              ? "textarea"
              : "text";
  return {
    id,
    name: slug(property.id.split(".").at(-1) ?? property.id).replaceAll("-", "_"),
    label: property.label,
    description: property.description,
    dataType,
    widget,
    required: property.required,
    allowedValues: property.allowedValues,
    ontologyPropertyRef: property.id,
    accessibilityLabel: property.label,
  };
}

export const useFormStore = create<FormStudioState>((set, get) => {
  const analyzeSource = async (source: string, recordHistory = true) => {
    const revision = ++analysisRevision;
    const previous = get();
    set({
      source,
      busy: true,
      past: recordHistory ? [...previous.past.slice(-49), previous.source] : previous.past,
      future: recordHistory ? [] : previous.future,
    });
    let analysis: ArtifactAnalysisResult;
    try {
      analysis = await compiler.analyzeArtifact(source);
    } catch (error) {
      if (revision === analysisRevision) set({ busy: false, diagnostics: [compilerFailure(error)] });
      return;
    }
    if (revision !== analysisRevision) return;
    const analyzedForm = analysis.normalized?.kind === "Form" ? analysis.normalized : null;
    const form = analyzedForm && analysis.ok ? analyzedForm : null;
    set({
      busy: false,
      diagnostics: analysis.diagnostics,
      form: form ?? get().form,
      lastValidSource: form && analysis.ok ? source : get().lastValidSource,
      selection: form ? get().selection : get().selection,
    });
  };

  const commit = async (form: LadderForm, selection?: FormSelection) => {
    if (selection) set({ selection });
    await analyzeSource(stringify(form, { lineWidth: 110 }), true);
  };

  return {
    source: "",
    lastValidSource: "",
    form: null,
    ontology: null,
    diagnostics: [],
    busy: false,
    mode: "builder",
    viewport: "desktop",
    selection: EMPTY_SELECTION,
    past: [],
    future: [],
    load: async (source, ontologySource) => {
      const revision = ++analysisRevision;
      set({
        source,
        lastValidSource: "",
        form: null,
        ontology: null,
        diagnostics: [],
        busy: true,
        mode: "builder",
        viewport: "desktop",
        selection: EMPTY_SELECTION,
        past: [],
        future: [],
      });
      let formAnalysis: ArtifactAnalysisResult;
      let ontologyAnalysis: ArtifactAnalysisResult | null;
      try {
        [formAnalysis, ontologyAnalysis] = await Promise.all([
          compiler.analyzeArtifact(source),
          ontologySource ? compiler.analyzeArtifact(ontologySource) : Promise.resolve(null),
        ]);
      } catch (error) {
        if (revision === analysisRevision) set({ busy: false, diagnostics: [compilerFailure(error)] });
        return;
      }
      if (revision !== analysisRevision) return;
      const analyzedForm = formAnalysis.normalized?.kind === "Form" ? formAnalysis.normalized : null;
      const form = analyzedForm && formAnalysis.ok ? analyzedForm : null;
      const ontology = ontologyAnalysis?.normalized?.kind === "Ontology" ? ontologyAnalysis.normalized : null;
      set({
        source,
        lastValidSource: form && formAnalysis.ok ? source : "",
        form,
        ontology,
        diagnostics: formAnalysis.diagnostics,
        busy: false,
        mode: "builder",
        viewport: "desktop",
        selection: defaultSelection(form),
        past: [],
        future: [],
      });
    },
    setSource: analyzeSource,
    setMode: (mode) => set({ mode }),
    setViewport: (viewport) => set({ viewport }),
    selectPage: (pageId) => set({ selection: { pageId, sectionId: null, fieldId: null } }),
    selectSection: (pageId, sectionId) => set({ selection: { pageId, sectionId, fieldId: null } }),
    selectField: (pageId, sectionId, fieldId) => set({ selection: { pageId, sectionId, fieldId } }),
    patchMetadata: async (patch) => {
      const form = get().form;
      if (!form) return;
      const next = cloneForm(form);
      next.metadata = { ...next.metadata, ...patch };
      await commit(next);
    },
    patchPage: async (patch) => {
      const { form, selection } = get();
      const { page } = selectedParts(form, selection);
      if (!form || !page) return;
      const next = cloneForm(form);
      const target = next.spec.pages.find((item) => item.id === page.id);
      if (target) Object.assign(target, patch);
      await commit(next);
    },
    patchSection: async (patch) => {
      const { form, selection } = get();
      const { section } = selectedParts(form, selection);
      if (!form || !section) return;
      const next = cloneForm(form);
      const target = next.spec.pages.find((item) => item.id === selection.pageId)?.sections.find((item) => item.id === section.id);
      if (target) Object.assign(target, patch);
      await commit(next);
    },
    patchField: async (patch) => {
      const { form, selection } = get();
      const { field } = selectedParts(form, selection);
      if (!form || !field) return;
      const next = cloneForm(form);
      const target = next.spec.pages
        .find((item) => item.id === selection.pageId)
        ?.sections.find((item) => item.id === selection.sectionId)
        ?.fields.find((item) => item.id === field.id);
      if (target) Object.assign(target, patch);
      await commit(next);
    },
    addPage: async () => {
      const form = get().form;
      if (!form) return;
      const next = cloneForm(form);
      const id = uniqueId(allIds(next), "new-page");
      next.spec.pages.push({ id, title: "New page", sections: [] });
      await commit(next, { pageId: id, sectionId: null, fieldId: null });
    },
    addSection: async () => {
      const { form, selection } = get();
      if (!form) return;
      const next = cloneForm(form);
      const page = next.spec.pages.find((item) => item.id === selection.pageId) ?? next.spec.pages[0];
      if (!page) return;
      const id = uniqueId(allIds(next), "new-section");
      page.sections.push({ id, title: "New section", fields: [] });
      await commit(next, { pageId: page.id, sectionId: id, fieldId: null });
    },
    addField: async () => {
      const { form, selection } = get();
      if (!form) return;
      const next = cloneForm(form);
      const page = next.spec.pages.find((item) => item.id === selection.pageId) ?? next.spec.pages[0];
      const section = page?.sections.find((item) => item.id === selection.sectionId) ?? page?.sections[0];
      if (!page || !section) return;
      const id = uniqueId(allIds(next), "new-field");
      section.fields.push({ id, name: id.replaceAll("-", "_"), label: "New field", dataType: "string", widget: "text" });
      await commit(next, { pageId: page.id, sectionId: section.id, fieldId: id });
    },
    addOntologyField: async (property) => {
      const { form, selection } = get();
      if (!form) return;
      const next = cloneForm(form);
      const page = next.spec.pages.find((item) => item.id === selection.pageId) ?? next.spec.pages[0];
      const section = page?.sections.find((item) => item.id === selection.sectionId) ?? page?.sections[0];
      if (!page || !section) return;
      const id = uniqueId(allIds(next), property.id.split(".").at(-1) ?? "domain-field");
      section.fields.push(fieldFromProperty(property, id));
      await commit(next, { pageId: page.id, sectionId: section.id, fieldId: id });
    },
    duplicateSelected: async () => {
      const { form, selection } = get();
      const { page, section, field } = selectedParts(form, selection);
      if (!form) return;
      const next = cloneForm(form);
      const ids = allIds(next);
      if (field && section && page) {
        const targetSection = next.spec.pages.find((item) => item.id === page.id)?.sections.find((item) => item.id === section.id);
        const index = targetSection?.fields.findIndex((item) => item.id === field.id) ?? -1;
        if (!targetSection || index < 0) return;
        const copy = structuredClone(targetSection.fields[index]);
        copy.id = uniqueId(ids, `${copy.id}-copy`);
        copy.name = uniqueId(
          targetSection.fields.map((item) => item.name.replaceAll("_", "-")),
          `${copy.name}-copy`,
        ).replaceAll("-", "_");
        copy.label = `${copy.label} copy`;
        targetSection.fields.splice(index + 1, 0, copy);
        await commit(next, { pageId: page.id, sectionId: section.id, fieldId: copy.id });
      }
    },
    deleteSelected: async () => {
      const { form, selection } = get();
      const { page, section, field } = selectedParts(form, selection);
      if (!form) return;
      const next = cloneForm(form);
      if (field && section && page) {
        const target = next.spec.pages.find((item) => item.id === page.id)?.sections.find((item) => item.id === section.id);
        if (!target) return;
        target.fields = target.fields.filter((item) => item.id !== field.id);
        await commit(next, { pageId: page.id, sectionId: section.id, fieldId: target.fields[0]?.id ?? null });
      } else if (section && page) {
        const target = next.spec.pages.find((item) => item.id === page.id);
        if (!target) return;
        target.sections = target.sections.filter((item) => item.id !== section.id);
        await commit(next, { pageId: page.id, sectionId: target.sections[0]?.id ?? null, fieldId: null });
      } else if (page && next.spec.pages.length > 1) {
        next.spec.pages = next.spec.pages.filter((item) => item.id !== page.id);
        await commit(next, defaultSelection(next));
      }
    },
    moveSelected: async (direction) => {
      const { form, selection } = get();
      const { page, section, field } = selectedParts(form, selection);
      if (!form) return;
      const next = cloneForm(form);
      let list: Array<FormPage | FormSection | FormField>;
      let selectedId: string;
      if (field && section && page) {
        list = next.spec.pages.find((item) => item.id === page.id)?.sections.find((item) => item.id === section.id)?.fields ?? [];
        selectedId = field.id;
      } else if (section && page) {
        list = next.spec.pages.find((item) => item.id === page.id)?.sections ?? [];
        selectedId = section.id;
      } else if (page) {
        list = next.spec.pages;
        selectedId = page.id;
      } else return;
      const index = list.findIndex((item) => item.id === selectedId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= list.length) return;
      [list[index], list[target]] = [list[target], list[index]];
      await commit(next);
    },
    undo: async () => {
      const { past, source, future } = get();
      const previous = past.at(-1);
      if (!previous) return;
      set({ past: past.slice(0, -1), future: [source, ...future].slice(0, 50) });
      await analyzeSource(previous, false);
    },
    redo: async () => {
      const { past, source, future } = get();
      const next = future[0];
      if (!next) return;
      set({ past: [...past, source].slice(-50), future: future.slice(1) });
      await analyzeSource(next, false);
    },
  };
});

export function getSelectedFormParts(state: Pick<FormStudioState, "form" | "selection">) {
  return selectedParts(state.form, state.selection);
}
