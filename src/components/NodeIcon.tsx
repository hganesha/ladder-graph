import { ICON_SPRITE_PATH } from "../generated/iconRegistry";

const spriteHref = `${import.meta.env.BASE_URL}${ICON_SPRITE_PATH}`;

export function NodeIcon({ className, name, size = 16 }: { className?: string; name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-node-icon={name}
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
    >
      <use href={`${spriteHref}#lucide-${name}`} />
    </svg>
  );
}
