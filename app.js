/* ===== Best Yard LLC - Business Manager ===== */

// ===== Data Layer =====
const DB_KEYS = {
  clients: 'by_clients',
  jobs: 'by_jobs',
  notes: 'by_notes',
  quotes: 'by_quotes'
};

function getData(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch {
    return [];
  }
}

function setData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ===== State =====
let currentNoteFilter = 'all';
let currentQuoteFilter = 'all';
let scheduleView = 'month'; // 'month', 'week', 'day'

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  autoCompletePastJobs();
  setHeaderDate();
  setGreeting();
  document.getElementById('scheduleDate').value = new Date().toISOString().split('T')[0];
  setScheduleView('month');
  renderDashboard();
  renderNotes();
  renderQuotes();
  renderClients();
}

// ===== Auto-Complete Past Jobs =====
function autoCompletePastJobs() {
  const today = new Date().toISOString().split('T')[0];

  [DB_KEYS.jobs, 'by_oneoff_jobs'].forEach(key => {
    const items = getData(key);
    let changed = false;
    items.forEach(item => {
      if (item.date < today && item.status === 'scheduled') {
        item.status = 'completed';
        item.updatedAt = Date.now();
        changed = true;
      }
    });
    if (changed) setData(key, items);
  });
}

// ===== Header =====
function setHeaderDate() {
  const now = new Date();
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  document.getElementById('headerDate').textContent = now.toLocaleDateString('en-US', opts);
}

function setGreeting() {
  const hour = new Date().getHours();
  let greeting;
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else greeting = 'Good evening';
  document.getElementById('dashGreeting').innerHTML = `${greeting}! &#127793;`;
}

// ===== Tab Navigation =====
function switchTab(view) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('view' + capitalize(view)).classList.add('active');
  document.querySelector(`.nav-btn[data-view="${view}"]`).classList.add('active');

  // Refresh data on tab switch
  if (view === 'dashboard') renderDashboard();
  else if (view === 'schedule') renderSchedule();
  else if (view === 'notes') renderNotes();
  else if (view === 'quotes') renderQuotes();
  else if (view === 'clients') renderClients();
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ===== Dashboard =====
function renderDashboard() {
  const clients = getData(DB_KEYS.clients);
  const quotes = getData(DB_KEYS.quotes);
  const notes = getData(DB_KEYS.notes);

  const today = new Date().toISOString().split('T')[0];
  const todayItems = getItemsForDate(today);
  const pendingQuotes = quotes.filter(q => q.status === 'pending');

  document.getElementById('statTodayJobs').textContent = todayItems.length;
  document.getElementById('statClients').textContent = clients.length;
  document.getElementById('statPendingQuotes').textContent = pendingQuotes.length;
  document.getElementById('statNotes').textContent = notes.length;

  // Today's schedule
  const dashToday = document.getElementById('dashTodayList');
  if (todayItems.length === 0) {
    dashToday.innerHTML = '<div class="empty-state">No jobs scheduled today</div>';
  } else {
    todayItems.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    dashToday.innerHTML = todayItems.map(j => {
      const client = clients.find(c => c.id === j.clientId);
      const isJob = j.itemType === 'job';
      const title = isJob ? (j.title || j.service) : (client ? client.name : 'Unknown Client');
      return `<div class="dash-item">
        <div class="dash-item-left">
          <div class="dash-item-title">${escapeHtml(title)}</div>
          <div class="dash-item-sub">${formatTime(j.time)} &bull; ${j.service}</div>
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
          <span class="badge badge-${j.itemType}">${j.itemType}</span>
          <span class="badge badge-${j.status}">${formatStatus(j.status)}</span>
        </div>
      </div>`;
    }).join('');
  }

  // Recent notes
  const dashNotes = document.getElementById('dashRecentNotes');
  const recentNotes = [...notes].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3);
  if (recentNotes.length === 0) {
    dashNotes.innerHTML = '<div class="empty-state">No notes yet</div>';
  } else {
    dashNotes.innerHTML = recentNotes.map(n => {
      return `<div class="dash-item">
        <div class="dash-item-left">
          <div class="dash-item-title">${escapeHtml(n.title)}</div>
          <div class="dash-item-sub">${timeAgo(n.createdAt)}</div>
        </div>
        <span class="badge badge-${n.type}">${n.type}</span>
      </div>`;
    }).join('');
  }
}

// ===== Schedule =====
function getAllScheduleItems() {
  const jobs = getData(DB_KEYS.jobs).map(j => ({ ...j, itemType: 'maintenance' }));
  const oneOffs = getData('by_oneoff_jobs').map(j => ({ ...j, itemType: 'job' }));
  return [...jobs, ...oneOffs];
}

function getItemsForDate(dateStr) {
  return getAllScheduleItems().filter(j => j.date === dateStr && j.status !== 'cancelled');
}

function setScheduleView(view) {
  scheduleView = view;
  document.querySelectorAll('.schedule-view-toggle .chip').forEach(c => c.classList.remove('active'));
  document.getElementById('viewToggle' + capitalize(view)).classList.add('active');

  document.getElementById('monthView').classList.toggle('active', view === 'month');
  document.getElementById('weekView').classList.toggle('active', view === 'week');
  document.getElementById('dayView').classList.toggle('active', view === 'day');

  renderSchedule();
}

function goToToday() {
  document.getElementById('scheduleDate').value = new Date().toISOString().split('T')[0];
  renderSchedule();
}

function navigateSchedule(delta) {
  const input = document.getElementById('scheduleDate');
  const date = new Date(input.value + 'T12:00:00');

  if (scheduleView === 'month') {
    date.setMonth(date.getMonth() + delta);
  } else if (scheduleView === 'week') {
    date.setDate(date.getDate() + (delta * 7));
  } else {
    date.setDate(date.getDate() + delta);
  }

  input.value = date.toISOString().split('T')[0];
  renderSchedule();
}

function renderSchedule() {
  const dateStr = document.getElementById('scheduleDate').value;
  const date = new Date(dateStr + 'T12:00:00');
  updateScheduleLabel(date);

  if (scheduleView === 'month') renderMonthView(date);
  else if (scheduleView === 'week') renderWeekView(date);
  else renderDayView(date);
}

function updateScheduleLabel(date) {
  const label = document.getElementById('scheduleLabel');
  if (scheduleView === 'month') {
    label.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } else if (scheduleView === 'week') {
    const start = new Date(date);
    start.setDate(start.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = { month: 'short', day: 'numeric' };
    label.textContent = `${start.toLocaleDateString('en-US', fmt)} - ${end.toLocaleDateString('en-US', fmt)}`;
  } else {
    label.textContent = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }
}

// --- Month View ---
function renderMonthView(date) {
  const wrap = document.getElementById('monthView');
  const today = new Date().toISOString().split('T')[0];
  const selected = document.getElementById('scheduleDate').value;
  const allItems = getAllScheduleItems().filter(j => j.status !== 'cancelled');

  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  let html = `<div class="month-grid-header">
    <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
  </div><div class="month-grid">`;

  // Previous month filler
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const ds = formatDateStr(year, month - 1, d);
    html += `<div class="month-cell other-month" onclick="selectMonthDay('${ds}')">${d}</div>`;
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = formatDateStr(year, month, d);
    const isToday = ds === today;
    const isSelected = ds === selected;
    const dayItems = allItems.filter(j => j.date === ds);
    const hasMaint = dayItems.some(j => j.itemType === 'maintenance');
    const hasJob = dayItems.some(j => j.itemType === 'job');

    html += `<div class="month-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectMonthDay('${ds}')">
      ${d}
      ${(hasMaint || hasJob) ? `<div class="month-cell-dots">
        ${hasMaint ? '<span class="month-dot maintenance"></span>' : ''}
        ${hasJob ? '<span class="month-dot job"></span>' : ''}
      </div>` : ''}
    </div>`;
  }

  // Next month filler
  const totalCells = firstDay + daysInMonth;
  const remaining = (7 - (totalCells % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const ds = formatDateStr(year, month + 1, d);
    html += `<div class="month-cell other-month" onclick="selectMonthDay('${ds}')">${d}</div>`;
  }

  html += '</div>';

  // Day preview below calendar
  const previewItems = getItemsForDate(selected);
  const clients = getData(DB_KEYS.clients);
  const previewDate = new Date(selected + 'T12:00:00');
  html += `<div class="month-day-preview">
    <h4>${previewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} (${previewItems.length} items)</h4>`;

  if (previewItems.length === 0) {
    html += '<div class="empty-state">Nothing scheduled</div>';
  } else {
    previewItems.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
    html += '<div class="card-list">';
    html += previewItems.map(j => renderScheduleCard(j, clients)).join('');
    html += '</div>';
  }
  html += '</div>';

  wrap.innerHTML = html;
}

function selectMonthDay(ds) {
  document.getElementById('scheduleDate').value = ds;
  renderSchedule();
}

function formatDateStr(year, month, day) {
  const d = new Date(year, month, day);
  return d.toISOString().split('T')[0];
}

// --- Week View ---
function renderWeekView(date) {
  const wrap = document.getElementById('weekView');
  const today = new Date().toISOString().split('T')[0];
  const clients = getData(DB_KEYS.clients);

  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let html = '';

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const isToday = ds === today;
    const dayItems = getItemsForDate(ds);
    dayItems.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));

    html += `<div class="week-column">
      <div class="week-column-header ${isToday ? 'today' : ''}">
        <span>${dayNames[i]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
        <span class="week-column-count">${dayItems.length}</span>
      </div>
      <div class="week-column-body">`;

    if (dayItems.length === 0) {
      html += '<div class="week-empty">No items</div>';
    } else {
      html += dayItems.map(j => {
        const client = clients.find(c => c.id === j.clientId);
        const title = j.itemType === 'job' ? (j.title || j.service) : (client ? client.name : 'Unknown');
        const typeClass = j.itemType === 'job' ? 'type-job' : '';
        return `<div class="week-item ${typeClass}" onclick="viewScheduleItem('${j.id}','${j.itemType}')">
          <div class="week-item-title">${escapeHtml(title)}</div>
          <div class="week-item-detail">${formatTime(j.time)} &bull; ${j.itemType === 'job' ? escapeHtml(j.service || j.title) : j.service} <span class="badge badge-${j.itemType}" style="margin-left:4px">${j.itemType}</span></div>
        </div>`;
      }).join('');
    }

    html += '</div></div>';
  }

  wrap.innerHTML = html;
}

function viewScheduleItem(id, type) {
  if (type === 'job') {
    editOneOffJob(id);
  } else {
    editJob(id);
  }
}

// --- Day View ---
function renderDayView(date) {
  renderWeekStrip(date);
  const selectedDate = document.getElementById('scheduleDate').value;
  const items = getItemsForDate(selectedDate);
  const clients = getData(DB_KEYS.clients);
  const list = document.getElementById('scheduleList');

  if (items.length === 0) {
    list.innerHTML = '<div class="empty-state">Nothing scheduled for this day</div>';
    return;
  }

  items.sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
  list.innerHTML = items.map(j => renderScheduleCard(j, clients)).join('');
}

function renderWeekStrip(centerDate) {
  const strip = document.getElementById('weekStrip');
  const today = new Date().toISOString().split('T')[0];
  const selected = document.getElementById('scheduleDate').value;
  const allItems = getAllScheduleItems();

  const startDate = new Date(centerDate);
  startDate.setDate(startDate.getDate() - 3);

  let html = '';
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().split('T')[0];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const isToday = ds === today;
    const isSelected = ds === selected;
    const hasItems = allItems.some(j => j.date === ds && j.status !== 'cancelled');

    html += `<div class="week-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" onclick="selectDayFromStrip('${ds}')">
      <span class="week-day-name">${dayNames[d.getDay()]}</span>
      <span class="week-day-num">${d.getDate()}</span>
      ${hasItems ? '<span class="week-day-dot"></span>' : ''}
    </div>`;
  }
  strip.innerHTML = html;
}

function selectDayFromStrip(dateStr) {
  document.getElementById('scheduleDate').value = dateStr;
  renderSchedule();
}

// --- Shared card renderer ---
function renderScheduleCard(j, clients) {
  const client = clients.find(c => c.id === j.clientId);
  const isJob = j.itemType === 'job';
  const typeBadge = `<span class="badge badge-${j.itemType}">${j.itemType}</span>`;
  const title = isJob ? (j.title || j.service) : (client ? escapeHtml(client.name) : 'Unknown Client');
  const subtitle = isJob ? j.service : j.service;
  const editFn = isJob ? `editOneOffJob('${j.id}')` : `editJob('${j.id}')`;
  const delType = isJob ? 'oneoff' : 'job';

  let extras = '';
  if (isJob && j.price) extras += `<div class="card-detail mt-8" style="color:var(--sage);font-weight:700">$${parseFloat(j.price).toFixed(2)}${j.duration ? ' &bull; ' + j.duration : ''}</div>`;
  if (isJob && j.description) extras += `<div class="card-detail" style="margin-top:4px">${escapeHtml(j.description)}</div>`;

  return `<div class="card" style="${isJob ? 'border-left:4px solid var(--sage)' : 'border-left:4px solid var(--navy)'}">
    <div class="card-top">
      <div>
        <div class="card-title">${title}</div>
        <div class="card-subtitle">${subtitle}</div>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
        ${typeBadge}
        <span class="badge badge-${j.status}">${formatStatus(j.status)}</span>
      </div>
    </div>
    <div class="card-detail">${formatTime(j.time)}${client && client.address ? ' &bull; ' + escapeHtml(client.address) : ''}</div>
    ${j.notes ? `<div class="card-detail" style="margin-top:4px">${escapeHtml(j.notes)}</div>` : ''}
    ${extras}
    <div class="card-actions">
      <button class="btn-action edit" onclick="${editFn}">Edit</button>
      <button class="btn-action" style="color:var(--warning);border-color:var(--warning)" onclick="openReschedule('${j.id}','${j.itemType}')">Reschedule</button>
      ${j.status === 'scheduled' ? `<button class="btn-action" style="color:var(--sage);border-color:var(--sage)" onclick="quickStatus('${j.id}','${j.itemType}','in-progress')">Start</button>` : ''}
      ${j.status === 'in-progress' ? `<button class="btn-action" style="color:var(--success);border-color:var(--success)" onclick="quickStatus('${j.id}','${j.itemType}','completed')">Complete</button>` : ''}
      <button class="btn-action delete" onclick="confirmDelete('${delType}','${j.id}')">Delete</button>
      ${client && client.phone ? `<a class="btn-action call" href="tel:${client.phone}">Call</a>` : ''}
    </div>
  </div>`;
}

// --- Status updates ---
function quickStatus(id, type, status) {
  const key = type === 'job' ? 'by_oneoff_jobs' : DB_KEYS.jobs;
  const items = getData(key);
  const idx = items.findIndex(j => j.id === id);
  if (idx >= 0) {
    items[idx].status = status;
    items[idx].updatedAt = Date.now();
    setData(key, items);
    renderSchedule();
  }
}

function quickStatusJob(id, status) {
  quickStatus(id, 'maintenance', status);
}

// --- Reschedule ---
function openReschedule(id, type) {
  const key = type === 'job' ? 'by_oneoff_jobs' : DB_KEYS.jobs;
  const items = getData(key);
  const item = items.find(j => j.id === id);
  if (!item) return;

  document.getElementById('rescheduleId').value = id;
  document.getElementById('rescheduleType').value = type;
  document.getElementById('rescheduleDate').value = item.date;
  document.getElementById('rescheduleTime').value = item.time;
  openModal('rescheduleModal');
}

function saveReschedule(e) {
  e.preventDefault();
  const id = document.getElementById('rescheduleId').value;
  const type = document.getElementById('rescheduleType').value;
  const newDate = document.getElementById('rescheduleDate').value;
  const newTime = document.getElementById('rescheduleTime').value;
  const reason = document.getElementById('rescheduleReason').value;

  const key = type === 'job' ? 'by_oneoff_jobs' : DB_KEYS.jobs;
  const items = getData(key);
  const idx = items.findIndex(j => j.id === id);
  if (idx >= 0) {
    const oldDate = items[idx].date;
    items[idx].date = newDate;
    items[idx].time = newTime;
    items[idx].updatedAt = Date.now();
    if (reason) {
      items[idx].notes = (items[idx].notes ? items[idx].notes + '\n' : '') + `Rescheduled from ${oldDate}: ${reason}`;
    }
    setData(key, items);
  }

  closeModal('rescheduleModal');
  renderSchedule();
}

// --- Bulk Reschedule ---
function openBulkReschedule() {
  const selectedDate = document.getElementById('scheduleDate').value;
  const items = getItemsForDate(selectedDate).filter(j => j.status === 'scheduled');

  if (items.length === 0) {
    alert('No scheduled items to move on this day.');
    return;
  }

  document.getElementById('bulkCount').textContent = items.length;
  document.getElementById('bulkFromDate').textContent = new Date(selectedDate + 'T12:00:00')
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  document.getElementById('bulkNewDate').value = '';
  openModal('bulkRescheduleModal');
}

function saveBulkReschedule(e) {
  e.preventDefault();
  const fromDate = document.getElementById('scheduleDate').value;
  const toDate = document.getElementById('bulkNewDate').value;
  const reason = document.getElementById('bulkReason').value;

  [DB_KEYS.jobs, 'by_oneoff_jobs'].forEach(key => {
    const items = getData(key);
    let changed = false;
    items.forEach(item => {
      if (item.date === fromDate && item.status === 'scheduled') {
        item.notes = (item.notes ? item.notes + '\n' : '') + `Rescheduled from ${fromDate}: ${reason}`;
        item.date = toDate;
        item.updatedAt = Date.now();
        changed = true;
      }
    });
    if (changed) setData(key, items);
  });

  closeModal('bulkRescheduleModal');
  renderSchedule();
}

// --- Edit Maintenance ---
function editJob(id) {
  const jobs = getData(DB_KEYS.jobs);
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  document.getElementById('scheduleModalTitle').textContent = 'Edit Maintenance';
  document.getElementById('jobId').value = job.id;
  populateClientSelect('jobClient');
  document.getElementById('jobClient').value = job.clientId;
  document.getElementById('jobDate').value = job.date;
  document.getElementById('jobTime').value = job.time;
  document.getElementById('jobService').value = job.service;
  document.getElementById('jobNotes').value = job.notes || '';
  document.getElementById('jobStatus').value = job.status;
  openModal('scheduleModal');
}

function saveJob(e) {
  e.preventDefault();
  const id = document.getElementById('jobId').value;
  const job = {
    id: id || genId(),
    clientId: document.getElementById('jobClient').value,
    date: document.getElementById('jobDate').value,
    time: document.getElementById('jobTime').value,
    service: document.getElementById('jobService').value,
    notes: document.getElementById('jobNotes').value.trim(),
    status: document.getElementById('jobStatus').value,
    updatedAt: Date.now()
  };

  const jobs = getData(DB_KEYS.jobs);
  const idx = jobs.findIndex(j => j.id === job.id);
  const isNew = idx < 0;
  if (idx >= 0) {
    job.createdAt = jobs[idx].createdAt;
    jobs[idx] = job;
  } else {
    job.createdAt = Date.now();
    jobs.push(job);
  }

  // Auto-generate recurring visits for new maintenance
  if (isNew) {
    const client = getData(DB_KEYS.clients).find(c => c.id === job.clientId);
    if (client && client.frequency) {
      const daysBetween = { weekly: 7, biweekly: 14, monthly: 30 };
      const interval = daysBetween[client.frequency];
      if (interval) {
        const startDate = new Date(job.date + 'T12:00:00');
        const weeksOut = 12; // generate ~12 weeks of visits
        const count = Math.floor((weeksOut * 7) / interval);
        for (let i = 1; i <= count; i++) {
          const nextDate = new Date(startDate);
          nextDate.setDate(nextDate.getDate() + (interval * i));
          jobs.push({
            id: genId(),
            clientId: job.clientId,
            date: nextDate.toISOString().split('T')[0],
            time: job.time,
            service: 'Maintenance',
            notes: '',
            status: 'scheduled',
            recurring: true,
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      }
    }
  }

  setData(DB_KEYS.jobs, jobs);
  closeModal('scheduleModal');
  renderSchedule();
}

// --- One-Off Jobs ---
function editOneOffJob(id) {
  const jobs = getData('by_oneoff_jobs');
  const job = jobs.find(j => j.id === id);
  if (!job) return;

  document.getElementById('oneOffJobModalTitle').textContent = 'Edit Job';
  document.getElementById('oneOffJobId').value = job.id;
  populateClientSelect('oneOffJobClient');
  document.getElementById('oneOffJobClient').value = job.clientId;
  document.getElementById('oneOffJobTitle').value = job.title || '';
  document.getElementById('oneOffJobDate').value = job.date;
  document.getElementById('oneOffJobTime').value = job.time;
  document.getElementById('oneOffJobDuration').value = job.duration || 'half-day';
  document.getElementById('oneOffJobPrice').value = job.price || '';
  document.getElementById('oneOffJobDesc').value = job.description || '';
  document.getElementById('oneOffJobStatus').value = job.status;
  openModal('oneOffJobModal');
}

function saveOneOffJob(e) {
  e.preventDefault();
  const id = document.getElementById('oneOffJobId').value;
  const job = {
    id: id || genId(),
    clientId: document.getElementById('oneOffJobClient').value,
    title: document.getElementById('oneOffJobTitle').value.trim(),
    date: document.getElementById('oneOffJobDate').value,
    time: document.getElementById('oneOffJobTime').value,
    service: document.getElementById('oneOffJobTitle').value.trim(),
    duration: document.getElementById('oneOffJobDuration').value,
    price: document.getElementById('oneOffJobPrice').value,
    description: document.getElementById('oneOffJobDesc').value.trim(),
    status: document.getElementById('oneOffJobStatus').value,
    updatedAt: Date.now()
  };

  const jobs = getData('by_oneoff_jobs');
  const idx = jobs.findIndex(j => j.id === job.id);
  if (idx >= 0) {
    job.createdAt = jobs[idx].createdAt;
    jobs[idx] = job;
  } else {
    job.createdAt = Date.now();
    jobs.push(job);
  }

  setData('by_oneoff_jobs', jobs);
  closeModal('oneOffJobModal');
  renderSchedule();
}

// ===== Notes =====
function renderNotes() {
  const search = (document.getElementById('noteSearch')?.value || '').toLowerCase();
  let notes = getData(DB_KEYS.notes);
  const clients = getData(DB_KEYS.clients);

  if (currentNoteFilter !== 'all') {
    notes = notes.filter(n => n.type === currentNoteFilter);
  }
  if (search) {
    notes = notes.filter(n =>
      n.title.toLowerCase().includes(search) ||
      (n.details || '').toLowerCase().includes(search)
    );
  }

  notes.sort((a, b) => b.createdAt - a.createdAt);
  const list = document.getElementById('notesList');

  if (notes.length === 0) {
    list.innerHTML = '<div class="empty-state">No notes found</div>';
    return;
  }

  list.innerHTML = notes.map(n => {
    const client = n.clientId ? clients.find(c => c.id === n.clientId) : null;
    return `<div class="card">
      <div class="card-top">
        <div>
          <div class="card-title">${escapeHtml(n.title)}</div>
          ${client ? `<div class="card-subtitle">${escapeHtml(client.name)}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">
          <span class="badge badge-${n.type}">${n.type}</span>
          ${n.priority !== 'normal' ? `<span class="badge badge-${n.priority}">${n.priority}</span>` : ''}
        </div>
      </div>
      ${n.details ? `<div class="card-detail" style="margin-top:4px;white-space:pre-wrap">${escapeHtml(n.details)}</div>` : ''}
      <div class="card-detail mt-8">${timeAgo(n.createdAt)}</div>
      <div class="card-actions">
        <button class="btn-action edit" onclick="editNote('${n.id}')">Edit</button>
        <button class="btn-action delete" onclick="confirmDelete('note','${n.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function filterNotes(filter, btn) {
  currentNoteFilter = filter;
  document.querySelectorAll('#viewNotes .chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderNotes();
}

function editNote(id) {
  const notes = getData(DB_KEYS.notes);
  const note = notes.find(n => n.id === id);
  if (!note) return;

  document.getElementById('noteModalTitle').textContent = 'Edit Note';
  document.getElementById('noteId').value = note.id;
  document.getElementById('noteType').value = note.type;
  populateClientSelect('noteClient');
  document.getElementById('noteClient').value = note.clientId || '';
  document.getElementById('noteTitle').value = note.title;
  document.getElementById('noteDetails').value = note.details || '';
  document.getElementById('notePriority').value = note.priority || 'normal';
  openModal('noteModal');
}

function saveNote(e) {
  e.preventDefault();
  const id = document.getElementById('noteId').value;
  const note = {
    id: id || genId(),
    type: document.getElementById('noteType').value,
    clientId: document.getElementById('noteClient').value || null,
    title: document.getElementById('noteTitle').value.trim(),
    details: document.getElementById('noteDetails').value.trim(),
    priority: document.getElementById('notePriority').value,
    updatedAt: Date.now()
  };

  const notes = getData(DB_KEYS.notes);
  const idx = notes.findIndex(n => n.id === note.id);
  if (idx >= 0) {
    note.createdAt = notes[idx].createdAt;
    notes[idx] = note;
  } else {
    note.createdAt = Date.now();
    notes.push(note);
  }

  setData(DB_KEYS.notes, notes);
  closeModal('noteModal');
  renderNotes();
}

// ===== Quotes =====
function renderQuotes() {
  let quotes = getData(DB_KEYS.quotes);
  const clients = getData(DB_KEYS.clients);

  if (currentQuoteFilter !== 'all') {
    quotes = quotes.filter(q => q.status === currentQuoteFilter);
  }

  quotes.sort((a, b) => b.createdAt - a.createdAt);
  const list = document.getElementById('quotesList');

  if (quotes.length === 0) {
    list.innerHTML = '<div class="empty-state">No quotes found</div>';
    return;
  }

  list.innerHTML = quotes.map(q => {
    const client = clients.find(c => c.id === q.clientId);
    return `<div class="card">
      <div class="card-top">
        <div>
          <div class="card-title">${client ? escapeHtml(client.name) : 'Unknown Client'}</div>
          <div class="card-subtitle">${escapeHtml(q.service)}</div>
        </div>
        <div style="text-align:right">
          <div class="quote-amount">$${parseFloat(q.amount).toFixed(2)} <span class="quote-frequency">/ ${q.frequency}</span></div>
          <span class="badge badge-${q.status}" style="margin-top:4px">${q.status}</span>
        </div>
      </div>
      ${q.description ? `<div class="card-detail" style="margin-top:6px">${escapeHtml(q.description)}</div>` : ''}
      <div class="card-detail mt-8">${timeAgo(q.createdAt)}</div>
      <div class="card-actions">
        <button class="btn-action edit" onclick="editQuote('${q.id}')">Edit</button>
        ${q.status === 'pending' ? `
          <button class="btn-action" style="color:var(--success);border-color:var(--success)" onclick="quickStatusQuote('${q.id}','accepted')">Accept</button>
          <button class="btn-action" style="color:var(--danger);border-color:var(--danger)" onclick="quickStatusQuote('${q.id}','declined')">Decline</button>
        ` : ''}
        <button class="btn-action delete" onclick="confirmDelete('quote','${q.id}')">Delete</button>
        ${q.status === 'accepted' ? `<button class="btn-action" style="color:var(--sage);border-color:var(--sage)" onclick="createJobFromQuote('${q.id}')">Schedule</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function filterQuotes(filter, btn) {
  currentQuoteFilter = filter;
  document.querySelectorAll('#viewQuotes .chip').forEach(c => c.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderQuotes();
}

function quickStatusQuote(id, status) {
  const quotes = getData(DB_KEYS.quotes);
  const idx = quotes.findIndex(q => q.id === id);
  if (idx >= 0) {
    quotes[idx].status = status;
    quotes[idx].updatedAt = Date.now();
    setData(DB_KEYS.quotes, quotes);
    renderQuotes();
  }
}

function editQuote(id) {
  const quotes = getData(DB_KEYS.quotes);
  const quote = quotes.find(q => q.id === id);
  if (!quote) return;

  document.getElementById('quoteModalTitle').textContent = 'Edit Quote';
  document.getElementById('quoteId').value = quote.id;
  populateClientSelect('quoteClient');
  document.getElementById('quoteClient').value = quote.clientId;
  document.getElementById('quoteService').value = quote.service;
  document.getElementById('quoteDescription').value = quote.description || '';
  document.getElementById('quoteFrequency').value = quote.frequency;
  document.getElementById('quoteAmount').value = quote.amount;
  document.getElementById('quoteStatus').value = quote.status;
  openModal('quoteModal');
}

function saveQuote(e) {
  e.preventDefault();
  const id = document.getElementById('quoteId').value;
  const quote = {
    id: id || genId(),
    clientId: document.getElementById('quoteClient').value,
    service: document.getElementById('quoteService').value,
    description: document.getElementById('quoteDescription').value.trim(),
    frequency: document.getElementById('quoteFrequency').value,
    amount: document.getElementById('quoteAmount').value,
    status: document.getElementById('quoteStatus').value,
    updatedAt: Date.now()
  };

  const quotes = getData(DB_KEYS.quotes);
  const idx = quotes.findIndex(q => q.id === quote.id);
  if (idx >= 0) {
    quote.createdAt = quotes[idx].createdAt;
    quotes[idx] = quote;
  } else {
    quote.createdAt = Date.now();
    quotes.push(quote);
  }

  setData(DB_KEYS.quotes, quotes);
  closeModal('quoteModal');
  renderQuotes();
}

function createJobFromQuote(quoteId) {
  const quotes = getData(DB_KEYS.quotes);
  const quote = quotes.find(q => q.id === quoteId);
  if (!quote) return;

  // One-time quotes become one-off jobs, recurring become maintenance
  if (quote.frequency === 'one-time') {
    document.getElementById('oneOffJobModalTitle').textContent = 'Schedule Job from Quote';
    document.getElementById('oneOffJobId').value = '';
    populateClientSelect('oneOffJobClient');
    document.getElementById('oneOffJobClient').value = quote.clientId;
    document.getElementById('oneOffJobTitle').value = quote.service;
    document.getElementById('oneOffJobDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('oneOffJobTime').value = '09:00';
    document.getElementById('oneOffJobPrice').value = quote.amount || '';
    document.getElementById('oneOffJobDesc').value = quote.description || '';
    document.getElementById('oneOffJobStatus').value = 'scheduled';
    openModal('oneOffJobModal');
  } else {
    document.getElementById('scheduleModalTitle').textContent = 'Schedule from Quote';
    document.getElementById('jobId').value = '';
    populateClientSelect('jobClient');
    document.getElementById('jobClient').value = quote.clientId;
    document.getElementById('jobDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('jobTime').value = '09:00';
    document.getElementById('jobService').value = quote.service;
    document.getElementById('jobNotes').value = quote.description || '';
    document.getElementById('jobStatus').value = 'scheduled';
    openModal('scheduleModal');
  }
}

// ===== Clients =====
function renderClients() {
  const search = (document.getElementById('clientSearch')?.value || '').toLowerCase();
  let clients = getData(DB_KEYS.clients);

  if (search) {
    clients = clients.filter(c =>
      c.name.toLowerCase().includes(search) ||
      (c.address || '').toLowerCase().includes(search) ||
      (c.phone || '').includes(search)
    );
  }

  clients.sort((a, b) => a.name.localeCompare(b.name));
  const list = document.getElementById('clientsList');

  if (clients.length === 0) {
    list.innerHTML = '<div class="empty-state">No clients found</div>';
    return;
  }

  list.innerHTML = clients.map(c => {
    return `<div class="card" onclick="showClientDetail('${c.id}')">
      <div class="card-top">
        <div>
          <div class="card-title">${escapeHtml(c.name)}</div>
          ${c.address ? `<div class="card-detail">${escapeHtml(c.address)}</div>` : ''}
        </div>
        <div style="text-align:right">
          ${c.frequency ? `<span class="badge badge-scheduled">${c.frequency}</span>` : ''}
          ${c.yardSize ? `<div class="card-detail mt-8">${capitalize(c.yardSize)} yard</div>` : ''}
        </div>
      </div>
      ${c.phone ? `<div class="card-detail mt-8">${escapeHtml(c.phone)}</div>` : ''}
      <div class="card-actions">
        <button class="btn-action edit" onclick="event.stopPropagation(); editClient('${c.id}')">Edit</button>
        <button class="btn-action delete" onclick="event.stopPropagation(); confirmDelete('client','${c.id}')">Delete</button>
        ${c.phone ? `<a class="btn-action call" href="tel:${c.phone}" onclick="event.stopPropagation()">Call</a>` : ''}
        ${c.email ? `<a class="btn-action" style="color:var(--navy);border-color:var(--navy)" href="mailto:${c.email}" onclick="event.stopPropagation()">Email</a>` : ''}
      </div>
    </div>`;
  }).join('');
}

function showClientDetail(id) {
  const clients = getData(DB_KEYS.clients);
  const client = clients.find(c => c.id === id);
  if (!client) return;

  const jobs = getData(DB_KEYS.jobs).filter(j => j.clientId === id);
  const oneOffs = getData('by_oneoff_jobs').filter(j => j.clientId === id);
  const allJobs = [...jobs.map(j => ({...j, itemType: 'maintenance'})), ...oneOffs.map(j => ({...j, itemType: 'job'}))];
  const quotes = getData(DB_KEYS.quotes).filter(q => q.clientId === id);
  const notes = getData(DB_KEYS.notes).filter(n => n.clientId === id);

  document.getElementById('clientDetailName').textContent = client.name;

  const completedJobs = allJobs.filter(j => j.status === 'completed').length;
  const totalQuoteValue = quotes.filter(q => q.status === 'accepted').reduce((sum, q) => sum + parseFloat(q.amount || 0), 0);

  let html = `
    <div class="client-detail-section">
      <h4>Contact Info</h4>
      ${client.phone ? `<div class="client-info-row"><span class="client-info-label">Phone</span><span class="client-info-value"><a href="tel:${client.phone}">${escapeHtml(client.phone)}</a></span></div>` : ''}
      ${client.email ? `<div class="client-info-row"><span class="client-info-label">Email</span><span class="client-info-value"><a href="mailto:${client.email}">${escapeHtml(client.email)}</a></span></div>` : ''}
      ${client.address ? `<div class="client-info-row"><span class="client-info-label">Address</span><span class="client-info-value">${escapeHtml(client.address)}</span></div>` : ''}
    </div>
    <div class="client-detail-section">
      <h4>Property</h4>
      <div class="client-info-row"><span class="client-info-label">Property Type</span><span class="client-info-value">${client.propertyType ? capitalize(client.propertyType) : '-'}</span></div>
      <div class="client-info-row"><span class="client-info-label">Property Size</span><span class="client-info-value">${client.yardSize ? capitalize(client.yardSize) : '-'}</span></div>
      <div class="client-info-row"><span class="client-info-label">Frequency</span><span class="client-info-value">${client.frequency || '-'}</span></div>
      ${client.notes ? `<div class="client-info-row"><span class="client-info-label">Notes</span><span class="client-info-value">${escapeHtml(client.notes)}</span></div>` : ''}
    </div>
    <div class="client-detail-section">
      <h4>Stats</h4>
      <div class="client-info-row"><span class="client-info-label">Completed</span><span class="client-info-value">${completedJobs}</span></div>
      <div class="client-info-row"><span class="client-info-label">Accepted Quotes</span><span class="client-info-value">$${totalQuoteValue.toFixed(2)}</span></div>
      <div class="client-info-row"><span class="client-info-label">Maintenance Visits</span><span class="client-info-value">${jobs.length}</span></div>
      <div class="client-info-row"><span class="client-info-label">One-Off Jobs</span><span class="client-info-value">${oneOffs.length}</span></div>
      <div class="client-info-row"><span class="client-info-label">Notes</span><span class="client-info-value">${notes.length}</span></div>
    </div>`;

  if (allJobs.length > 0) {
    const recentJobs = [...allJobs].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
    html += `<div class="client-detail-section"><h4>Recent History</h4>`;
    html += recentJobs.map(j => `
      <div class="client-history-item">
        <strong>${j.date}</strong> &bull; ${j.itemType === 'job' ? (j.title || j.service) : j.service}
        <span class="badge badge-${j.itemType}" style="float:right;margin-left:4px">${j.itemType}</span>
        <span class="badge badge-${j.status}" style="float:right">${formatStatus(j.status)}</span>
      </div>
    `).join('');
    html += '</div>';
  }

  if (notes.length > 0) {
    html += `<div class="client-detail-section"><h4>Notes</h4>`;
    html += notes.slice(0, 5).map(n => `
      <div class="client-history-item">
        <strong>${escapeHtml(n.title)}</strong>
        <span class="badge badge-${n.type}" style="float:right">${n.type}</span>
        ${n.details ? `<div style="margin-top:4px;font-size:0.75rem;color:var(--text-light)">${escapeHtml(n.details)}</div>` : ''}
      </div>
    `).join('');
    html += '</div>';
  }

  html += `<div class="form-actions">
    <button class="btn-secondary" onclick="closeModal('clientDetailModal'); editClient('${id}')">Edit Client</button>
    <button class="btn-primary" onclick="closeModal('clientDetailModal')">Close</button>
  </div>`;

  document.getElementById('clientDetailContent').innerHTML = html;
  openModal('clientDetailModal');
}

function editClient(id) {
  const clients = getData(DB_KEYS.clients);
  const client = clients.find(c => c.id === id);
  if (!client) return;

  document.getElementById('clientModalTitle').textContent = 'Edit Client';
  document.getElementById('clientId').value = client.id;
  document.getElementById('clientName').value = client.name;
  document.getElementById('clientPhone').value = client.phone || '';
  document.getElementById('clientEmail').value = client.email || '';
  document.getElementById('clientAddress').value = client.address || '';
  document.getElementById('clientPropertyType').value = client.propertyType || '';
  document.getElementById('clientYardSize').value = client.yardSize || '';
  document.getElementById('clientFrequency').value = client.frequency || '';
  document.getElementById('clientNotes').value = client.notes || '';
  openModal('clientModal');
}

function saveClient(e) {
  e.preventDefault();
  const id = document.getElementById('clientId').value;
  const client = {
    id: id || genId(),
    name: document.getElementById('clientName').value.trim(),
    phone: document.getElementById('clientPhone').value.trim(),
    email: document.getElementById('clientEmail').value.trim(),
    address: document.getElementById('clientAddress').value.trim(),
    propertyType: document.getElementById('clientPropertyType').value,
    yardSize: document.getElementById('clientYardSize').value,
    frequency: document.getElementById('clientFrequency').value,
    notes: document.getElementById('clientNotes').value.trim(),
    updatedAt: Date.now()
  };

  const clients = getData(DB_KEYS.clients);
  const idx = clients.findIndex(c => c.id === client.id);
  if (idx >= 0) {
    client.createdAt = clients[idx].createdAt;
    clients[idx] = client;
  } else {
    client.createdAt = Date.now();
    clients.push(client);
  }

  setData(DB_KEYS.clients, clients);
  closeModal('clientModal');
  renderClients();
}

// ===== Delete =====
function confirmDelete(type, id) {
  const btn = document.getElementById('deleteConfirmBtn');
  btn.onclick = () => {
    deleteItem(type, id);
    closeModal('deleteConfirmModal');
  };
  openModal('deleteConfirmModal');
}

function deleteItem(type, id) {
  let key;
  if (type === 'job') key = DB_KEYS.jobs;
  else if (type === 'oneoff') key = 'by_oneoff_jobs';
  else if (type === 'note') key = DB_KEYS.notes;
  else if (type === 'quote') key = DB_KEYS.quotes;
  else if (type === 'client') key = DB_KEYS.clients;

  const data = getData(key).filter(item => item.id !== id);
  setData(key, data);

  if (type === 'job' || type === 'oneoff') renderSchedule();
  else if (type === 'note') renderNotes();
  else if (type === 'quote') renderQuotes();
  else if (type === 'client') renderClients();
}

// ===== Modals =====
function openModal(modalId) {
  // Reset form if opening fresh
  const modal = document.getElementById(modalId);
  if (modalId === 'scheduleModal' && !document.getElementById('jobId').value) {
    document.getElementById('scheduleModalTitle').textContent = 'New Maintenance';
    modal.querySelector('form')?.reset();
    document.getElementById('jobDate').value = document.getElementById('scheduleDate').value;
    populateClientSelect('jobClient');
  } else if (modalId === 'oneOffJobModal' && !document.getElementById('oneOffJobId').value) {
    document.getElementById('oneOffJobModalTitle').textContent = 'New Job';
    modal.querySelector('form')?.reset();
    document.getElementById('oneOffJobDate').value = document.getElementById('scheduleDate').value;
    populateClientSelect('oneOffJobClient');
  } else if (modalId === 'noteModal' && !document.getElementById('noteId').value) {
    document.getElementById('noteModalTitle').textContent = 'New Note';
    modal.querySelector('form')?.reset();
    populateClientSelect('noteClient');
  } else if (modalId === 'quoteModal' && !document.getElementById('quoteId').value) {
    document.getElementById('quoteModalTitle').textContent = 'New Quote';
    modal.querySelector('form')?.reset();
    populateClientSelect('quoteClient');
  } else if (modalId === 'clientModal' && !document.getElementById('clientId').value) {
    document.getElementById('clientModalTitle').textContent = 'New Client';
    modal.querySelector('form')?.reset();
  }

  // Populate client selects for forms that need it
  const clientSelectMap = { scheduleModal: 'jobClient', oneOffJobModal: 'oneOffJobClient', noteModal: 'noteClient', quoteModal: 'quoteClient' };
  const selectId = clientSelectMap[modalId];
  if (selectId) {
    const currentVal = document.getElementById(selectId).value;
    populateClientSelect(selectId);
    if (currentVal) document.getElementById(selectId).value = currentVal;
  }

  modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('open');

  // Reset hidden IDs
  setTimeout(() => {
    if (modalId === 'scheduleModal') document.getElementById('jobId').value = '';
    else if (modalId === 'oneOffJobModal') document.getElementById('oneOffJobId').value = '';
    else if (modalId === 'noteModal') document.getElementById('noteId').value = '';
    else if (modalId === 'quoteModal') document.getElementById('quoteId').value = '';
    else if (modalId === 'clientModal') document.getElementById('clientId').value = '';
  }, 250);
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay') && e.target.classList.contains('open')) {
    e.target.classList.remove('open');
  }
});

function populateClientSelect(selectId) {
  const clients = getData(DB_KEYS.clients);
  const select = document.getElementById(selectId);
  const currentVal = select.value;

  // Keep first option
  const firstOption = select.querySelector('option');
  select.innerHTML = '';
  select.appendChild(firstOption);

  clients.sort((a, b) => a.name.localeCompare(b.name));
  clients.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    select.appendChild(opt);
  });

  if (currentVal) select.value = currentVal;
}

// ===== Helpers =====
function formatTime(time) {
  if (!time) return 'No time set';
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatStatus(status) {
  return status.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
