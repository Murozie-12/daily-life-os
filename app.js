const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const $ = id => document.getElementById(id);
const KEY = 'daily-life-os-v1';
let db = { tasks: [], checks: {} };
let selected = DAYS[new Date().getDay()], deferredPrompt = null, cloud = null, uid = null, saveTimer;

// Pengecekan notifikasi yang aman di semua browser
const canNotify = 'Notification' in window;

function dateKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Membersihkan riwayat ceklis yang usianya lebih dari 7 hari agar Firebase tidak penuh
function cleanupOldChecks() {
  const today = new Date();
  Object.keys(db.checks).forEach(key => {
    const datePart = key.split('|')[0];
    const checkDate = new Date(datePart);
    const diffDays = (today - checkDate) / (1000 * 60 * 60 * 24);
    if (diffDays > 7) {
      delete db.checks[key];
    }
  });
}

function save() {
  cleanupOldChecks();
  localStorage.setItem(KEY, JSON.stringify(db));
  if (cloud && uid) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await cloud.setDoc(cloud.doc(cloud.firestore, 'users', uid), { data: db, updatedAt: cloud.serverTimestamp() }, { merge: true });
        $('cloudStatus').textContent = 'Tersinkron ke Firebase';
      } catch (e) {
        $('cloudStatus').textContent = 'Sinkron gagal: ' + e.message;
      }
    }, 800);
  }
}

function active() {
  return db.tasks.filter(x => x.day === selected).sort((a, b) => a.start.localeCompare(b.start));
}

function render() {
  const key = dateKey();
  $('dateLabel').textContent = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  $('daylabel').textContent = selected;
  $('days').innerHTML = DAYS.map(d => `<button class="btn small ${selected === d ? 'active' : ''}" data-day="${d}">${d.slice(0, 3)}</button>`).join('');

  const all = active(), done = all.filter(t => db.checks[key + '|' + t.id]).length, pct = all.length ? Math.round(done / all.length * 100) : 0;
  $('total').textContent = all.length;
  $('complete').textContent = done;
  $('percent').textContent = pct + '%';
  $('progress').style.width = pct + '%';

  const categories = [...new Set(db.tasks.map(x => x.category))].sort(), f = $('filter').value;
  $('filter').innerHTML = '<option value="">Semua kategori</option>' + categories.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  $('filter').value = categories.includes(f) ? f : '';

  const q = $('search').value.toLowerCase();
  const visible = all.filter(t => (!$('filter').value || t.category === $('filter').value) && (!q || (t.title + ' ' + t.notes).toLowerCase().includes(q)));

  $('tasks').innerHTML = visible.length ? visible.map(t => `
    <div class="task ${db.checks[key + '|' + t.id] ? 'done' : ''}">
      <input aria-label="Tandai selesai" type="checkbox" data-check="${escapeHtml(t.id)}" ${db.checks[key + '|' + t.id] ? 'checked' : ''}>
      <div class="time">${escapeHtml(t.start)}–${escapeHtml(t.end)}</div>
      <div class="body">
        <div class="title">${escapeHtml(t.title)}</div>
        <span class="tag">${escapeHtml(t.category)}</span>
        ${t.notes ? `<div class="note">${escapeHtml(t.notes)}</div>` : ''}
      </div>
      <div class="actions">
        <button class="btn small" data-copy="${escapeHtml(t.id)}" aria-label="Salin ke hari lain">⧉</button>
        <button class="btn small" data-edit="${escapeHtml(t.id)}" aria-label="Edit kegiatan">✎</button>
        <button class="btn small" data-delete="${escapeHtml(t.id)}" aria-label="Hapus kegiatan">×</button>
      </div>
    </div>
  `).join('') : '<p class="muted">Belum ada kegiatan yang cocok.</p>';

  // Animasi item hanya dijalankan pada render pertama, supaya tidak berkedip setiap centang
  $('tasks').classList.add('ready');
  window.dispatchEvent(new CustomEvent('dlos:tasks-updated', { detail: { tasks: db.tasks.map(t => ({...t})) } }));
}

$('days').onclick = e => { const b = e.target.closest('[data-day]'); if (b) { selected = b.dataset.day; render(); } };
$('tasks').onchange = e => { if (e.target.dataset.check) { db.checks[dateKey() + '|' + e.target.dataset.check] = e.target.checked; save(); render(); } };
$('tasks').onclick = e => {
  const edit = e.target.closest('[data-edit]'), del = e.target.closest('[data-delete]');
  if (edit) openEditor(db.tasks.find(x => x.id === edit.dataset.edit));
  const cp = e.target.closest('[data-copy]');
  if (cp) openCopy(cp.dataset.copy);
  if (del && confirm('Hapus kegiatan ini dari jadwal mingguan?')) {
    db.tasks = db.tasks.filter(x => x.id !== del.dataset.delete); save(); render();
  }
};
$('search').oninput = render;
$('filter').onchange = render;

function openEditor(t) {
  $('editForm').reset();
  $('formTitle').textContent = t ? 'Edit kegiatan' : 'Tambah kegiatan';
  $('taskId').value = t?.id || '';
  $('taskDay').value = t?.day || selected;
  $('taskStart').value = t?.start?.replace('.', ':') || '08:00';
  $('taskEnd').value = t?.end?.replace('.', ':') || '09:00';
  $('taskTitle').value = t?.title || '';
  $('taskCategory').value = t?.category || 'Pribadi';
  $('taskNotes').value = t?.notes || '';
  $('editor').showModal();
}

$('new').onclick = () => openEditor();
$('cancel').onclick = () => $('editor').close();

/* ---------- Salin kegiatan ke hari lain ---------- */
let copySourceId = null;
function openCopy(id) {
  const t = db.tasks.find(x => x.id === id);
  if (!t) return;
  copySourceId = id;
  $('copyInfo').textContent = `${t.title} (${t.start}–${t.end}), saat ini di ${t.day}`;
  $('copyDay').innerHTML = DAYS.filter(d => d !== t.day).map(d => `<option value="${d}">${d}</option>`).join('');
  $('copyDialog').showModal();
}
$('copyCancel').onclick = () => $('copyDialog').close();
$('copyForm').onsubmit = e => {
  e.preventDefault();
  const src = db.tasks.find(x => x.id === copySourceId);
  if (!src) { $('copyDialog').close(); return; }
  const target = $('copyDay').value;
  const dup = db.tasks.some(x => x.day === target && x.start === src.start && x.end === src.end && x.title === src.title);
  if (dup) { alert(`Kegiatan ini sudah ada di ${target}.`); return; }
  db.tasks.push({ ...src, id: 'custom-' + crypto.randomUUID(), day: target });
  save();
  $('copyDialog').close();
  render();
  alert(`Kegiatan disalin ke ${target}.`);
};

/* ---------- Banner pengingat dan tunda ---------- */
let snoozeTimer = null;
function showBanner(title, body, allowSnooze = true) {
  $('bannerTitle').textContent = title;
  $('bannerBody').textContent = body;
  $('bannerSnooze').classList.toggle('hidden', !allowSnooze);
  $('reminderBanner').classList.remove('hidden');
}
$('bannerSnooze').onclick = () => {
  const title = $('bannerTitle').textContent, body = $('bannerBody').textContent;
  $('reminderBanner').classList.add('hidden');
  clearTimeout(snoozeTimer);
  // Tunda 10 menit, dan hanya sekali (tidak bisa ditunda lagi)
  snoozeTimer = setTimeout(() => showReminder(title, body, false), 10 * 60 * 1000);
};
$('bannerClose').onclick = () => {
  clearTimeout(snoozeTimer);
  $('reminderBanner').classList.add('hidden');
};

$('editForm').onsubmit = e => {
  e.preventDefault();
  const id = $('taskId').value || 'custom-' + crypto.randomUUID();
  const task = {
    id,
    day: $('taskDay').value,
    start: $('taskStart').value.replace(':', '.'),
    end: $('taskEnd').value.replace(':', '.'),
    title: $('taskTitle').value.trim(),
    category: $('taskCategory').value.trim(),
    notes: $('taskNotes').value.trim()
  };
  if (task.end <= task.start) { alert('Jam selesai harus setelah jam mulai.'); return; }
  const i = db.tasks.findIndex(x => x.id === id);
  if (i >= 0) db.tasks[i] = task;
  else db.tasks.push(task);
  selected = task.day;
  save();
  $('editor').close();
  render();
};

$('export').onclick = () => {
  const a = document.createElement('a');
  const u = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
  a.href = u;
  a.download = 'daily-life-os-backup-' + dateKey() + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};

$('import').onclick = () => $('file').click();
$('file').onchange = async e => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    const x = JSON.parse(await f.text());
    if (!Array.isArray(x.tasks) || !x.checks || typeof x.checks !== 'object' || x.tasks.some(t => !t.id || !DAYS.includes(t.day) || !t.title)) throw Error('Format cadangan tidak valid');
    if (confirm('Ganti seluruh jadwal dan progres dengan cadangan ini?')) {
      db = { tasks: x.tasks, checks: x.checks };
      save();
      render();
    }
  } catch (err) { alert(err.message) }
  e.target.value = '';
};

$('resetDay').onclick = () => {
  if (!confirm('Hapus checklist tanggal hari ini?')) return;
  const prefix = dateKey() + '|';
  Object.keys(db.checks).forEach(k => { if (k.startsWith(prefix)) delete db.checks[k] });
  save();
  render();
};

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('install').classList.remove('hidden') });
$('install').onclick = async () => { if (deferredPrompt) { deferredPrompt.prompt(); await deferredPrompt.userChoice; deferredPrompt = null; $('install').classList.add('hidden') } };
window.addEventListener('appinstalled', () => $('install').classList.add('hidden'));

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { });

async function setupFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || !cfg.projectId) return;
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),
          authMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js'),
          dbMod = await import('https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js');
    const app = appMod.initializeApp(cfg),
          auth = authMod.getAuth(app),
          firestore = dbMod.getFirestore(app);

    cloud = { ...dbMod, firestore };
    $('login').classList.remove('hidden');
    $('cloudStatus').textContent = 'Firebase siap — login untuk sinkron';

    $('login').onclick = () => authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider()).catch(e => alert('Login gagal: ' + e.message));
    $('logout').onclick = () => authMod.signOut(auth);

    authMod.onAuthStateChanged(auth, async user => {
      uid = user?.uid || null;
      $('login').classList.toggle('hidden', !!user);
      $('logout').classList.toggle('hidden', !user);
      if (!user) { $('cloudStatus').textContent = 'Belum login — data lokal'; return }
      try {
        const ref = dbMod.doc(firestore, 'users', uid), snap = await dbMod.getDoc(ref);
        if (snap.exists() && snap.data().data?.tasks) {
          if (confirm('Gunakan jadwal tersimpan dari Firebase? Pilih Batal untuk mengunggah jadwal lokal ke cloud.')) {
            db = snap.data().data;
          } else {
            await dbMod.setDoc(ref, { data: db, updatedAt: dbMod.serverTimestamp() });
          }
        } else {
          await dbMod.setDoc(ref, { data: db, updatedAt: dbMod.serverTimestamp() });
        }
        localStorage.setItem(KEY, JSON.stringify(db));
        $('cloudStatus').textContent = 'Login: ' + (user.email || 'akun Google');
        render();
      } catch (e) { $('cloudStatus').textContent = 'Firebase error: ' + e.message }
    });
  } catch (e) {
    $('cloudStatus').textContent = 'Firebase tidak tersedia (offline / konfigurasi): ' + e.message;
  }
}

(async () => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) {
      db = JSON.parse(saved);
    } else {
      const r = await fetch('./schedule.json');
      db = { tasks: await r.json(), checks: {} };
      save();
    }
  } catch (e) {
    db = { tasks: [], checks: {} };
    $('cloudStatus').textContent = 'Jadwal awal gagal dimuat: ' + e.message;
  }
  render();
  setupFirebase();
})();

/* ---------- Pengingat ---------- */

// Tombol "Aktifkan pengingat" hanya muncul jika browser mendukung notifikasi dan izin belum diberikan
function setupNotifButton() {
  const btn = $('enableNotif');
  if (!btn || !canNotify || Notification.permission !== 'default') return;
  btn.classList.remove('hidden');
  btn.onclick = async () => {
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') btn.classList.add('hidden');
    } catch (e) { /* sebagian browser lama tidak mendukung versi promise */ }
  };
}
setupNotifButton();

// Notifikasi lewat service worker lebih andal di Android dan saat aplikasi terpasang.
// Jika tidak tersedia, dicoba dengan Notification biasa.
async function showReminder(title, body, allowSnooze = true) {
  showBanner(title, body, allowSnooze);
  if (!canNotify || Notification.permission !== 'granted') return;
  const options = { body, icon: './icon-192.png', tag: 'daily-life-os-reminder' };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && reg.showNotification) { await reg.showNotification(title, options); return; }
    }
  } catch (e) { /* lanjut ke fallback */ }
  try { new Notification(title, options); } catch (e) { /* browser tidak mendukung konstruktor ini */ }
}

let lastNotified = '';
setInterval(() => {
  const now = new Date();
  const currentDay = DAYS[now.getDay()];

  // Format jam sesuai schedule.json (misal "08.00")
  const currentTime = String(now.getHours()).padStart(2, '0') + '.' + String(now.getMinutes()).padStart(2, '0');

  const currentTask = db.tasks.find(t => t.day === currentDay && t.start === currentTime);

  if (currentTask && lastNotified !== dateKey() + '|' + currentTask.id) {
    lastNotified = dateKey() + '|' + currentTask.id; // hindari notifikasi ganda di menit yang sama

    showReminder('Waktunya Kegiatan Baru!', `${currentTask.title}\nJam: ${currentTask.start} - ${currentTask.end}`);

    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
  }
}, 60000);

// Pengingat 5 menit sebelum kegiatan dimulai
let lastPreNotified = '';
setInterval(() => {
  const lead = Number(localStorage.getItem('dlos_reminder_lead_v23') ?? '5');
  if (![0,5,10,15,30].includes(lead) || lead === 0) return;
  const soon = new Date(Date.now() + lead * 60000); // aman saat lewat tengah malam
  const day = DAYS[soon.getDay()];
  const time = String(soon.getHours()).padStart(2, '0') + '.' + String(soon.getMinutes()).padStart(2, '0');
  const t = db.tasks.find(x => x.day === day && x.start === time);
  if (t && lastPreNotified !== dateKey() + '|' + t.id + '|' + lead) {
    lastPreNotified = dateKey() + '|' + t.id + '|' + lead;
    showReminder(lead + ' menit lagi', `${t.title}\nJam: ${t.start} - ${t.end}`, false);
  }
}, 60000);
