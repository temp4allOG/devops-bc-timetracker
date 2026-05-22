const AUTH_CONFIG = {
  clientId: '',
  tenant: 'common',
  redirectUri: window.location.origin + window.location.pathname,
  scope: 'https://api.businesscentral.dynamics.com/Financials.ReadWrite.All offline_access openid profile'
};

const AUTH_STORAGE_KEY = 'bc_auth_token';

function setAuthStatus(msg) {
  const el = document.getElementById('auth-status');
  if (el) el.textContent = msg;
}

function storeAuthToken(tokenObj) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenObj));
}

function readAuthToken() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null'); }
  catch { return null; }
}

function getStoredAuthToken() {
  const tok = readAuthToken();
  if (!tok) return null;
  if (Date.now() >= tok.expiresAt) return null;
  return tok.accessToken;
}

function isTokenExpired() {
  const tok = readAuthToken();
  return !tok || Date.now() >= tok.expiresAt;
}

function decodeJwtExp(token) {
  try {
    const [, payload] = token.split('.');
    const json = JSON.parse(atob(payload.replace(/-/g,'+').replace(/_/g,'/')));
    return (json.exp || 0) * 1000;
  } catch { return Date.now() + 300000; }
}

function startOAuthPKCE() {
  if (!AUTH_CONFIG.clientId) throw new Error('Set AUTH_CONFIG.clientId in auth.js');
  // Minimal implicit-style fallback for demo (no secret in client). Real prod should use backend + PKCE.
  const state = Math.random().toString(36).slice(2);
  sessionStorage.setItem('bc_oauth_state', state);
  const authUrl = new URL(`https://login.microsoftonline.com/${AUTH_CONFIG.tenant}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', AUTH_CONFIG.clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', AUTH_CONFIG.redirectUri);
  authUrl.searchParams.set('response_mode', 'fragment');
  authUrl.searchParams.set('scope', AUTH_CONFIG.scope);
  authUrl.searchParams.set('state', state);
  window.location.href = authUrl.toString();
}

function tryHandleOAuthRedirect() {
  if (!window.location.hash.includes('access_token=')) return false;
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get('access_token');
  const state = hash.get('state');
  if (!token || state !== sessionStorage.getItem('bc_oauth_state')) return false;
  const expiresAt = decodeJwtExp(token);
  storeAuthToken({ accessToken: token, expiresAt });
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  return true;
}
