interface Props {
  size?: number;
}

/**
 * Zendai brand mark — renders the logo PNG at the requested size.
 */
export function Logo({ size = 22 }: Props) {
  return (
    <img
      src="/logo.png"
      alt="Zendai logo"
      width={size}
      height={size}
      style={{ objectFit: 'contain' }}
      aria-hidden="true"
    />
  );
}
