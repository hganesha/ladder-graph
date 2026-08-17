export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <span className="brand-mark" aria-hidden="true">
        <img className="brand-logo brand-logo-dark" src="/icon-dark.png" alt="" />
        <img className="brand-logo brand-logo-light" src="/icon-light.png" alt="" />
      </span>
      <span>
        <strong>Ladder Graph</strong>
        {!compact && <small>Visual workflow compiler</small>}
      </span>
    </div>
  );
}
