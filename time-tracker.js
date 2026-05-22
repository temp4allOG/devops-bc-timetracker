let currentWorkItemId = null;
let workItemService = null;

function show(el, on=true){ document.getElementById(el).classList.toggle('hidden', !on); }
function setText(el,t){ const e=document.getElementById(el); if(e) e.textContent=t; }
function flash(id,msg){ setText(id,msg); show(id,true); setTimeout(()=>show(id,false),5000); }
function showError(m){ flash('error-message',m); }
function showSuccess(m){ flash('success-message',m); }

function statusBadge(syncStatus) {
  if (syncStatus === 'synced') return '<span class="badge badge-synced">synced</span>';
  if (syncStatus === 'error') return '<span class="badge badge-error">error</span>';
  return '<span class="badge badge-pending">pending</span>';
}

function formatDate(s){ const d=new Date(s); return isNaN(d)?s:d.toLocaleDateString(); }

async function initStandalone() {
  currentWorkItemId = Number(new URLSearchParams(location.search).get('workItemId') || 0) || 12345;
  document.getElementById('entry-date').valueAsDate = new Date();
  wireHandlers();
  if (tryHandleOAuthRedirect()) showSuccess('Connected to Business Central');
  refreshAuthUI();
  await loadTimeEntries();
}

function wireHandlers() {
  document.getElementById('auth-button').addEventListener('click', () => {
    try { startOAuthPKCE(); } catch (e) { showError(e.message); }
  });

  document.getElementById('time-entry-form').addEventListener('submit', handleSubmit);
  document.getElementById('apply-filter').addEventListener('click', loadTimeEntries);
}

function refreshAuthUI() {
  const ok = !!getStoredAuthToken();
  show('auth-section', !ok);
  show('entry-form', ok);
  show('history-section', ok);
  setAuthStatus(ok ? 'Connected' : 'Not connected');
}

async function handleSubmit(e) {
  e.preventDefault();
  show('loading-indicator', true);
  try {
    const date = document.getElementById('entry-date').value;
    const quantity = Number(document.getElementById('entry-hours').value);
    const extra = document.getElementById('entry-description').value.trim();
    const jobNumber = document.getElementById('bc-job-number').value.trim();
    if (!date || !quantity || quantity <= 0) throw new Error('Date and positive hours required');

    const workItemTitle = workItemService ? await workItemService.getFieldValue('System.Title') : 'Standalone test work item';
    const desc = `WI #${currentWorkItemId}: ${workItemTitle}${extra ? ' - ' + extra : ''}`;

    const localRef = { id: 'local_'+Date.now(), date, quantity, description: desc, jobNumber, syncStatus: 'pending' };
    saveLocalReference(currentWorkItemId, localRef);

    try {
      const created = await createTimeEntryInBC({ date, quantity, description: desc, jobNumber });
      localRef.id = created.id || localRef.id;
      localRef.syncStatus = 'synced';
      saveLocalReference(currentWorkItemId, localRef);
    } catch (apiErr) {
      localRef.syncStatus = 'error';
      saveLocalReference(currentWorkItemId, localRef);
      showError('Saved locally; BC sync failed: ' + apiErr.message);
    }

    e.target.reset();
    document.getElementById('entry-date').valueAsDate = new Date();
    showSuccess('Time entry logged');
    await loadTimeEntries();
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    show('loading-indicator', false);
  }
}

async function loadTimeEntries() {
  const list = document.getElementById('time-entries-list');
  const from = document.getElementById('filter-from').value;
  const to = document.getElementById('filter-to').value;
  let entries = await getTimeEntriesForWorkItem(currentWorkItemId);
  if (from) entries = entries.filter(e => (e.date || '') >= from);
  if (to) entries = entries.filter(e => (e.date || '') <= to);
  const total = entries.reduce((a,e)=>a+Number(e.quantity||0),0);
  document.getElementById('total-time').innerHTML = `Total: <strong>${total.toFixed(2)} hours</strong>`;
  if (!entries.length) { list.innerHTML = '<p>No entries yet.</p>'; return; }
  list.innerHTML = entries.sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(e => `
    <div class="time-entry">
      <div><strong>${formatDate(e.date)}</strong> — ${Number(e.quantity).toFixed(2)}h ${statusBadge(e.syncStatus)}</div>
      <div>${e.description || ''}</div>
      ${e.jobNumber ? `<div>Job: ${e.jobNumber}</div>` : ''}
    </div>
  `).join('');
}

(function boot(){
  if (window.VSS && window.VSS.init) {
    VSS.init({ explicitNotifyLoaded: true, usePlatformStyles: true });
    VSS.ready(function(){
      VSS.require(["TFS/WorkItemTracking/Services"], function(WorkItemServices) {
        WorkItemServices.WorkItemFormService.getService().then(function(svc) {
          workItemService = svc;
          svc.getId().then(function(id){ currentWorkItemId=id; wireHandlers(); refreshAuthUI(); loadTimeEntries(); VSS.notifyLoadSucceeded(); });
        }).catch(async ()=>{ await initStandalone(); VSS.notifyLoadSucceeded(); });
      });
    });
  } else {
    initStandalone();
  }
})();
