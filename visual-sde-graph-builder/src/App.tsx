import { useState } from "react";
import { Studio } from "./components/Studio";
import { Welcome } from "./components/Welcome";

export default function App() {
  const [templateId, setTemplateId] = useState<string | null>(null);

  if (!templateId) {
    return <Welcome onStart={setTemplateId} />;
  }

  return <Studio templateId={templateId} onBack={() => setTemplateId(null)} />;
}
