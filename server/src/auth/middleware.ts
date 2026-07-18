import type { ErrorRequestHandler, RequestHandler } from 'express';
import { auth, UnauthorizedError } from 'express-oauth2-jwt-bearer';
import { auth0Configured, config } from '../config';

/**
 * Auth0 JWT validation for `/api/*`.
 *
 * Auth is optional for the product: core generate/modify/export flows work
 * anonymously. When Auth0 is configured we still mount a check that:
 * - accepts requests with no `Authorization` header (anonymous),
 * - validates the Bearer JWT when one is present (rejects bad tokens).
 *
 * Use `requireAuth` on routes that need a signed-in user (e.g. GitHub push).
 */

const jwtCheck: RequestHandler | null = auth0Configured
  ? auth({
      audience: config.auth0.audience,
      issuerBaseURL: `https://${config.auth0.domain}/`,
      tokenSigningAlg: 'RS256',
    })
  : null;

/** Soft auth for the whole `/api` router — anonymous OK, bad tokens rejected. */
export const optionalAuth: RequestHandler = (req, res, next) => {
  if (!jwtCheck) return next();
  if (!req.headers.authorization) return next();
  return jwtCheck(req, res, (err?: unknown) => {
    if (err) return sendAuthError(res, err);
    return next();
  });
};

/** Hard auth for signed-in-only features (GitHub export, etc.). */
export const requireAuth: RequestHandler = (req, res, next) => {
  if (!jwtCheck) {
    res.status(501).json({
      error: 'Auth0 is not configured on the server (set AUTH0_DOMAIN and AUTH0_AUDIENCE).',
    });
    return;
  }
  if (!req.headers.authorization) {
    res.status(401).json({
      error:
        'Missing Authorization Bearer token. Log in again after setting VITE_AUTH0_AUDIENCE to your Auth0 API identifier.',
    });
    return;
  }
  return jwtCheck(req, res, (err?: unknown) => {
    if (err) return sendAuthError(res, err);
    return next();
  });
};

function sendAuthError(res: import('express').Response, err: unknown): void {
  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error:
        err.message ||
        'Invalid or expired Auth0 token. Confirm AUTH0_AUDIENCE matches VITE_AUTH0_AUDIENCE and an Auth0 API exists with that identifier, then log out and log in again.',
    });
    return;
  }
  const message = err instanceof Error ? err.message : String(err);
  res.status(401).json({ error: message });
}

/** Express error handler for auth failures that slip through as next(err). */
export const authErrorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof UnauthorizedError) {
    sendAuthError(res, err);
    return;
  }
  next(err);
};
