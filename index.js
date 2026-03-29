/* ============================================
   BMSIT&M Placement Support Portal
   index.js — Frontend logic + API integration
   ============================================ */

// ─── CONFIG ──────────────────────────────────
// Change this to your Azure backend URL when deployed
const API = 'https://tickets-bmsitnm.onrender.com';
const cors = require("cors");
app.use(cors());

// ─── SESSION STATE ───────────────────────────
let currentUser = null;   // { id, name, role } or null

// ─── NAVIGATION ──────────────────────────────
function navigate(view, event) {
  if (event) event.preventDefault();

  // Guard: login required for raise/track/admin
  if (['raise','track'].includes(view) && !currentUser) {
    showToast('Please sign in first', 'info');
    view = 'login';
  }
  if (view === 'admin' && currentUser?.role !== 'admin') {
    showToast('Access denied', 'error');
    return;
  }

  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById('view-' + view);
  if (target) { target.classList.add('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === view));

  if (view === 'faq')   renderFAQ();
  if (view === 'admin') { loadAdminStats(); loadAdminTickets(); }
  if (view === 'track') switchTrackTab('id');
}

// Same as navigate but redirects to login if not authed
function guardedNavigate(view) {
  if (!currentUser) {
    showToast('Please sign in to continue', 'info');
    navigate('login');
    return;
  }
  navigate(view);
}

function prefillCategory(cat) {
  const sel = document.getElementById('f-category');
  if (!sel) return;
  for (let opt of sel.options) {
    if (opt.text.replace(/&amp;/g, '&') === cat || opt.value === cat) {
      sel.value = opt.value; break;
    }
  }
}

// ─── MOBILE MENU ─────────────────────────────
function toggleMenu() {
  document.getElementById('mobile-menu').classList.toggle('open');
  document.getElementById('hamburger').classList.toggle('open');
}

window.addEventListener('scroll', () => {
  document.getElementById('site-header').classList.toggle('scrolled', window.scrollY > 10);
});

// ─── AUTH: UPDATE UI BASED ON ROLE ───────────
function applyAuthUI(user) {
  currentUser = user;
  const loggedIn = !!user;
  const isAdmin  = user?.role === 'admin';
  const isStudent = loggedIn && !isAdmin;

  // Nav links
  const show = (sel, visible) =>
    document.querySelectorAll(sel).forEach(el => el.style.display = visible ? '' : 'none');

  show('.nav-guest-only',    !loggedIn);
  show('.nav-auth-only',      loggedIn);
  show('.nav-student-only',   isStudent);
  show('.nav-admin-only',     isAdmin);
  show('.mob-guest-only',    !loggedIn);
  show('.mob-auth-only',      loggedIn);
  show('.mob-student-only',   isStudent);
  show('.mob-admin-only',     isAdmin);

  // Header user badge
  const headerUser  = document.getElementById('header-user');
  const headerName  = document.getElementById('header-user-name');
  const headerBadge = document.getElementById('header-role-badge');
  if (loggedIn) {
    headerUser.style.display  = 'flex';
    headerName.textContent    = user.name.split(' ')[0];
    headerBadge.textContent   = isAdmin ? 'Admin' : 'Student';
  } else {
    headerUser.style.display  = 'none';
  }
}

// ─── AUTH: CHECK SESSION ON LOAD ─────────────
async function checkSession() {
  try {
    const res  = await fetch(`${API}/auth/me`, { credentials: 'include' });
    const data = await res.json();
    if (data.loggedIn) applyAuthUI(data.user);
    else               applyAuthUI(null);
  } catch {
    applyAuthUI(null);
  }
}

// ─── AUTH TABS ───────────────────────────────
function switchAuthTab(tab) {
  document.getElementById('atab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('atab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-panel-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-panel-register').style.display = tab === 'register' ? 'block' : 'none';
}

// ─── LOGIN ───────────────────────────────────
async function loginUser() {
  const email    = document.getElementById('l-email').value.trim();
  const password = document.getElementById('l-password').value;
  const errEmail = document.getElementById('err-lemail');
  const errPass  = document.getElementById('err-lpassword');

  errEmail.textContent = ''; errPass.textContent = '';
  let ok = true;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEmail.textContent = 'Enter a valid email'; ok = false; }
  if (!password) { errPass.textContent = 'Enter your password'; ok = false; }
  if (!ok) return;

  const btn = document.querySelector('#auth-panel-login .btn-primary');
  setLoading(btn, true);

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) { errEmail.textContent = data.error || 'Login failed'; return; }

    applyAuthUI(data.user);
    showToast(`Welcome back, ${data.user.name.split(' ')[0]}!`);
    navigate(data.user.role === 'admin' ? 'admin' : 'home');
  } catch {
    errEmail.textContent = 'Could not reach server. Is the backend running?';
  } finally {
    setLoading(btn, false);
  }
}

// ─── REGISTER ────────────────────────────────
async function registerUser() {
  const name     = document.getElementById('r-name').value.trim();
  const email    = document.getElementById('r-email').value.trim();
  const password = document.getElementById('r-password').value;
  const usn      = document.getElementById('r-usn').value.trim().toUpperCase();
  const dept     = document.getElementById('r-dept').value;

  const errName = document.getElementById('err-rname');
  const errEmail = document.getElementById('err-remail');
  const errPass  = document.getElementById('err-rpassword');
  errName.textContent = errEmail.textContent = errPass.textContent = '';

  let ok = true;
  if (name.length < 2) { errName.textContent = 'Enter your full name'; ok = false; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errEmail.textContent = 'Enter a valid email'; ok = false; }
  if (password.length < 6) { errPass.textContent = 'Password must be at least 6 characters'; ok = false; }
  if (!ok) return;

  const btn = document.querySelector('#auth-panel-register .btn-primary');
  setLoading(btn, true);

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, usn, dept, role: 'student' }),
    });
    const data = await res.json();
    if (!res.ok) { errEmail.textContent = data.error || 'Registration failed'; return; }

    showToast('Account created! Please sign in.');
    switchAuthTab('login');
    document.getElementById('l-email').value = email;
  } catch {
    errEmail.textContent = 'Could not reach server. Is the backend running?';
  } finally {
    setLoading(btn, false);
  }
}

// ─── LOGOUT ──────────────────────────────────
async function logoutUser(event) {
  if (event) event.preventDefault();
  try {
    await fetch(`${API}/auth/logout`, { method: 'POST', credentials: 'include' });
  } catch { /* ignore */ }
  applyAuthUI(null);
  showToast('Signed out');
  navigate('home');
}

// ─── FORM VALIDATION ─────────────────────────
const validators = {
  name(v)    { return v.trim().length >= 2 ? '' : 'Please enter your full name'; },
  usn(v)     { return /^[0-9][A-Z]{2}[0-9]{2}[A-Z]{2,3}[0-9]{3}$/i.test(v.trim()) ? '' : 'Enter a valid USN (e.g. 1BM21CS001)'; },
  dept(v)    { return v ? '' : 'Please select your department'; },
  email(v)   { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address'; },
  phone(v)   { return /^[6-9]\d{9}$/.test(v.trim()) ? '' : 'Enter a valid 10-digit Indian mobile number'; },
  sem(v)     { return v ? '' : 'Please select your semester'; },
  category(v){ return v ? '' : 'Please select an issue category'; },
  title(v)   { return v.trim().length >= 5 ? '' : 'Title must be at least 5 characters'; },
  desc(v)    { return v.trim().length >= 20 ? '' : 'Please describe the issue in at least 20 characters'; },
};

function validateField(id, key) {
  const input = document.getElementById('f-' + id);
  const errEl = document.getElementById('err-' + (key || id));
  if (!input || !errEl) return true;
  const err = validators[key || id](input.value);
  errEl.textContent = err;
  input.classList.toggle('error', !!err);
  return !err;
}

// ─── FILE UPLOAD ─────────────────────────────
let uploadedFile = null;

function handleDragOver(e) { e.preventDefault(); document.getElementById('file-drop').classList.add('dragging'); }
function handleDrop(e) {
  e.preventDefault(); document.getElementById('file-drop').classList.remove('dragging');
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
}
function handleFile(e) { if (e.target.files[0]) processFile(e.target.files[0]); }

function processFile(file) {
  if (file.size > 5 * 1024 * 1024) { showToast('File exceeds 5MB limit', 'error'); return; }
  const allowed = ['application/pdf','image/png','image/jpeg','application/msword',
                   'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) { showToast('Unsupported file type', 'error'); return; }
  uploadedFile = file;
  document.getElementById('file-drop-content').innerHTML = `
    <span class="file-icon" style="color:var(--success)">✓</span>
    <span>${escapeHtml(file.name)}</span>
    <span class="file-types">${(file.size/1024).toFixed(1)} KB —
      <a href="#" onclick="removeFile(event)" style="color:var(--danger);text-decoration:underline;pointer-events:all">Remove</a>
    </span>`;
}

function removeFile(e) {
  e.preventDefault(); uploadedFile = null;
  document.getElementById('f-file').value = '';
  document.getElementById('file-drop-content').innerHTML = `
    <span class="file-icon">↑</span>
    <span>Click to upload or drag &amp; drop</span>
    <span class="file-types">PDF, PNG, JPG, DOC — max 5MB</span>`;
}

// ─── SUBMIT TICKET ───────────────────────────
async function submitTicket() {
  const fields = ['name','usn','dept','email','phone','sem','category','title','desc'];
  let allValid = true;
  fields.forEach(f => { if (!validateField(f)) allValid = false; });
  if (!allValid) {
    const firstErr = document.querySelector('.form-input.error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  const btn = document.querySelector('#view-raise .btn-primary');
  setLoading(btn, true);

  const body = {
    name:     document.getElementById('f-name').value.trim(),
    usn:      document.getElementById('f-usn').value.trim().toUpperCase(),
    dept:     document.getElementById('f-dept').value,
    email:    document.getElementById('f-email').value.trim().toLowerCase(),
    phone:    document.getElementById('f-phone').value.trim(),
    sem:      document.getElementById('f-sem').value,
    category: document.getElementById('f-category').value,
    priority: document.querySelector('input[name="priority"]:checked')?.value || 'Low',
    title:    document.getElementById('f-title').value.trim(),
    desc:     document.getElementById('f-desc').value.trim(),
    company:  document.getElementById('f-company').value.trim(),
    fileName: uploadedFile ? uploadedFile.name : null,
  };

  try {
    const res  = await fetch(`${API}/tickets`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Submission failed', 'error'); return; }
    resetForm();
    showModal(data.ticketId);
  } catch {
    showToast('Could not reach server. Is the backend running?', 'error');
  } finally {
    setLoading(btn, false);
  }
}

function resetForm() {
  ['f-name','f-usn','f-email','f-phone','f-title','f-desc','f-company']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  ['f-dept','f-sem','f-category'].forEach(id => { const el = document.getElementById(id); if (el) el.selectedIndex = 0; });
  const lowRadio = document.querySelector('input[name="priority"][value="Low"]');
  if (lowRadio) lowRadio.checked = true;
  document.querySelectorAll('.form-error').forEach(e => e.textContent = '');
  document.querySelectorAll('.form-input.error').forEach(e => e.classList.remove('error'));
  removeFile({ preventDefault: () => {} });
}

// ─── MODAL ───────────────────────────────────
function showModal(ticketId) {
  document.getElementById('modal-ticket-id').textContent = ticketId;
  document.getElementById('modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeAdminModal(); } });

// ─── TRACK ───────────────────────────────────
function switchTrackTab(tab) {
  document.getElementById('tab-id').classList.toggle('active',   tab === 'id');
  document.getElementById('tab-mine').classList.toggle('active', tab === 'mine');
  document.getElementById('track-panel-id').style.display   = tab === 'id'   ? 'block' : 'none';
  document.getElementById('track-panel-mine').style.display = tab === 'mine' ? 'block' : 'none';
  document.getElementById('track-results').style.display    = 'none';
}

async function trackById() {
  const val   = document.getElementById('t-id').value.trim().toUpperCase();
  const errEl = document.getElementById('err-tid');
  if (!val) { errEl.textContent = 'Please enter a Ticket ID'; return; }
  errEl.textContent = '';

  const btn = document.querySelector('#track-panel-id .btn-primary');
  setLoading(btn, true);

  try {
    const res  = await fetch(`${API}/tickets/${val}`, { credentials: 'include' });
    if (res.status === 404) { renderTrackResults([], val); return; }
    if (res.status === 403) { showToast('You can only view your own tickets', 'error'); return; }
    const data = await res.json();
    renderTrackResults(res.ok ? [data] : [], val);
  } catch {
    showToast('Could not reach server', 'error');
  } finally {
    setLoading(btn, false);
  }
}

async function loadMyTickets() {
  const btn = document.querySelector('#track-panel-mine .btn-primary');
  setLoading(btn, true);
  try {
    const res  = await fetch(`${API}/tickets/my`, { credentials: 'include' });
    const data = await res.json();
    renderTrackResults(Array.isArray(data) ? data : [], 'your account');
  } catch {
    showToast('Could not reach server', 'error');
  } finally {
    setLoading(btn, false);
  }
}

function renderTrackResults(tickets, query) {
  const container = document.getElementById('track-results');
  container.style.display = 'block';

  if (!tickets.length) {
    container.innerHTML = `<div class="no-results">
      <p>No tickets found for <strong>${escapeHtml(query)}</strong>.</p>
      <p style="margin-top:8px;font-size:.8rem">
        <a href="#" onclick="navigate('raise',event)" style="color:var(--black)">Raise a new ticket</a>
      </p></div>`;
    return;
  }

  container.innerHTML = tickets.map(t => {
    const badgeClass = 'badge-' + (t.status || 'open').toLowerCase().replace(/ /g, '-');
    return `<div class="ticket-result-card">
      <div class="ticket-result-header">
        <span class="ticket-id-display">${escapeHtml(t.ticketId)}</span>
        <span class="ticket-badge ${badgeClass}">${escapeHtml(t.status)}</span>
      </div>
      <div class="ticket-meta">
        <div><strong>Name</strong><br/>${escapeHtml(t.name)}</div>
        <div><strong>USN</strong><br/>${escapeHtml(t.usn)}</div>
        <div><strong>Category</strong><br/>${escapeHtml(t.category)}</div>
        <div><strong>Priority</strong><br/>${escapeHtml(t.priority)}</div>
        <div><strong>Submitted</strong><br/>${formatDate(t.createdAt)}</div>
        <div><strong>Department</strong><br/>${escapeHtml(t.dept)}</div>
      </div>
      <div class="ticket-desc-preview">
        <strong style="font-size:.72rem;letter-spacing:.1em;text-transform:uppercase">Issue</strong><br/>
        ${escapeHtml(t.title)}<br/>
        <span style="color:var(--grey-400)">${escapeHtml((t.desc||'').substring(0,200))}${(t.desc||'').length > 200 ? '…' : ''}</span>
      </div>
      ${t.adminNote ? `<div class="ticket-admin-note"><strong>Cell Note:</strong> ${escapeHtml(t.adminNote)}</div>` : ''}
    </div>`;
  }).join('');
}

// ─── ADMIN DASHBOARD ─────────────────────────
async function loadAdminStats() {
  try {
    const res  = await fetch(`${API}/admin/stats`, { credentials: 'include' });
    const data = await res.json();
    document.getElementById('stat-total').textContent    = data.total      ?? '—';
    document.getElementById('stat-open').textContent     = data.open       ?? '—';
    document.getElementById('stat-progress').textContent = data.inProgress ?? '—';
    document.getElementById('stat-resolved').textContent = data.resolved   ?? '—';
    document.getElementById('stat-closed').textContent   = data.closed     ?? '—';
  } catch { /* silently fail */ }
}

async function loadAdminTickets() {
  const status   = document.getElementById('filter-status')?.value   || '';
  const priority = document.getElementById('filter-priority')?.value || '';
  const category = document.getElementById('filter-category')?.value || '';

  const params = new URLSearchParams();
  if (status)   params.set('status',   status);
  if (priority) params.set('priority', priority);
  if (category) params.set('category', category);

  const list = document.getElementById('admin-ticket-list');
  list.innerHTML = '<div style="padding:40px;text-align:center;color:var(--grey-400)"><span class="spinner"></span> Loading…</div>';

  try {
    const res     = await fetch(`${API}/tickets?${params}`, { credentials: 'include' });
    const tickets = await res.json();

    if (!Array.isArray(tickets) || !tickets.length) {
      list.innerHTML = '<div class="no-results">No tickets match the selected filters.</div>';
      return;
    }

    list.innerHTML = `
      <div class="admin-ticket-row header-row">
        <span>Ticket ID</span><span>Student / Issue</span>
        <span>Category</span><span>Priority</span><span>Status</span><span>Action</span>
      </div>
      ${tickets.map(t => {
        const badgeClass = 'badge-' + (t.status||'open').toLowerCase().replace(/ /g,'-');
        return `<div class="admin-ticket-row">
          <span class="admin-ticket-name">${escapeHtml(t.ticketId)}<br/>
            <span style="font-size:.72rem;color:var(--grey-400)">${escapeHtml(t.name)}</span></span>
          <span class="admin-ticket-title" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</span>
          <span style="font-size:.78rem;color:var(--grey-600)">${escapeHtml(t.category)}</span>
          <span><span class="ticket-badge badge-${(t.priority||'low').toLowerCase()}" style="font-size:.6rem;padding:3px 8px">${escapeHtml(t.priority)}</span></span>
          <span><span class="ticket-badge ${badgeClass}">${escapeHtml(t.status)}</span></span>
          <span><button class="admin-ticket-btn" onclick="openAdminModal('${escapeHtml(t.ticketId)}','${escapeHtml(t.status)}',${JSON.stringify(t.adminNote||'')})">Update</button></span>
        </div>`;
      }).join('')}`;
  } catch {
    list.innerHTML = '<div class="no-results">Could not load tickets. Is the backend running?</div>';
  }
}

function clearFilters() {
  ['filter-status','filter-priority','filter-category'].forEach(id => {
    const el = document.getElementById(id); if (el) el.selectedIndex = 0;
  });
  loadAdminTickets();
}

// ─── ADMIN UPDATE MODAL ──────────────────────
function openAdminModal(ticketId, currentStatus, currentNote) {
  document.getElementById('am-ticket-id').value = ticketId;
  document.getElementById('am-status').value    = currentStatus;
  document.getElementById('am-note').value      = currentNote || '';
  document.getElementById('admin-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeAdminModal() {
  document.getElementById('admin-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function saveAdminUpdate() {
  const ticketId = document.getElementById('am-ticket-id').value;
  const status   = document.getElementById('am-status').value;
  const adminNote = document.getElementById('am-note').value.trim();

  const btn = document.querySelector('#admin-modal-overlay .btn-primary');
  setLoading(btn, true);

  try {
    const res = await fetch(`${API}/tickets/${ticketId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Update failed', 'error'); return; }
    showToast(`Ticket ${ticketId} updated`);
    closeAdminModal();
    loadAdminTickets();
    loadAdminStats();
  } catch {
    showToast('Could not reach server', 'error');
  } finally {
    setLoading(btn, false);
  }
}

// ─── FAQ ─────────────────────────────────────
const faqData = [
  { q: 'Who can raise a placement support ticket?', a: 'Any currently enrolled student of BMSIT&M in their 5th semester or above, MCA, MBA, or MTech students, and alumni facing post-placement document issues can raise a ticket.' },
  { q: 'How long does it take for my ticket to be resolved?', a: 'The Placement Cell aims to acknowledge all tickets within 24 working hours and resolve most issues within 48 working hours. Complex cases involving company coordination may take up to 5 working days.' },
  { q: 'What should I include in the issue description?', a: 'Include the company name, the date of the incident or communication, exactly what happened, what you expected to happen, and any reference numbers (like application IDs or test scores).' },
  { q: 'Can I attach proof or screenshots?', a: 'Yes. The ticket form accepts PDF, PNG, JPG, and Word documents up to 5MB. If your file is larger, please compress it or email it directly with your Ticket ID in the subject line.' },
  { q: 'What does each ticket status mean?', a: '"Open" means received and awaiting assignment. "In Progress" means actively being worked on. "Resolved" means the issue has been addressed. "Closed" means the ticket cycle is complete.' },
  { q: 'My offer letter has an error. How do I report it?', a: 'Select "Offer Letter & Documents" as the category. Upload a copy of the incorrect letter and clearly state what the correct information should be. The Placement Cell will liaise with the recruiter.' },
  { q: 'I was marked absent for a drive I attended. What should I do?', a: 'Raise a ticket under "Registration & Eligibility" and provide the company name, date of the drive, and any attendance confirmation you have. The cell will coordinate with the company.' },
  { q: 'What are the top companies that recruit from BMSIT&M?', a: 'Recent top recruiters include Amazon, Google, Microsoft, Infosys, Wipro, Accenture, Capgemini, Bosch, Deloitte, Samsung, HCL, IBM, and Flipkart across tech, consulting, and core engineering roles.' },
];

function renderFAQ() {
  const container = document.getElementById('faq-list');
  if (!container || container.dataset.rendered) return;
  container.innerHTML = faqData.map((item, i) => `
    <div class="faq-item" id="faq-${i}">
      <div class="faq-question" onclick="toggleFAQ(${i})">
        <span>${escapeHtml(item.q)}</span><span class="faq-icon">+</span>
      </div>
      <div class="faq-answer">${escapeHtml(item.a)}</div>
    </div>`).join('');
  container.dataset.rendered = 'true';
}

function toggleFAQ(i) {
  const item = document.getElementById('faq-' + i);
  if (!item) return;
  const wasOpen = item.classList.contains('open');
  document.querySelectorAll('.faq-item.open').forEach(el => el.classList.remove('open'));
  if (!wasOpen) item.classList.add('open');
}

// ─── UTILITIES ───────────────────────────────
function setLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.dataset.origText = btn.textContent;
    btn.innerHTML = '<span class="spinner"></span> Please wait…';
    btn.disabled  = true;
  } else {
    btn.textContent = btn.dataset.origText || 'Submit';
    btn.disabled    = false;
  }
}

function showToast(message, type = 'info') {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    Object.assign(toast.style, {
      position: 'fixed', bottom: '32px', left: '50%', transform: 'translateX(-50%)',
      color: '#fff', padding: '14px 28px', fontFamily: 'var(--font-body)', fontSize: '.82rem',
      letterSpacing: '.05em', zIndex: '9999', transition: 'opacity .3s ease',
      pointerEvents: 'none', whiteSpace: 'nowrap',
    });
    document.body.appendChild(toast);
  }
  toast.textContent         = message;
  toast.style.background    = type === 'error' ? 'var(--danger)' : type === 'info' ? 'var(--accent)' : 'var(--black)';
  toast.style.opacity       = '1';
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 3500);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── INIT ─────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkSession();   // check if user already has a session (e.g. page refresh)
  navigate('home');
});
