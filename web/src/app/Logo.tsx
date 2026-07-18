interface Props {
  size?: number;
}

/**
 * Zendai mark: an ensō (the hand-drawn zen circle, never fully closed) whose
 * gap reads as a blinking code cursor — zen circle meets code cursor. A thin
 * inner medallion ring and a faceted gem at the cursor give it a seal-like,
 * regal weight instead of a bare circle.
 */
export function Logo({ size = 22 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M38.5 13.5C41.4 17.3 43 21.9 43 27C43 36.4 35.4 44 26 44C16.6 44 9 36.4 9 27C9 17.6 16.6 10 26 10C29.7 10 33 11.1 35.8 13"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle
        cx="26"
        cy="27"
        r="13.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.28"
      />
      <g transform="translate(34.5 16) rotate(45)">
        <rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" className="fill-accent" />
        <path
          d="M-4.5 0H4.5M0 -4.5V4.5"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="0.75"
        />
      </g>
    </svg>
  );
}
