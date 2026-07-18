import { auth0MgmtConfigured, config } from '../config';

interface Auth0Identity {
  provider?: string;
  access_token?: string;
}

interface Auth0User {
  identities?: Auth0Identity[];
}

interface ManagementTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

let cachedMgmtToken: { token: string; expiresAt: number } | null = null;

async function getManagementAccessToken(): Promise<string> {
  if (!auth0MgmtConfigured) {
    throw new Error(
      'Auth0 Management API is not configured (set AUTH0_MGMT_CLIENT_ID and AUTH0_MGMT_CLIENT_SECRET).',
    );
  }

  const now = Date.now();
  if (cachedMgmtToken && cachedMgmtToken.expiresAt > now + 60_000) {
    return cachedMgmtToken.token;
  }

  const { domain, mgmtClientId, mgmtClientSecret } = config.auth0;
  const response = await fetch(`https://${domain}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: mgmtClientId,
      client_secret: mgmtClientSecret,
      audience: `https://${domain}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });

  const body = (await response.json()) as ManagementTokenResponse;
  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_description || body.error || `Auth0 Management token request failed (${response.status})`,
    );
  }

  // Tokens typically last 24h; cache conservatively for 23h if expires_in is absent.
  const expiresInMs = 23 * 60 * 60 * 1000;
  cachedMgmtToken = { token: body.access_token, expiresAt: now + expiresInMs };
  return body.access_token;
}

/**
 * Fetch the GitHub access token Auth0 stored for this user's GitHub social
 * identity. Requires Management API scopes `read:users` + `read:user_idp_tokens`.
 */
export async function getGitHubTokenForUser(auth0Sub: string): Promise<string> {
  const mgmtToken = await getManagementAccessToken();
  const { domain } = config.auth0;
  const response = await fetch(
    `https://${domain}/api/v2/users/${encodeURIComponent(auth0Sub)}`,
    { headers: { Authorization: `Bearer ${mgmtToken}` } },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Auth0 user lookup failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const user = (await response.json()) as Auth0User;
  const github = user.identities?.find((identity) => identity.provider === 'github');
  if (!github?.access_token) {
    throw new Error('Sign in with GitHub to push. (No GitHub identity token on this Auth0 user.)');
  }
  return github.access_token;
}
