import type { ReactNode } from 'react';
import { useAuth } from './useAuth';

export interface RequireAuthProps {
  children: ReactNode;
  /** Shown while Auth0 is resolving the session. */
  loading?: ReactNode;
  /**
   * Shown when the user is not signed in. Prefer this over an automatic
   * redirect so `/model` and `/video` stay usable anonymously — auth is
   * optional and mainly unlocks GitHub saving.
   */
  fallback?: ReactNode;
  /**
   * If true and there is no `fallback`, call `loginWithRedirect` instead of
   * rendering nothing. Default false (optional auth).
   */
  redirectToLogin?: boolean;
}

/**
 * Feature guard for signed-in-only UI (e.g. GitHub push). Does not wrap
 * `/model` or `/video` — those stay public. When Auth0 is not configured,
 * children render as-is.
 */
export function RequireAuth({
  children,
  loading = <p className="m-0 text-[13px] leading-normal text-text-faint">Checking sign-in…</p>,
  fallback,
  redirectToLogin = false,
}: RequireAuthProps) {
  const { configured, isLoading, isAuthenticated, login } = useAuth();

  // Auth unset: show fallback (e.g. "configure Auth0") when provided.
  if (!configured) return <>{fallback ?? children}</>;
  if (isLoading) return <>{loading}</>;
  if (isAuthenticated) return <>{children}</>;

  if (fallback) return <>{fallback}</>;
  if (redirectToLogin) {
    void login({ screenHint: 'login' });
    return <>{loading}</>;
  }
  return null;
}
