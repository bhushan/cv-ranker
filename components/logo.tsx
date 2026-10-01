/** Kargo mark: a "k" whose leg is a cargo crate. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="logo-mark"
    >
      <rect width="32" height="32" rx="8" fill="var(--ink)" />
      <rect x="8" y="6" width="4.6" height="20" rx="1.2" fill="var(--signal)" />
      <path d="M12.6 16.6 21 6.8h5.4l-8.9 10.4z" fill="var(--signal)" />
      <rect
        x="16.4"
        y="18.4"
        width="9.2"
        height="7.6"
        rx="1.2"
        fill="var(--signal)"
      />
      <path d="M16.4 22.2h9.2" stroke="var(--ink)" strokeWidth="1.2" />
    </svg>
  );
}
export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={inverse ? "logo inverse" : "logo"}>
      <LogoMark />
      <span className="wordmark">kargo</span>
      <span className="product">Hiring</span>
    </span>
  );
}
