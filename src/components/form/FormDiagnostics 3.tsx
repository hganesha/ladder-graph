import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { useFormStore } from "../../store/useFormStore";

export function FormDiagnostics() {
  const diagnostics = useFormStore((state) => state.diagnostics);
  const busy = useFormStore((state) => state.busy);
  const errors = diagnostics.filter((item) => item.severity === "error");
  return (
    <section className={`form-diagnostics${errors.length ? " error" : ""}`} aria-live="polite">
      <header>
        {errors.length ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
        <strong>{busy ? "Checking form…" : errors.length ? `${errors.length} blocking issues` : "Form contract valid"}</strong>
        <span>{diagnostics.length} diagnostics</span>
      </header>
      {diagnostics.length ? (
        <ul>
          {diagnostics.map((diagnostic) => (
            <li key={`${diagnostic.code}-${diagnostic.path}-${diagnostic.message}`}>
              <Info size={13} />
              <code>{diagnostic.code}</code>
              <span>{diagnostic.message}</span>
              <small>{diagnostic.path}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
