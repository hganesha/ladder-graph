import type { InputModality } from "../types";

export type { InputModality } from "../types";

export interface InputContractPreset {
  id: InputModality;
  label: string;
  description: string;
}

export const INPUT_CONTRACT_PRESETS: InputContractPreset[] = [
  { id: "text", label: "Text", description: "A written objective, prompt, or other UTF-8 text." },
  { id: "image", label: "Image", description: "One host-provided image plus optional text instructions." },
  { id: "audio", label: "Audio", description: "One host-provided audio asset plus language or task instructions." },
  { id: "video", label: "Video", description: "One host-provided video asset plus analysis or editing instructions." },
  { id: "document", label: "Document", description: "One PDF or document asset plus extraction instructions." },
  { id: "mixed", label: "Mixed media", description: "A bounded list of typed image, audio, video, or document references." },
];

const sourceDescription =
  "A host-provided data URL, local file reference, uploaded-asset identifier, or authorized HTTPS URL. Ladder Graph does not upload or fetch the asset.";

export function inputContractSchema(modality: InputModality): Record<string, unknown> {
  if (modality === "text") {
    return {
      type: "object",
      required: ["text"],
      properties: { text: { type: "string", description: "The user's objective, source text, or instructions." } },
      "x-ladder-input-mode": "text",
    };
  }
  if (modality === "mixed") {
    return {
      type: "object",
      required: ["assets", "instructions"],
      properties: {
        assets: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            required: ["uri", "mediaType"],
            properties: {
              uri: { type: "string", description: sourceDescription },
              mediaType: { type: "string", pattern: "^(image|audio|video|application)/" },
              name: { type: "string" },
            },
          },
        },
        instructions: { type: "string" },
      },
      "x-ladder-input-mode": "mixed",
    };
  }

  const contentMediaType =
    modality === "document" ? "application/pdf" : modality === "image" ? "image/*" : modality === "audio" ? "audio/*" : "video/*";
  return {
    type: "object",
    required: ["asset", "instructions"],
    properties: {
      asset: {
        type: "string",
        contentMediaType,
        description: sourceDescription,
      },
      instructions: { type: "string", description: "What the workflow should extract, analyze, transform, or create." },
      sourceRights: { type: "string", description: "User-supplied rights, consent, or provenance context when relevant." },
    },
    "x-ladder-input-mode": modality,
  };
}

export function inputContractModality(schema: Record<string, unknown> | null | undefined): InputModality | null {
  const value = schema?.["x-ladder-input-mode"];
  return INPUT_CONTRACT_PRESETS.some((preset) => preset.id === value) ? (value as InputModality) : null;
}

export function inputContractLabel(schema: Record<string, unknown> | null | undefined) {
  const modality = inputContractModality(schema);
  return INPUT_CONTRACT_PRESETS.find((preset) => preset.id === modality)?.label ?? null;
}
