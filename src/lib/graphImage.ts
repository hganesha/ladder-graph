import type { Edge, Node, ReactFlowInstance } from "@xyflow/react";
import { downloadBlob, downloadUrl } from "./download";

export type GraphImageFormat = "png" | "svg";

const IMAGE_PADDING = 64;
const MAX_PNG_DIMENSION = 8_192;

interface ExportGraphImageOptions<NodeType extends Node, EdgeType extends Edge> {
  format: GraphImageFormat;
  instance: ReactFlowInstance<NodeType, EdgeType>;
  name: string;
  root: HTMLElement;
}

function nextFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

function exportSize(bounds: { width: number; height: number }, format: GraphImageFormat) {
  const maxDimension = format === "png" ? MAX_PNG_DIMENSION : Number.POSITIVE_INFINITY;
  const scale = Math.min(
    1,
    (maxDimension - IMAGE_PADDING * 2) / Math.max(bounds.width, 1),
    (maxDimension - IMAGE_PADDING * 2) / Math.max(bounds.height, 1),
  );
  return {
    height: Math.ceil(bounds.height * scale + IMAGE_PADDING * 2),
    scale,
    width: Math.ceil(bounds.width * scale + IMAGE_PADDING * 2),
  };
}

function includeInImage(node: HTMLElement) {
  return !node.classList?.contains("react-flow__handle") && !node.classList?.contains("react-flow__edgeupdater");
}

export async function exportGraphImage<NodeType extends Node, EdgeType extends Edge>({
  format,
  instance,
  name,
  root,
}: ExportGraphImageOptions<NodeType, EdgeType>) {
  const viewport = root.querySelector<HTMLElement>(".react-flow__viewport");
  const nodeIds = instance
    .getNodes()
    .filter((node) => !node.hidden)
    .map((node) => node.id);
  if (!viewport || !nodeIds.length) throw new Error("Add at least one node before exporting an image.");

  const bounds = instance.getNodesBounds(nodeIds);
  const { height, scale, width } = exportSize(bounds, format);
  const backgroundColor = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#090c0f";
  const style = {
    height: `${height}px`,
    transform: `translate(${IMAGE_PADDING - bounds.x * scale}px, ${IMAGE_PADDING - bounds.y * scale}px) scale(${scale})`,
    width: `${width}px`,
  };

  root.classList.add("graph-exporting");
  await nextFrame();
  try {
    const image = await import("html-to-image");
    const options = {
      backgroundColor,
      filter: includeInImage,
      height,
      pixelRatio: format === "png" ? Math.min(window.devicePixelRatio || 1, 2) : 1,
      style,
      width,
    };
    const filename = `${name || "workflow"}.${format}`;
    if (format === "png") {
      const blob = await image.toBlob(viewport, options);
      if (!blob) throw new Error("The browser could not create the PNG image.");
      downloadBlob(filename, blob);
      return;
    }
    downloadUrl(filename, await image.toSvg(viewport, options));
  } finally {
    root.classList.remove("graph-exporting");
  }
}
