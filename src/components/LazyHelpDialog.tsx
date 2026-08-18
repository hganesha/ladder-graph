import { lazy, Suspense } from "react";
import type { HelpTopicId } from "./HelpDialog";

const HelpDialog = lazy(async () => {
  const module = await import("./HelpDialog");
  return { default: module.HelpDialog };
});

export function LazyHelpDialog({ onClose, initialTopic }: { onClose: () => void; initialTopic?: HelpTopicId }) {
  return (
    <Suspense fallback={null}>
      <HelpDialog initialTopic={initialTopic} onClose={onClose} />
    </Suspense>
  );
}
