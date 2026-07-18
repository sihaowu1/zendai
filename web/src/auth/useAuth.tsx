import { Auth0Provider, useAuth0 } from '@auth0/auth0-react';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { auth0Config, isAuthConfigured } from './config';

export interface AuthValue {
  configured: boolean;
  isLoading: boolean;
  isAuthenticated: boolean;
  user: { name?: string; email?: string; picture?: string; sub?: string } | undefined;
  login: (opts?: { screenHint?: 'signup' | 'login'; connection?: string }) => Promise<void>;
  logout: () => void;
  getAccessToken: () => Promise<string | undefined>;
}

const anonymousAuth: AuthValue = {
  configured: false,
  isLoading: false,
  isAuthenticated: false,
  user: undefined,
  login: async () => undefined,
  logout: () => undefined,
  getAccessToken: async () => undefined,
};

const AuthContext = createContext<AuthValue>(anonymousAuth);

function Auth0Bridge({ children }: { children: ReactNode }) {
  const {
    isLoading,
    isAuthenticated,
    user,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const login = useCallback(
    async (opts?: { screenHint?: 'signup' | 'login'; connection?: string }) => {
      await loginWithRedirect({
        appState: { returnTo: opts?.connection === 'github' ? '/export' : '/model' },
        authorizationParams: {
          ...(opts?.screenHint ? { screen_hint: opts.screenHint } : {}),
          ...(opts?.connection ? { connection: opts.connection } : {}),
        },
      });
    },
    [loginWithRedirect],
  );

  const logout = useCallback(() => {
    // Must match Auth0 Allowed Logout URLs (`http://localhost:5173/`).
    auth0Logout({ logoutParams: { returnTo: `${window.location.origin}/` } });
  }, [auth0Logout]);

  const getAccessToken = useCallback(async () => {
    try {
      return await getAccessTokenSilently({
        authorizationParams: auth0Config.audience
          ? { audience: auth0Config.audience }
          : undefined,
      });
    } catch (err) {
      // Consent / missing API audience often needs an interactive login.
      console.warn('[auth] getAccessTokenSilently failed', err);
      return undefined;
    }
  }, [getAccessTokenSilently]);

  const value = useMemo<AuthValue>(
    () => ({
      configured: true,
      isLoading,
      isAuthenticated,
      user,
      login,
      logout,
      getAccessToken,
    }),
    [getAccessToken, isAuthenticated, isLoading, login, logout, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Wraps the tree in Auth0 when `VITE_AUTH0_*` are set; otherwise provides an
 * anonymous auth context so hooks never throw and the app stays usable.
 */
export function AuthRoot({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  if (!isAuthConfigured) {
    return <AuthContext.Provider value={anonymousAuth}>{children}</AuthContext.Provider>;
  }

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        // Trailing slash matches Auth0 Allowed Callback URLs (`http://localhost:5173/`).
        redirect_uri: `${window.location.origin}/`,
        ...(auth0Config.audience ? { audience: auth0Config.audience } : {}),
      }}
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => {
        navigate(appState?.returnTo ?? '/model', { replace: true });
      }}
    >
      <Auth0Bridge>{children}</Auth0Bridge>
    </Auth0Provider>
  );
}

export function useAuth(): AuthValue {
  return useContext(AuthContext);
}
