import { lazy, Suspense } from "react";

const HelpDialog = lazy(async () => {
  const module = await import("./HelpDialog");
  return { default: module.HelpDialog };
});

export function LazyHelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Suspense fallback={null}>
      <HelpDialog onClose={onClose} />
    </Suspense>
  );
}
