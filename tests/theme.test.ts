import { afterEach, describe, expect, it } from "vitest";
import { applyTheme } from "../src/lib/theme";

describe("theme assets", () => {
  afterEach(() => {
    document.head.querySelector('link[data-ladder-icon="true"]')?.remove();
    window.localStorage.clear();
  });

  it("keeps the browser icon in sync with the selected theme", () => {
    const icon = document.createElement("link");
    icon.dataset.ladderIcon = "true";
    icon.rel = "icon";
    document.head.append(icon);

    applyTheme("dark");
    expect(icon.getAttribute("href")).toBe("/icon-dark.png");

    applyTheme("light");
    expect(icon.getAttribute("href")).toBe("/icon-light.png");
  });
});
