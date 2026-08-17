import { yaml } from "@codemirror/lang-yaml";
import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { useFormStore } from "../../store/useFormStore";

const formEditorTheme = EditorView.theme({
  "&": { height: "100%", background: "var(--editor-bg)", color: "var(--editor-text)" },
  ".cm-content": { fontFamily: "'IBM Plex Mono', ui-monospace, monospace", fontSize: "13px", padding: "18px 0" },
  ".cm-gutters": { background: "var(--editor-bg)", color: "var(--editor-gutter)", border: "none" },
  ".cm-activeLine": { background: "var(--editor-active-line)" },
  ".cm-activeLineGutter": { background: "var(--editor-active-gutter)" },
  ".cm-selectionBackground": { background: "var(--editor-selection)" },
  ".cm-focused": { outline: "none" },
});

const FORM_EDITOR_EXTENSIONS = [yaml(), formEditorTheme, EditorView.lineWrapping];

export function FormSourceEditor() {
  const source = useFormStore((state) => state.source);
  const setSource = useFormStore((state) => state.setSource);
  return (
    <section className="form-source-editor" aria-label="Canonical form YAML source">
      <div className="panel-title">
        <span>Form YAML</span>
        <small>canonical source · invalid drafts preserve the last valid canvas</small>
      </div>
      <CodeMirror
        basicSetup={{ foldGutter: true, highlightActiveLine: true, autocompletion: true, bracketMatching: true }}
        extensions={FORM_EDITOR_EXTENSIONS}
        height="100%"
        onChange={(value) => void setSource(value)}
        value={source}
      />
    </section>
  );
}
