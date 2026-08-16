import { Cable, Database, HardDrive, RefreshCw, Send, ShieldCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { companionStatus, connectCompanion, publishToCompanion } from "../lib/mcpCompanion";
import { requestPersistentStorage, storageStatus } from "../lib/persistence";

interface Status {
  persisted: boolean;
  usage: number;
  quota: number;
  opfs: boolean;
}

interface McpStatus {
  reachable: boolean;
  paired: boolean;
  url: string;
  details?: { userEntries?: number; builtinEntries?: number };
}
function bytes(value: number) {
  return value > 1_000_000 ? `${(value / 1_000_000).toFixed(1)} MB` : `${Math.round(value / 1000)} KB`;
}

export function StorageDialog({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [mcp, setMcp] = useState<McpStatus | null>(null);
  const [mcpBusy, setMcpBusy] = useState(false);
  const [mcpMessage, setMcpMessage] = useState("");
  const refreshMcp = useCallback(async () => {
    setMcpBusy(true);
    setMcpMessage("");
    try {
      const next = await connectCompanion();
      setMcp(next);
      if (next.paired) setMcpMessage("Connected automatically to the local MCP companion.");
    } catch (error) {
      setMcp(await companionStatus());
      setMcpMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setMcpBusy(false);
    }
  }, []);
  useEffect(() => {
    void storageStatus().then(setStatus);
    void refreshMcp();
  }, [refreshMcp]);
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="storage-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="storage-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <Database size={17} />
            <span id="storage-title">Local storage</span>
          </div>
          <button aria-label="Close storage details" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="storage-hero">
          <HardDrive size={26} />
          <div>
            <strong>Your graphs stay in this browser</strong>
            <p>Ladder Graph has no account, backend, model connection, or telemetry. Export YAML for a durable backup.</p>
          </div>
        </div>
        <dl>
          <div>
            <dt>Persistence</dt>
            <dd>{status?.persisted ? "Requested and granted" : "Best effort"}</dd>
          </div>
          <div>
            <dt>Project database</dt>
            <dd>IndexedDB</dd>
          </div>
          <div>
            <dt>Revision storage</dt>
            <dd>{status?.opfs ? "OPFS with IndexedDB fallback" : "IndexedDB fallback"}</dd>
          </div>
          <div>
            <dt>Browser usage</dt>
            <dd>{status ? `${bytes(status.usage)} of ${bytes(status.quota)}` : "Checking…"}</dd>
          </div>
        </dl>
        <div className="storage-warning">
          <ShieldCheck size={16} />
          <span>Clearing site data can remove local projects. Download YAML before clearing browser storage.</span>
        </div>
        <button
          className="primary-button"
          onClick={async () => {
            await requestPersistentStorage();
            setStatus(await storageStatus());
          }}
        >
          Request persistent storage
        </button>
        <section className="mcp-companion" aria-labelledby="mcp-companion-title">
          <div className="mcp-companion-heading">
            <Cable size={18} />
            <div>
              <strong id="mcp-companion-title">MCP companion</strong>
              <span>{mcp?.reachable && mcp.paired ? "Connected" : "Waiting for local companion"}</span>
            </div>
          </div>
          <p>
            Publish saved workflows to the local Rust companion so chat agents can retrieve them without copy and paste. MCP access is
            read-only.
          </p>
          {!mcp?.paired ? (
            <div className="mcp-actions">
              <button disabled={mcpBusy} type="button" onClick={() => void refreshMcp()}>
                <RefreshCw size={14} /> Check again
              </button>
            </div>
          ) : (
            <div className="mcp-actions">
              <button
                disabled={mcpBusy || !mcp.reachable}
                onClick={async () => {
                  setMcpBusy(true);
                  setMcpMessage("");
                  try {
                    const result = await publishToCompanion();
                    setMcpMessage(`Published ${result.entries} user resources at ${new Date(result.publishedAt).toLocaleTimeString()}.`);
                    await refreshMcp();
                  } catch (error) {
                    setMcpMessage(error instanceof Error ? error.message : String(error));
                  } finally {
                    setMcpBusy(false);
                  }
                }}
              >
                <Send size={14} /> Publish saved library
              </button>
            </div>
          )}
          <small>
            Configure <code>ladder-graph-mcp</code> in your chat client once. The client starts it and this browser connects
            automatically—no pairing code required.
          </small>
          {mcp?.details ? (
            <small>
              {mcp.details.builtinEntries ?? 0} built-ins · {mcp.details.userEntries ?? 0} published user resources
            </small>
          ) : null}
          {mcpMessage ? <output>{mcpMessage}</output> : null}
        </section>
      </section>
    </div>
  );
}
