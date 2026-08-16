import { describe, expect, it } from "vitest";
import { inputContractLabel, inputContractModality, inputContractSchema, INPUT_CONTRACT_PRESETS } from "../src/lib/inputContracts";

describe("multimodal input contracts", () => {
  it("provides bounded text and media presets", () => {
    expect(INPUT_CONTRACT_PRESETS.map((preset) => preset.id)).toEqual(["text", "image", "audio", "video", "document", "mixed"]);

    const image = inputContractSchema("image");
    expect(inputContractModality(image)).toBe("image");
    expect(inputContractLabel(image)).toBe("Image");
    expect(image).toEqual(
      expect.objectContaining({
        required: ["asset", "instructions"],
        properties: expect.objectContaining({
          asset: expect.objectContaining({ contentMediaType: "image/*" }),
        }),
      }),
    );
  });

  it("caps mixed-media inputs and does not mislabel custom schemas", () => {
    const mixed = inputContractSchema("mixed") as { properties: { assets: { maxItems: number } } };
    expect(mixed.properties.assets.maxItems).toBe(12);
    expect(inputContractModality({ type: "object", properties: {} })).toBeNull();
  });
});
