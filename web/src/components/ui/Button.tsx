import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * The single source of truth for button styling.
 *
 * Styling lives here as Tailwind class strings rather than in `styles.css` —
 * there is no `.btn` component class anymore. Anything that looks like a button
 * should come from this file so the Model, Video and Export screens can't drift
 * apart again.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'ghost';

/** Shape, type and interaction — identical across every variant. */
const BASE =
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg ' +
  'border px-3.5 py-2 text-[13px] font-medium leading-tight ' +
  'cursor-pointer transition-[background,border-color,color] duration-100 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
  'disabled:cursor-not-allowed motion-reduce:transition-none';

/**
 * Disabled is a colour change, not a dimmer. Fading the blue or the green just
 * yields a muddy olive that reads as a broken swatch rather than an off state,
 * so the filled variants drop to the neutral panel fill instead.
 * `:disabled` outranks the plain class selectors below on specificity.
 */
const DISABLED_NEUTRAL = 'disabled:bg-bg-raised disabled:border-border disabled:text-text-faint';

/**
 * Buttons are flat: a fill, a hairline border, and a lighter fill on hover.
 * Nothing lifts or casts a shadow — depth here would compete with the viewport,
 * which is the only thing on screen that should read as dimensional.
 *
 * Colour carries meaning — blue for the main action, neutral for supporting
 * ones, green only for a finished render.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  // Lime is bright enough that only near-black text clears contrast on it.
  primary:
    'bg-accent border-accent text-accent-text ' +
    `enabled:hover:bg-accent-hover enabled:hover:border-accent-hover ${DISABLED_NEUTRAL}`,
  secondary:
    'bg-bg-raised border-border text-text ' +
    'enabled:hover:bg-bg-hover enabled:hover:border-border-strong disabled:text-text-faint',
  // A finished render is the one moment the app has good news, so it owns the
  // only green button in the product.
  success:
    'bg-ok border-ok text-[#04220f] ' +
    `enabled:hover:bg-[#4bef9d] enabled:hover:border-[#4bef9d] ${DISABLED_NEUTRAL}`,
  // No fill until you touch it, for a third action that shouldn't shout.
  ghost:
    'bg-transparent border-transparent text-text-dim ' +
    'enabled:hover:bg-bg-hover enabled:hover:text-text disabled:text-text-faint',
};

interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant;
  /** Extra layout classes only (width, margin) — never colour or padding. */
  className?: string;
  children: ReactNode;
}

export function Button({ variant = 'secondary', className = '', ...props }: ButtonProps) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

interface ButtonLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'className'> {
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}

/** Same styling for anchors — downloads and external links. */
export function ButtonLink({ variant = 'secondary', className = '', ...props }: ButtonLinkProps) {
  return <a className={`${BASE} no-underline ${VARIANTS[variant]} ${className}`} {...props} />;
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  /** Renders the selected state — for toggles and the selected tab. */
  active?: boolean;
  className?: string;
  children: ReactNode;
}

export function IconButton({ active = false, className = '', ...props }: IconButtonProps) {
  // Selected is a tint, matching every other selected thing in the product.
  // Transport controls are the most-pressed buttons on the screen and the
  // least consequential — a blue Play button outranked "Render MP4" while
  // doing nothing you can't undo by pressing it again.
  const state = active
    ? 'bg-bg-hover border-border-strong text-text'
    : 'bg-transparent border-transparent text-text-dim hover:bg-bg-hover hover:text-text';

  return (
    <button
      className={
        'inline-flex items-center justify-center rounded-lg border cursor-pointer ' +
        'transition-[background,color,border-color] duration-100 ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ' +
        'disabled:cursor-not-allowed disabled:opacity-40 ' +
        `${state} ${className}`
      }
      {...props}
    />
  );
}
