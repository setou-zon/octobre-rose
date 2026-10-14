/** Ruban rose (symbole de la lutte contre le cancer du sein) */
export function Ruban({ className, couleur = 'currentColor' }: { className?: string; couleur?: string }) {
  return (
    <svg className={className} viewBox="8 4 48 90" aria-hidden="true" focusable="false">
      <path d="M20 88 L40 52 C49 36 46 12 32 12 C18 12 15 36 24 52 L44 88" fill="none" stroke={couleur} strokeWidth="10" strokeLinejoin="round" />
    </svg>
  );
}
