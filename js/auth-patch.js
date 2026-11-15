// auth-patch.js - BAN SACH CUOI CUNG - P0 + P1 - CHI CAN DAN 1 LAN, KHONG SUA LE TE NUA
// Tu dong lay Link + Token, khong can nhap tay, may nao mo len cung chay

const CFG_P0 = {
  SHEET_CSV: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSMJYnJ9kIR3DBgEQOag2Sk4ERaa5g9pRgoktySd2wMTvr8er8dfnt-UK6lsJnnp37SERJFVdV1a4h9/pub?output=csv',
  TOKEN_KEY: 'pm_push_token',
  ADMIN_HASH_KEY: 'pm_admin_hash',
  SALT: 'DAVSON-2026-'
};

// ===== CAU HINH MAC DINH - CO NGAY KHI MO APP, KHONG DOI TAI config.json =====
let CFG_AUTO = {
  reportUrl: "https://script.google.com/macros/s/AKfycbwroNbMBO02aibQ7tFZxLKM9Ke1Gbl_OT0icHG8yThfalAVIjDAfX-xpxiX76mPBQI-Iw/exec",
  accountUrl: "https://script.google.com/macros/s/AKfycbyaIg0TSyZ1EuhqFg8fT2EncxAwyinZ2qBVbRPYS3YLKYE07uvwXFaPZvdepdV9gDUf/exec",
  token: "Davson-2026-9f8K2mQ7xZ4pL1w"
};

function saveConfigToStore() {
  try {
    localStorage.setItem('pm_push_url', CFG_AUTO.reportUrl || '');
    localStorage.setItem('pm_push_token', CFG_AUTO.token || '');
    localStorage.setItem('pm_add_account_url', CFG_AUTO.accountUrl || '');
    if (window.store) {
      store.set('pm_push_url', CFG_AUTO.reportUrl || '');
      store.set('pm_push_token', CFG_AUTO.token || '');
      store.set('pm_add_account_url', CFG_AUTO.accountUrl || '');
    }
  } catch (e) {}
}
// Luu ngay de core.js dung duoc luon, khong can doi fetch
saveConfigToStore();

async function loadConfigAuto() {
  try {
    const res = await fetch('./config.json', { cache: 'no-store' });
    if (res.ok) {
      const j = await res.json();
      if (j.reportUrl) CFG_AUTO = j;
      saveConfigToStore();
    }
  } catch (e) {}
  return CFG_AUTO;
}
loadConfigAuto();

// ===== AN 2 O LINK + TOKEN - TIM THEO O NHAP, KHONG TIM THEO TIEU DE =====
(function hideLinkTokenInputs() {
  const obs = new MutationObserver(() => {
    const linkInput = [...document.querySelectorAll('input')].find(el => (el.placeholder || '').includes('script.google.com/macros'));
    const tokenInput = [...document.querySelectorAll('input')].find(el => (el.placeholder || '').includes('TOKEN trong Apps Script'));
    if (!linkInput && !tokenInput) return;
    let box = linkInput || tokenInput;
    for (let i = 0; i < 5 && box.parentElement; i++) {
      box = box.parentElement;
      if (box.querySelectorAll('input').length >= 2) break;
    }
    if (!box) return;
    if (linkInput) linkInput.style.display = 'none';
    if (tokenInput) tokenInput.style.display = 'none';
    box.querySelectorAll('label').forEach(lb => {
      if (lb.textContent.includes('Link Web App') || lb.textContent.includes('Mã bảo vệ')) lb.style.display = 'none';
    });
    if (!box.querySelector('[data-auto-config-note]')) {
      const note = document.createElement('div');
      note.setAttribute('data-auto-config-note', '1');
      note.style.cssText = 'padding:10px;border-radius:10px;background:rgba(0,200,100,.15);color:#fff;font-size:13px;margin:10px 0;text-align:center';
      note.textContent = '✅ App đã tự lấy Link + Token từ hệ thống, bạn không cần nhập gì nữa.';
      const btn = box.querySelector('button');
      if (btn) box.insertBefore(note, btn); else box.appendChild(note);
    }
    box.querySelectorAll('*').forEach(el => {
      if (el.children.length === 0 && el.textContent.includes('chưa nhập link Web App')) {
        el.textContent = '✅ Đã sẵn sàng gửi - App tự lấy Link + Token rồi.';
      }
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();

// ===== LAY LINK / TOKEN - LUON CO GIA TRI, KHONG BAO GIO RONG =====
function getTokenP0() { return CFG_AUTO.token || store.get(CFG_P0.TOKEN_KEY, '') || localStorage.getItem('pm_push_token') || ''; }
function getReportUrlP0() { return CFG_AUTO.reportUrl || store.get('pm_push_url', '') || localStorage.getItem('pm_push_url') || ''; }
function getAddUrlP0() { return CFG_AUTO.accountUrl || store.get('pm_add_account_url', '') || localStorage.getItem('pm_add_account_url') || CFG_AUTO.accountUrl; }

function cleanDateP0(d) {
  if (!d) return d;
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return String(d);
}
function fmtDateVNP0(d) {
  const c = cleanDateP0(d);
  const m = String(c).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  return c;
}
function parseCSVP0(t) {
  t = String(t || '').replace(/^\uFEFF/, '');
  const rows = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); f = ''; rows.push(r); r = []; }
    else f += c;
  }
  if (f || r.length) { r.push(f); rows.push(r); }
  return rows;
}
async function hashWithSaltP0(user, pass) { return await sha256(user, pass + CFG_P0.SALT + user); }
async function hashOldP0(user, pass) { return await sha256(user, pass); }

function autoIdP0() {
  if (document.getElementById('newLeadUser')) return true;
  const allInputs = [...document.querySelectorAll('input')];
  const title = [...document.querySelectorAll('*')].find(el => el.children.length === 0 && (el.textContent || '').includes('Tài khoản Team Lead'));
  if (!title) return false;
  let box = title.parentElement;
  for (let i = 0; i < 4 && box; i++) {
    const ins = box.querySelectorAll('input');
    if (ins.length >= 2) {
      if (!ins[0].id) ins[0].id = 'newLeadUser';
      if (!ins[1].id) ins[1].id = 'newLeadPass';
      return true;
    }
    box = box.parentElement;
  }
  const byPlace = allInputs.filter(el => (el.placeholder || '').includes('Tên tài khoản') || (el.placeholder || '').includes('Mật khẩu'));
  if (byPlace.length >= 2) { byPlace[0].id = 'newLeadUser'; byPlace[1].id = 'newLeadPass'; return true; }
  return false;
}

async function loadAccountsP0() {
  const res = await fetch(CFG_P0.SHEET_CSV, { cache: 'no-store' });
  const text = await res.text();
  const rows = parseCSVP0(text);
  if (rows.length < 2) return [];
  const head = rows[0].map(x => String(x || '').trim().toUpperCase());
  const idx = (n) => head.indexOf(n);
  const iUser = idx('USER'), iHash = idx('HASH'), iBlock = idx('BLOCKED');
  const list = [];
  rows.slice(1).forEach(r => {
    const user = (r[iUser] || '').trim();
    if (!user) return;
    const perms = {};
    ['DASH','REPORT','PERF','ORDERS','HARNESS','EXPORT','DEL','HEDIT'].forEach(k => {
      const ii = idx(k);
      if (ii >= 0) perms[k.toLowerCase()] = String(r[ii] || '').trim().toUpperCase() === 'TRUE';
    });
    list.push({ user, hash: String(r[iHash] || '').replace(/[^0-9a-f]/gi, '').toLowerCase().slice(0, 64), blocked: String(r[iBlock] || '').trim().toUpperCase() === 'TRUE', perms });
  });
  window.remoteAccounts = list; accounts = list;
  try { localStorage.setItem('pm_team_accounts', JSON.stringify(list)); } catch (e) {}
  return list;
}

(function hookLoginP0() {
  const oldBtn = document.getElementById('btnLogin');
  if (!oldBtn || oldBtn._pmHooked) return;
  oldBtn._pmHooked = true;
  oldBtn.addEventListener('click', async () => {
    if ((document.body.innerText || '').includes('Thiết lập mật khẩu Admin')) {
      const visPass = [...document.querySelectorAll('input[type="password"]')].filter(el => el.offsetParent !== null && getComputedStyle(el).display !== 'none');
      const p1 = visPass[0]?.value || ''; const p2 = visPass[1]?.value || '';
      const msg2 = document.getElementById('lgMsg');
      if (!p1 || !p2) { if (msg2) msg2.textContent = '❌ Nhập mật khẩu'; return; }
      if (p1 !== p2) { if (msg2) msg2.textContent = '❌ 2 mật khẩu không khớp'; return; }
      const h = await hashWithSaltP0('Admin', p1);
      store.set(CFG_P0.ADMIN_HASH_KEY, h); location.reload(); return;
    }
    const u = (document.getElementById('lgUser')?.value || '').trim();
    const p = document.getElementById('lgPass')?.value || '';
    const msg = document.getElementById('lgMsg');
    const setMsg = (t) => { if (msg) msg.textContent = t; };
    if (!u || !p) return setMsg('❌ Nhập tên tài khoản và mật khẩu');
    if (/^admin$/i.test(u)) {
      const hNew = await hashWithSaltP0('Admin', p); const hOld = await hashOldP0('Admin', p);
      const saved = store.get(CFG_P0.ADMIN_HASH_KEY, '');
      if (hNew !== saved && hOld !== saved) return setMsg('❌ Sai tên tài khoản hoặc mật khẩu');
      if (hNew !== saved) store.set(CFG_P0.ADMIN_HASH_KEY, hNew);
      session = { user: 'Admin', role: 'admin' }; finishLogin(); return;
    }
    let accs = [];
    try { accs = await loadAccountsP0(); } catch (e) { return setMsg('❌ Không tải được Sheet tài khoản.'); }
    const a = accs.find(x => x.user.toLowerCase() === u.toLowerCase());
    if (!a) return setMsg('❌ Tài khoản chưa có. Liên hệ Admin!');
    if (a.blocked) return setMsg('❌ Tài khoản đã bị chặn.');
    const hNew = await hashWithSaltP0(a.user, p); const hOld = await hashOldP0(a.user, p);
    if (hNew !== a.hash && hOld !== a.hash) return setMsg('❌ Sai tên tài khoản hoặc mật khẩu');
    session = { user: a.user, role: 'lead' }; window.__remotePerms = { [a.user]: a.perms }; finishLogin();
  });
})();

async function pullReportsP0(show) {
  const url = getReportUrlP0(); const token = getTokenP0();
  if (!url) { if (show) alert('Chưa có Link Báo cáo'); return; }
  try {
    const res = await fetch(url + '?mode=list&token=' + encodeURIComponent(token), { cache: 'no-store' });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Máy chủ chưa trả về báo cáo');
    reports = (j.reports || []).map(r => {
      const perf = r.perfList || r.perf || []; const defs = r.defectList || r.defects || [];
      const plan = perf.reduce((s, p) => s + (Number(p.plan) || 0), 0);
      const actual = perf.reduce((s, p) => s + (Number(p.actual) || Number(p.output) || 0), 0);
      const defects = Array.isArray(defs) ? defs.reduce((s, d) => s + (Number(d.qty) || Number(d.quantity) || Number(d.defects) || 0), 0) : (Number(r.defects) || 0);
      return { ...r, date: cleanDateP0(r.date), plan, actual, output: actual, totalPlan: plan, totalActual: actual, defects, defectCount: defects };
    });
    store.set('pm_prod_reports', reports); renderDashboard();
    if (show) alert('✅ Đã kéo ' + reports.length + ' báo cáo');
  } catch (e) { if (show) alert('❌ Chưa kéo được: ' + e.message); }
}
document.getElementById('btnSync')?.addEventListener('click', () => pullReportsP0(false));

(function hookAddP0() {
  let hooked = false;
  function tryHook() {
    if (hooked) return;
    autoIdP0();
    const userEl = document.getElementById('newLeadUser');
    const passEl = document.getElementById('newLeadPass');
    const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Thêm Team Lead');
    if (!userEl || !passEl || !btn) return;
    hooked = true;
    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      const user = (userEl.value || '').trim(); const pass = passEl.value || '';
      const addUrl = getAddUrlP0(); const token = getTokenP0();
      if (!user || !pass) { alert('❌ Nhập tên tài khoản và mật khẩu ở ô Tạo Team Lead'); return; }
      if (!addUrl || !token) { alert('❌ Chưa có Link Taikhoan'); return; }
      if (user === token || user.includes('script.google')) { alert('❌ Bạn nhập nhầm ô Token'); return; }
      const hash = await hashWithSaltP0(user, pass);
      const q = new URLSearchParams({ mode: 'addAccount', token, user, hash, DASH: 'true', REPORT: 'true', PERF: 'true', ORDERS: 'true', HARNESS: 'true', EXPORT: 'false', DEL: 'false', HEDIT: 'false' });
      btn.textContent = 'Đang lưu lên Sheet...'; btn.disabled = true;
      try {
        const res = await fetch(addUrl + '?' + q.toString()); const j = await res.json();
        if (!j.ok) throw new Error(j.error || 'Không lưu được');
        alert('✅ Đã thêm ' + user + ' lên Sheet Taikhoan!'); userEl.value = ''; passEl.value = '';
        try { localStorage.removeItem('pm_team_accounts'); } catch (e) {}
      } catch (e) { alert('❌ Chưa đẩy lên Sheet được: ' + e.message); }
      finally { btn.textContent = 'Thêm Team Lead'; btn.disabled = false; }
    });
  }
  const obs = new MutationObserver(() => tryHook());
  obs.observe(document.body, { childList: true, subtree: true }); tryHook();
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]'); if (!btn) return;
    const user = btn.dataset.user; const act = btn.dataset.act;
    const addUrl = getAddUrlP0(); const token = getTokenP0();
    if (!addUrl || !token) { alert('❌ Chưa có Link Taikhoan'); return; }
    if (act === 'del') {
      if (!confirm('Xóa tài khoản ' + user + ' ?')) return;
      const q = new URLSearchParams({ mode: 'deleteAccount', token, user });
      const res = await fetch(addUrl + '?' + q.toString()); const j = await res.json();
      if (j.ok) { alert('✅ Đã xóa ' + user); location.reload(); } else alert('❌ ' + (j.error || 'Không xóa được'));
    }
    if (act === 'reset') {
      const np = prompt('Nhập mật khẩu mới cho ' + user + ':'); if (!np) return;
      const hash = await hashWithSaltP0(user, np);
      const q = new URLSearchParams({ mode: 'updateAccount', token, user, hash });
      const res = await fetch(addUrl + '?' + q.toString()); const j = await res.json();
      if (j.ok) alert('✅ Đã cấp lại mật khẩu mới cho ' + user + '. Mật khẩu mới: ' + np); else alert('❌ ' + (j.error || 'Không cấp lại được'));
    }
  });
})();

(function autoP0() {
  (async () => { try { if (!store.get(CFG_P0.ADMIN_HASH_KEY)) { const h = await hashWithSaltP0('Admin', '12345'); store.set(CFG_P0.ADMIN_HASH_KEY, h); } } catch (e) {} })();
  const _oldFinish = window.finishLogin;
  if (_oldFinish && !_oldFinish._pmAutoPull) {
    const _newFinish = function () { _oldFinish.apply(this, arguments); setTimeout(() => { try { pullReportsP0(false); } catch (e) {} }, 500); };
    _newFinish._pmAutoPull = true; window.finishLogin = _newFinish;
  }
  const st = document.createElement('style');
  st.textContent = '.pm-scroll{max-height:210px!important;overflow-y:auto!important;overflow-x:auto!important;display:block!important;border-radius:10px}.pm-scroll table thead th{position:sticky!important;top:0!important;z-index:2!important;background:#1a2a3a!important}.pm-scroll table tbody tr:nth-child(even){background:rgba(255,255,255,.03)!important}.pm-scroll::-webkit-scrollbar{width:6px;height:6px}.pm-scroll::-webkit-scrollbar-thumb{background:#3a4a5a;border-radius:10px}';
  document.head.appendChild(st);
  function polishP0() {
    document.querySelectorAll('td').forEach(td => { const t = td.textContent.trim(); if (/^\d{4}-\d{2}-\d{2}/.test(t) || t.includes('T17:') || t.includes('T00:') || /^\d{2}T.*\/\d{2}\/\d{4}/.test(t)) td.textContent = fmtDateVNP0(t); });
    document.querySelectorAll('table').forEach(tbl => {
      if (tbl.closest('.pm-scroll')) return; if (tbl.querySelectorAll('tbody tr').length <= 5) return;
      const wrap = document.createElement('div'); wrap.className = 'pm-scroll'; tbl.parentNode.insertBefore(wrap, tbl); wrap.appendChild(tbl);
    });
  }
  const _oldRender = window.renderDashboard;
  if (_oldRender && !_oldRender._pmClean) {
    const _newRender = function () { if (window.reports) window.reports.forEach(r => { if (r && typeof r.date === 'string') r.date = cleanDateP0(r.date); }); _oldRender.apply(this, arguments); setTimeout(polishP0, 100); };
    _newRender._pmClean = true; window.renderDashboard = _newRender;
  }
  let synced = false;
  async function syncSheetToSettingsP0() {
    if (synced) return;
    try {
      const res = await fetch(CFG_P0.SHEET_CSV, { cache: 'no-store' }); const text = await res.text();
      const lines = text.split('\n').slice(1).filter(l => l.trim()); const users = lines.map(l => l.split(',')[0].trim()).filter(Boolean);
      const listBox = [...document.querySelectorAll('*')].find(el => (el.textContent || '').trim() === 'Danh sách Team Lead'); if (!listBox) return;
      const container = listBox.parentElement; if (!container) return;
      [...container.querySelectorAll('*')].forEach(el => { if (el.children.length === 0 && el.textContent.trim() === 'Chưa có tài khoản nào') el.remove(); });
      container.querySelectorAll('[data-pm-sheet-user]').forEach(el => el.remove());
      users.forEach(u => {
        const div = document.createElement('div'); div.setAttribute('data-pm-sheet-user', u);
        div.style.cssText = 'padding:10px 12px;margin-top:8px;border-radius:10px;background:rgba(255,255,255,.06);display:flex;justify-content:space-between;align-items:center;';
        div.innerHTML = '<span><b>' + u + '</b><br><small style="opacity:.7">Từ Sheet Taikhoan</small></span><span><button data-act="reset" data-user="' + u + '" style="margin-right:6px;padding:4px 8px;border-radius:8px;border:0;background:#e8a020;color:#fff;cursor:pointer">Cấp lại MK</button><button data-act="del" data-user="' + u + '" style="padding:4px 8px;border-radius:8px;border:0;background:#c0392b;color:#fff;cursor:pointer">Xóa</button></span>';
        container.appendChild(div);
      }); synced = true;
    } catch (e) {}
  }
  const obs2 = new MutationObserver(() => { if ((document.body.innerText || '').includes('Danh sách Team Lead')) syncSheetToSettingsP0(); });
  obs2.observe(document.body, { childList: true, subtree: true });
})();

(function fixSetupLoop() {
  const obs = new MutationObserver(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Tạo mật khẩu & vào app');
    if (!btn) return;
    if (btn._auto) return;
    btn._auto = true;
    const inputs = [...document.querySelectorAll('input[type="password"]')].filter(el => el.offsetParent !== null);
    if (inputs.length >= 2 && !inputs[0].value) {
      inputs[0].value = '12345';
      inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[1].value = '12345';
      inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      const note = document.createElement('div');
      note.style.cssText = 'margin-top:10px;padding:10px;border-radius:10px;background:rgba(255,193,7,.2);color:#fff;font-size:13px;text-align:center';
      note.textContent = 'Máy mới - Bạn bấm nút xanh bên dưới để vào app với mật khẩu Admin mặc định 12345';
      btn.parentElement.insertBefore(note, btn);
    }
  });
  obs.observe(document.body, { childList: true, subtree: true });
})();