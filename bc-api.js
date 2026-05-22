const BC_CFG_KEY = 'bc_config';
const LOCAL_ENTRIES_KEY = 'bc_local_entries';

function getBCConfig() {
  return JSON.parse(localStorage.getItem(BC_CFG_KEY) || 'null') || {
    tenantId: '',
    environment: 'production',
    companyId: '',
    employeeId: '',
    unitOfMeasureCode: 'HOUR'
  };
}

function saveBCConfig(cfg) { localStorage.setItem(BC_CFG_KEY, JSON.stringify({ ...getBCConfig(), ...cfg })); }

function bcBase(cfg) {
  const company = encodeURIComponent(cfg.companyId);
  return `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(cfg.tenantId)}/${encodeURIComponent(cfg.environment || 'production')}/api/v2.0/companies(${company})`;
}

async function bcFetch(path, options = {}) {
  const token = getStoredAuthToken();
  if (!token) throw new Error('Not authenticated');
  const cfg = getBCConfig();
  if (!cfg.tenantId || !cfg.companyId) throw new Error('BC config missing tenantId/companyId');
  const res = await fetch(`${bcBase(cfg)}${path}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); msg = j.error?.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

async function createTimeEntryInBC(entry) {
  const cfg = getBCConfig();
  const body = {
    employeeId: cfg.employeeId || undefined,
    date: entry.date,
    quantity: entry.quantity,
    jobNo: entry.jobNumber || undefined,
    jobTaskNo: entry.jobTaskNumber || undefined,
    unitOfMeasureCode: cfg.unitOfMeasureCode || 'HOUR',
    description: entry.description || ''
  };
  return bcFetch('/timeRegistrationEntries', { method: 'POST', body: JSON.stringify(body) });
}

function saveLocalReference(workItemId, ref) {
  const all = JSON.parse(localStorage.getItem(LOCAL_ENTRIES_KEY) || '{}');
  const key = String(workItemId);
  if (!all[key]) all[key] = [];
  const i = all[key].findIndex(e => e.clientId === ref.clientId || e.id === ref.id);
  if (i >= 0) all[key][i] = ref; else all[key].push(ref);
  localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(all));
}

function getLocalReferences(workItemId) {
  const all = JSON.parse(localStorage.getItem(LOCAL_ENTRIES_KEY) || '{}');
  return all[String(workItemId)] || [];
}

async function getTimeEntriesForWorkItem(workItemId) {
  try {
    const data = await bcFetch('/timeRegistrationEntries');
    const values = data.value || [];
    return values.filter(e => (e.description || '').includes(`#${workItemId}`)).map(e => ({
      id: e.id,
      clientId: e.id,
      date: e.date,
      quantity: Number(e.quantity || 0),
      description: e.description || '',
      jobNumber: e.jobNo || e.jobNumber || '',
      syncStatus: 'synced'
    }));
  } catch {
    return getLocalReferences(workItemId);
  }
}
