import { History, RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { listRevisions, loadRevision, type RevisionRecord } from "../../lib/persistence";

interface BundleHistoryDialogProps {
  projectId: string;
  onClose: () => void;
  onRestore: (body: string) => Promise<void>;
}

export function BundleHistoryDialog({ projectId, onClose, onRestore }: BundleHistoryDialogProps) {
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listRevisions(projectId)
      .then((records) => {
        if (active) setRevisions(records);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : String(reason));
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="bundle-history-title" aria-modal="true" className="storage-dialog bundle-history-dialog" role="dialog">
        <header>
          <div>
            <History size={18} aria-hidden="true" />
            <div>
              <h2 id="bundle-history-title">Bundle history</h2>
              <p>Each save captures the bundle and every attached asset.</p>
            </div>
          </div>
          <button aria-label="Close bundle history" className="icon-button" onClick={onClose} type="button">
            <X size={16} />
          </button>
        </header>
        {error ? <p className="bundle-failure">Could not load history: {error}</p> : null}
        <div className="bundle-revision-list">
          {revisions.map((revision, index) => (
            <article key={revision.id}>
              <span>
                <strong>{index === 0 ? "Latest save" : `Revision ${revisions.length - index}`}</strong>
                <small>{new Date(revision.createdAt).toLocaleString()}</small>
              </span>
              <span className={revision.valid ? "revision-status valid" : "revision-status invalid"}>
                {revision.valid ? "Validated" : "Saved with errors"}
              </span>
              <button
                className="quiet-button"
                disabled={busyId !== null}
                onClick={() => {
                  setBusyId(revision.id);
                  setError(null);
                  void loadRevision(revision)
                    .then((body) => {
                      if (!body) throw new Error("The revision body is unavailable.");
                      return onRestore(body);
                    })
                    .then(onClose)
                    .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
                    .finally(() => setBusyId(null));
                }}
                type="button"
              >
                <RotateCcw size={13} /> {busyId === revision.id ? "Restoring…" : "Restore"}
              </button>
            </article>
          ))}
          {!error && revisions.length === 0 ? <p>No revisions have been saved yet.</p> : null}
        </div>
      </section>
    </div>
  );
}
