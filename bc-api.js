const BC_CFG_KEY = 'bc_config';
const LOCAL_ENTRIES_KEY = 'bc_local_entries';

function getBCConfig() {
  const fromStorage = JSON.parse(localStorage.getItem(BC_CFG_KEY) || 'null');
  return fromStorage || {
    tenantId: '',
    environment: 'production',
    companyId: '',
    employeeId: '',
    unitOfMeasureCode: 'HOUR'
  };
}

function saveBCConfig(cfg) { localStorage.setItem(BC_CFG_KEY, JSON.stringify(cfg)); }

function bcBase(cfg) {
  return `https://api.businesscentral.dynamics.com/v2.0/${cfg.tenantId}/${cfg.environment}/api/v2.0/companies(${cfg.companyId})`;
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
    jobNumber: entry.jobNumber || '',
    jobTaskNumber: '',
    unitOfMeasureCode: cfg.unitOfMeasureCode || 'HOUR',
    description: entry.description || ''
  };
  const created = await bcFetch('/timeRegistrationEntries', { method: 'POST', body: JSON.stringify(body) });
  return created;
}

function saveLocalReference(workItemId, ref) {
  const all = JSON.parse(localStorage.getItem(LOCAL_ENTRIES_KEY) || '{}');
  if (!all[workItemId]) all[workItemId] = [];
  all[workItemId].push(ref);
  localStorage.setItem(LOCAL_ENTRIES_KEY, JSON.stringify(all));
}

function getLocalReferences(workItemId) {
  const all = JSON.parse(localStorage.getItem(LOCAL_ENTRIES_KEY) || '{}');
  return all[workItemId] || [];
}

async function getTimeEntriesForWorkItem(workItemId) {
  // Prefer BC fetch if configured; fallback local refs.
  try {
    const data = await bcFetch('/timeRegistrationEntries');
    const values = data.value || [];
    return values.filter(e => (e.description || '').includes(`#${workItemId}`)).map(e => ({
      id: e.id,
      date: e.date,
      quantity: Number(e.quantity || 0),
      description: e.description || '',
      jobNumber: e.jobNumber || '',
      syncStatus: 'synced'
    }));
  } catch {
    return getLocalReferences(workItemId);
  }
}
