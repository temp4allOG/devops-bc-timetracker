const AUTH_CONFIG_KEY = 'bc_auth_config';
const AUTH_STORAGE_KEY = 'bc_auth_token';
const PKCE_VERIFIER_KEY = 'bc_pkce_verifier';

function getAuthConfig() {
  return JSON.parse(localStorage.getItem(AUTH_CONFIG_KEY) || 'null') || {
    clientId: '',
    tenant: 'common',
    redirectUri: window.location.origin + window.location.pathname,
    scope: 'https://api.businesscentral.dynamics.com/Financials.ReadWrite.All offline_access openid profile'
  };
}

function saveAuthConfig(partial) {
  const current = getAuthConfig();
  localStorage.setItem(AUTH_CONFIG_KEY, JSON.stringify({ ...current, ...partial }));
}

function setAuthStatus(msg) {
  const el = document.getElementById('auth-status');
  if (el) el.textContent = msg;
}

function storeAuthToken(tokenObj) { localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(tokenObj)); }
function clearAuthToken() { localStorage.removeItem(AUTH_STORAGE_KEY); }
function readAuthToken() {
  try { return JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || 'null'); }
  catch { return null; }
}
function getStoredAuthToken() {
  const tok = readAuthToken();
  if (!tok || Date.now() >= tok.expiresAt) return null;
  return tok.accessToken;
}
function isTokenExpired() { return !getStoredAuthToken(); }

function base64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function sha256Base64Url(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64Url(new Uint8Array(digest));
}
function randomVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function startOAuthPKCE() {
  const cfg = getAuthConfig();
  if (!cfg.clientId) throw new Error('Set Azure AD Client ID in settings first');
  const state = Math.random().toString(36).slice(2);
  const verifier = randomVerifier();
  sessionStorage.setItem('bc_oauth_state', state);
  sessionStorage.setItem(PKCE_VERIFIER_KEY, verifier);
  const authUrl = new URL(`https://login.microsoftonline.com/${cfg.tenant || 'common'}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', cfg.clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', cfg.redirectUri || window.location.origin + window.location.pathname);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', cfg.scope);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', await sha256Base64Url(verifier));
  authUrl.searchParams.set('code_challenge_method', 'S256');
  window.location.href = authUrl.toString();
}

async function tryHandleOAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state');
  if (!code) return false;
  if (state !== sessionStorage.getItem('bc_oauth_state')) throw new Error('OAuth state mismatch');
  const cfg = getAuthConfig();
  const verifier = sessionStorage.getItem(PKCE_VERIFIER_KEY);
  const tokenUrl = `https://login.microsoftonline.com/${cfg.tenant || 'common'}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: cfg.clientId,
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri || window.location.origin + window.location.pathname,
    code_verifier: verifier || '',
    scope: cfg.scope
  });
  const res = await fetch(tokenUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error('OAuth token exchange failed: ' + await res.text());
  const json = await res.json();
  storeAuthToken({ accessToken: json.access_token, refreshToken: json.refresh_token || null, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 });
  sessionStorage.removeItem(PKCE_VERIFIER_KEY);
  window.history.replaceState({}, document.title, window.location.pathname);
  return true;
}
