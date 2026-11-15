// auth-patch.js - BAN TOI UU: 1 file duy nhat, khong de chong cheo
// Chuc nang: 1. Dang nhap Team Lead qua Sheet | 2. Tu co Link + Token + Mat khau Admin | 3. Tu keo bao cao | 4. Gon bang 5 dong + Sua ngay

// ===== 1. DANG NHAP =====
(async () => {
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSMJYnJ9kIR3DBgEQOag2Sk4ERaa5g9pRgoktySd2wMTvr8er8dfnt-UK6lsJnnp37SERJFVdV1a4h9/pub?output=csv';

  function parseCSV(t) {
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

  async function loadAccounts() {
    const res = await fetch(SHEET_URL, { cache: 'no-store' });
    const text = await res.text();
    const rows = parseCSV(text);
    if (rows.length < 2) return [];
    const head = rows[0].map(x => String(x || '').trim().toUpperCase());
    const idx = (n) => head.indexOf(n);
    const iUser = idx('USER'), iHash = idx('HASH'), iBlock = idx('BLOCKED');
    const list = [];
    rows.slice(1).forEach(r => {
      const user = (r[iUser] || '').trim();
      if (!user) return;
      const perms = {};
      ['DASH', 'REPORT', 'PERF', 'ORDERS', 'HARNESS', 'EXPORT', 'DEL', 'HEDIT'].forEach(k => {
        const ii = idx(k);
        if (ii >= 0) perms[k.toLowerCase()] = String(r[ii] || '').trim().toUpperCase() === 'TRUE';
      });
      list.push({
        user,
        hash: String(r[iHash] || '').replace(/[^0-9a-f]/gi, '').toLowerCase().slice(0, 64),
        blocked: String(r[iBlock] || '').trim().toUpperCase() === 'TRUE',
        perms
      });
    });
    window.remoteAccounts = list;
    accounts = list;
    try { localStorage.setItem('pm_team_accounts', JSON.stringify(list)); } catch (e) {}
    return list;
  }

  const oldBtn = document.getElementById('btnLogin');
  if (oldBtn) {
    const newBtn = oldBtn.cloneNode(true);
    oldBtn.parentNode.replaceChild(newBtn, oldBtn);
    newBtn.addEventListener('click', async () => {
            // Nếu đang ở màn hình Thiết lập thì xử lý Thiết lập, không chạy code Đăng nhập
      if ((document.body.innerText || '').includes('Thiết lập mật khẩu Admin')) {
        const visPass = [...document.querySelectorAll('input[type="password"]')].filter(el => el.offsetParent !== null && getComputedStyle(el).display !== 'none');
        const p1 = visPass[0]?.value || '';
        const p2 = visPass[1]?.value || '';
        const msg2 = document.getElementById('lgMsg');
        if (!p1 || !p2) { if (msg2) msg2.textContent = '❌ Nhập mật khẩu'; return; }
        if (p1 !== p2) { if (msg2) msg2.textContent = '❌ 2 mật khẩu không khớp'; return; }
        const h = await sha256('Admin', p1);
        store.set('pm_admin_hash', h);
        location.reload();
        return;
      }const u = (document.getElementById('lgUser')?.value || '').trim();
      const p = document.getElementById('lgPass')?.value || '';
      const msg = document.getElementById('lgMsg');
      const setMsg = (t) => { if (msg) msg.textContent = t; };
      if (!u || !p) return setMsg('❌ Nhập tên tài khoản và mật khẩu');
      if (/^admin$/i.test(u)) {
        const h = await sha256('Admin', p);
        if (h !== store.get('pm_admin_hash', '')) return setMsg('❌ Sai tên tài khoản hoặc mật khẩu');
        session = { user: 'Admin', role: 'admin' };
        finishLogin();
        return;
      }
      let accs = [];
      try { accs = await loadAccounts(); } catch (e) { return setMsg('❌ Không tải được Sheet tài khoản.'); }
      const a = accs.find(x => x.user.toLowerCase() === u.toLowerCase());
      if (!a) return setMsg('❌ Tài khoản chưa có. Liên hệ Admin!');
      if (a.blocked) return setMsg('❌ Tài khoản đã bị chặn.');
      const h = await sha256(a.user, p);
      if (h !== a.hash) return setMsg('❌ Sai tên tài khoản hoặc mật khẩu');
      session = { user: a.user, role: 'lead' };
      window.__remotePerms = { [a.user]: a.perms };
      finishLogin();
    });
  }
})();

// ===== 2. KEO BAO CAO + SUA NGAY =====
function cleanDate(d) {
  if (!d) return d;
  const m = String(d).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  return String(d);
}
function fmtDateVN(d) {
  const s = String(d || '');
  const m2 = s.match(/(\d{2})T.*\/(\d{2})\/(\d{4})/);
  if (m2) return m2[1] + '/' + m2[2] + '/' + m2[3];
  const c = cleanDate(d);
  const m = String(c).match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + '/' + m[2] + '/' + m[1];
  return c;
}
async function pullReports(show) {
  const url = store.get('pm_push_url', '');
  const token = store.get('pm_push_token', '');
  if (!url) { if (show) alert('Chưa nhập link Web App'); return; }
  try {
    const res = await fetch(url + '?mode=list&token=' + encodeURIComponent(token), { cache: 'no-store' });
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Máy chủ chưa trả về báo cáo');
    reports = (j.reports || []).map(r => {
      const perf = r.perfList || r.perf || [];
      const defs = r.defectList || r.defects || [];
      const plan = perf.reduce((s, p) => s + (Number(p.plan) || 0), 0);
      const actual = perf.reduce((s, p) => s + (Number(p.actual) || Number(p.output) || 0), 0);
      const defects = Array.isArray(defs) ? defs.reduce((s, d) => s + (Number(d.qty) || Number(d.quantity) || Number(d.defects) || 0), 0) : (Number(r.defects) || 0);
      return { ...r, date: cleanDate(r.date), plan, actual, output: actual, totalPlan: plan, totalActual: actual, defects, defectCount: defects };
    });
    store.set('pm_prod_reports', reports);
    renderDashboard();
    if (show) alert('✅ Đã kéo ' + reports.length + ' báo cáo từ Sheet về cho Admin');
  } catch (e) {
    if (show) alert('❌ Chưa kéo được: ' + e.message);
  }
}
document.getElementById('btnSync')?.addEventListener('click', () => pullReports(false));

// ===== 3. TU DONG CAU HINH + TU QUA THIET LAP + GON BANG - CHI 1 KHOI DUY NHAT =====
(function () {
  const DEFAULT_PUSH_URL = 'https://script.google.com/macros/s/AKfycbwroNbMBO02aibQ7tFZxLKM9Ke1Gbl_OT0icHG8yThfalAVIjDAfX-xpxiX76mPBQI-Iw/exec';
  const DEFAULT_TOKEN = 'Davson267';
  const DEFAULT_ADMIN_PASS = '12345';

  // 3a. Tu dien Link + Token neu may moi chua co
  try {
    if (!store.get('pm_push_url')) store.set('pm_push_url', DEFAULT_PUSH_URL);
    if (!store.get('pm_push_token')) store.set('pm_push_token', DEFAULT_TOKEN);
  } catch (e) {}

  // 3b. Tu tao mat khau Admin neu may moi chua co
  (async () => {
    try {
      if (!store.get('pm_admin_hash')) {
        const h = await sha256('Admin', DEFAULT_ADMIN_PASS);
        store.set('pm_admin_hash', h);
      }
    } catch (e) {}
  })();

  // 3c. Dang nhap xong tu keo du lieu
  const _oldFinish = window.finishLogin;
  if (_oldFinish && !_oldFinish._pmAutoPull) {
    const _newFinish = function () {
      _oldFinish.apply(this, arguments);
      setTimeout(() => { try { pullReports(false); } catch (e) {} }, 500);
    };
    _newFinish._pmAutoPull = true;
    window.finishLogin = _newFinish;
  }

  // 3d. Tu qua man hinh Thiet lap Admin
  function setVal(input, val) {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function autoSetup() {
    if (!(document.body.innerText || '').includes('Thiết lập mật khẩu Admin')) return;
    const inputs = [...document.querySelectorAll('input[type="password"]')].filter(el => el.offsetParent !== null && getComputedStyle(el).display !== 'none');
    const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes('Tạo mật khẩu') && b.offsetParent !== null);
    if (inputs.length >= 2 && btn) {
      setVal(inputs[0], DEFAULT_ADMIN_PASS);
      setVal(inputs[1], DEFAULT_ADMIN_PASS);
      setTimeout(() => btn.click(), 300);
    }
  }
  const setupTimer = setInterval(() => {
    autoSetup();
    if (!(document.body.innerText || '').includes('Thiết lập mật khẩu Admin')) clearInterval(setupTimer);
  }, 500);
  setTimeout(() => clearInterval(setupTimer), 10000);

  // 3e. Gon bang: 5 dong + cuon + sua ngay hien thi
  const st = document.createElement('style');
  st.textContent = '.pm-scroll{max-height:210px!important;overflow-y:auto!important;overflow-x:auto!important;display:block!important;border-radius:10px}.pm-scroll table thead th{position:sticky!important;top:0!important;z-index:2!important;background:#1a2a3a!important}.pm-scroll table tbody tr:nth-child(even){background:rgba(255,255,255,.03)!important}.pm-scroll::-webkit-scrollbar{width:6px;height:6px}.pm-scroll::-webkit-scrollbar-thumb{background:#3a4a5a;border-radius:10px}.pm-sticky-head{position:sticky!important;top:0!important;z-index:2!important;background:#1a2a3a!important}';
  document.head.appendChild(st);

  function polish() {
    document.querySelectorAll('td').forEach(td => {
      const t = td.textContent.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(t) || t.includes('T17:') || t.includes('T00:') || /^\d{2}T.*\/\d{2}\/\d{4}/.test(t)) td.textContent = fmtDateVN(t);
    });
    document.querySelectorAll('table').forEach(tbl => {
      if (tbl.closest('.pm-scroll')) return;
      if (tbl.querySelectorAll('tbody tr').length <= 5) return;
      const wrap = document.createElement('div');
      wrap.className = 'pm-scroll';
      tbl.parentNode.insertBefore(wrap, tbl);
      wrap.appendChild(tbl);
    });
    document.querySelectorAll('*').forEach(el => {
      if (el.children.length !== 0) return;
      if (el.textContent.trim() !== 'PPM ngày' && el.textContent.trim() !== 'PPM lũy kế') return;
      const headerRow = el.parentElement;
      const grid = headerRow ? headerRow.parentElement : null;
      if (!grid || grid.classList.contains('pm-scroll')) return;
      if (grid.children.length <= 6) return;
      if (headerRow) headerRow.classList.add('pm-sticky-head');
      grid.classList.add('pm-scroll');
    });
  }

  const _oldRender = window.renderDashboard;
  if (_oldRender && !_oldRender._pmClean) {
    const _newRender = function () {
      if (window.reports) window.reports.forEach(r => { if (r && typeof r.date === 'string') r.date = cleanDate(r.date); });
      _oldRender.apply(this, arguments);
      setTimeout(polish, 100);
      setTimeout(polish, 500);
    };
    _newRender._pmClean = true;
    window.renderDashboard = _newRender;
  }
  document.addEventListener('click', () => setTimeout(polish, 400));
  setTimeout(polish, 600);
})();