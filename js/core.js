'use strict';
const $ = id => document.getElementById(id);
const num = v => { const n = Number(String(v ?? '').trim().replace(',', '.')); return Number.isFinite(n) ? n : 0; };
const fmt = (n, d = 2) => Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: d }) : '—';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v === null ? d : JSON.parse(v);
    } catch (e) {
      console.error('[PM] Không đọc được localStorage:', k, e);
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
      return true;
    } catch (e) {
      console.error('[PM] Không ghi được localStorage:', k, e);
      return false;
    }
  }
};
const localToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- Link mặc định Google Sheets ---------- */
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRuQFRlGNsBSQymmmj--rXgiT7VHIJWy_N5MAOWu528faqXRiIQM-2jm2TO7VRID_KXUv5be_qPd6w7/pub?output=csv';
const DEFAULT_ORDERS_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSjXDG509YIMFRKVnq--Ff0V24D9hlKwSTHkmxDx78YXw6IHRL3T2rdFQo6KNKEB9qkJQHdXtCzBHBK/pub?gid=1676265571&single=true&output=csv';
const DEFAULT_DEFECT_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRxgAyvS3IT9xjAMwZoUZzzqd2zLUaUS2e7SFJxR5mu2Sy-3CsEV2QxNm71Pvp1EXZkI9buJUnYZXa9/pub?output=csv';
const DEFAULT_EMP_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vStbjgCmowvOlDqicI6jd9HhqBOSbyoXCgNk3kiYuuyGFw_yrYXupezzdYqmgu-eL0qkHlausHsksHH/pub?output=csv';

const SAMPLE_DATA = [
  { name: 'ADAPTER MAL', line: 'EAP', group: 'BM4O050C11', fpnr: 'BM4O050111', asm: 6.164, pst: 1.155, total: 7.319 },
  { name: 'ADAPTER AIRBAG', line: 'EAP', group: 'BM4O055C11', fpnr: 'BM4O055110', asm: 3.725, pst: 0.875, total: 4.6 },
  { name: 'FRONT BUMPER', line: 'USL', group: 'BM4O120C10', fpnr: 'BM4O120110', asm: 19.267, pst: 2.59, total: 21.857 },
  { name: 'COCKPIT', line: 'USL', group: 'BM4O230C11', fpnr: 'BM4O230111', asm: 41.169, pst: 5.655, total: 46.824 }
];
let data = [];

/* ---------- Mã hóa mật khẩu ---------- */
const fbHash = s => {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 'f' + (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
};
async function sha256(u, p) {
  const s = p === undefined ? String(u) : `${u}:${p}`;
  try {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch { return fbHash(s); }
}
const genPw = () => {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789', r = new Uint32Array(8);
  try { crypto.getRandomValues(r); } catch { r.forEach((_, i) => r[i] = Math.random() * 4294967296); }
  return [...r].map(x => c[x % c.length]).join('');
};

/* ---------- CSV ---------- */
function csvRows(t) {
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
function parseCSV(text) {
  const all = csvRows(text);
  if (!all.length) return [];
  let h = all.findIndex(r => r.some(x => /FPNR/i.test(x)));
  if (h < 0) h = 0;
  const head = all[h].map(x => x.trim().toUpperCase());
  const col = (re, def) => { const i = head.findIndex(x => re.test(x)); return i >= 0 ? i : def; };
  const iName = col(/NAME|TÊN/, 0), iLine = col(/^LINE$/, 1), iGroup = col(/BUILD|GROUP/, 2), iFpnr = col(/FPNR/, 3),
    iAsm = col(/ASSEMBLY/, 4), iPst = col(/^PST$/, 5), iTot = col(/TOTAL/, 6);
  const out = [];
  all.slice(h + 1).forEach(c => {
    if (!c || c.length <= iFpnr) return;
    const fpnr = (c[iFpnr] || '').trim();
    if (!fpnr) return;
    const tot0 = num(c[iTot]);
    const fixv = v => { let n = 0; while (tot0 > 0 && v > tot0 && n++ < 3) v /= 1000; return v; };
    const asm = fixv(num(c[iAsm])), pst = fixv(num(c[iPst]));
    const total = num(c[iTot]) || Number((asm + pst).toFixed(3));
    if (asm > 0 || pst > 0) {
      out.push({ name: (c[iName] || '').trim(), line: (c[iLine] || '').trim().toUpperCase(), group: (c[iGroup] || '').trim(), fpnr, asm, pst, total });
    }
  });
  return out;
}

/* ---------- Dữ liệu FPNR ---------- */
function setData(rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  data = rows;
  const sel = $('sel');
  const savedFpnr = String(store.get('pm_selected_fpnr', '') || '');
  const legacyIndex = String(store.get('pm_selected_fpnr_index', 0));
  const frag = document.createDocumentFragment();
  rows.forEach((r, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${r.fpnr} · ${r.name} (${r.line})`;
    frag.append(o);
  });
  sel.replaceChildren(frag);
  const stableIndex = savedFpnr ? rows.findIndex(r => String(r.fpnr) === savedFpnr) : -1;
  const legacyValid = sel.querySelector(`option[value="${legacyIndex}"]`);
  sel.value = stableIndex >= 0 ? String(stableIndex) : (legacyValid ? legacyIndex : '0');
  pick();
  fillFpnr();
  if ($('orders').classList.contains('active')) renderOrders();
}
function pick() {
  const p = data[Number($('sel').value)] || data[0];
  if (!p) return;
  store.set('pm_selected_fpnr', String(p.fpnr || ''));
  store.set('pm_selected_fpnr_index', $('sel').value);
  $('pLine').value = `${p.line} · ${p.group}`;
  $('people').value = p.line === 'EAP' ? 1 : 14;
  calc2();
}

/* ---------- Tính toán ---------- */
function calc1() {
  const order = Math.max(0, num($('orderMinutes').value)), shift = Math.max(0, num($('shiftMinutes').value)),
    shifts = Math.max(0, num($('shifts').value)), ops = Math.max(0, num($('operators').value)), eff = Math.max(0, num($('efficiency').value));
  const per = shift * shifts * ops * eff / 100;
  $('perDay').textContent = fmt(per) + ' phút';
  $('days').textContent = per > 0 ? fmt(order / per, 2) + ' ngày' : 'Không đủ dữ liệu';
}
function calc2() {
  const p = data[Number($('sel').value)];
  if (!p) return;
  const std = num(p[$('basis').value]), work = Math.max(0, num($('work').value)),
    eff = Math.max(0, num($('eff2').value)) / 100, people = Math.max(1, num($('people').value));
  const need = work * eff * people, exact = std > 0 ? need / std : 0, sets = exact > 0 ? Math.ceil(exact) : 0;
  const real = work > 0 ? sets * std / (work * people) * 100 : 0, ct = sets > 0 ? work * 60 / sets : 0;
  $('std').textContent = fmt(std, 3) + ' phút';
  $('stdDetail').textContent = `Assembly Board: ${fmt(p.asm, 3)} · PST: ${fmt(p.pst, 3)} · Total: ${fmt(p.total, 3)}`;
  $('stdAgain').textContent = fmt(std, 3) + ' phút';
  $('needStd').textContent = fmt(need);
  $('setsExact').textContent = fmt(exact, 3);
  $('sets').textContent = fmt(sets, 0) + ' bộ';
  $('effReal').textContent = fmt(real, 2) + '%';
  $('ctSec').textContent = sets ? fmt(ct, 1) + ' giây' : '—';
  $('ctMin').textContent = sets ? fmt(ct / 60, 3) + ' phút/bộ' : '—';
  $('stationStd').textContent = fmt(std * 60 / people, 1) + ' giây';
}

/* ---------- Phân quyền & Điều hướng ---------- */
let reports = store.get('pm_prod_reports', []).map(r => r.id ? r : { ...r, id: uid() });
let accounts = store.get('pm_team_accounts', []);
let session = store.get('pm_session', null);
let openAcc = '';

const PERM_LIST = [
  ['dash', 'Xem Dashboard'], ['report', 'Nhập báo cáo hàng ngày'], ['perf', 'Năng lực & Hiệu suất'],
  ['orders', 'Theo dõi đơn hàng'], ['harness', 'Bản đồ bộ dây'], ['export', 'Xuất file CSV'],
  ['del', 'Xóa báo cáo'], ['hedit', 'Chỉnh vị trí chấm bộ dây']
];
const DEF_PERMS = { dash: true, report: true, perf: true, orders: true, harness: true, export: true, del: false, hedit: false };
const PAGE_PERM = { dashboard: 'dash', report: 'report', perf: 'perf', orders: 'orders', harness: 'harness' };
const PAGE_ORDER = ['dashboard', 'report', 'perf', 'orders', 'harness', 'database'];

const adminHash = () => store.get('pm_admin_hash', '');
const isAdmin = () => !!session && session.role === 'admin';
const permsOf = a => ({ ...DEF_PERMS, ...((a && a.perms) || {}) });
const findAcc = u => accounts.find(a => a.user.toLowerCase() === String(u || '').toLowerCase());
const can = k => {
  if (!session) return false;
  if (isAdmin()) return true;
  const a = findAcc(session.user);
  return !!a && !a.blocked && !!permsOf(a)[k];
};
const canPage = id => id === 'database' ? isAdmin() : can(PAGE_PERM[id]);
const firstPage = () => PAGE_ORDER.find(canPage) || '';

function showPage(id) {
  if (id !== 'noperm' && !canPage(id)) id = firstPage() || 'noperm';
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('active', p.id === id));
  document.querySelectorAll('.nav button').forEach(b => b.classList.toggle('active', b.dataset.page === id));
  if (id === 'orders') { fillOrdView(); renderOrders(); }
  window.scrollTo(0, 0);
}
document.querySelectorAll('.nav button').forEach(b => b.addEventListener('click', () => showPage(b.dataset.page)));

function updateTeamLeadSelect() {
  const sel = $('repUser'), cur = sel.value, frag = document.createDocumentFragment();
  const list = isAdmin()
    ? [['Admin', 'Admin (Quản trị viên)'], ...accounts.map(a => [a.user, `${a.user} (Team Lead)`])]
    : (session ? [[session.user, `${session.user} (Team Lead)`]] : []);
  list.forEach(([v, t]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = t; frag.append(o);
  });
  sel.replaceChildren(frag);
  if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
  sel.disabled = !isAdmin();
}

/* ---------- Mã lỗi & Nhân viên ---------- */
const SAMPLE_DEFECTS = [['D01', 'Đứt dây'], ['D02', 'Sai màu dây'], ['D03', 'Sai vị trí cavity'], ['D04', 'Bấm terminal lỗi'], ['D05', 'Thiếu linh kiện'], ['D06', 'Sai chiều dài'], ['D07', 'Lỗi tem/nhãn'], ['D08', 'Hỏng đầu nối'], ['D09', 'Lỗi quấn băng keo'], ['D10', 'Khác']].map(([code, desc]) => ({ code, desc }));
let defCodes = store.get('pm_defects_cache', null) || SAMPLE_DEFECTS;
let pendDef = [];
const defName = c => c === 'N/A' ? 'Chưa phân loại' : (defCodes.find(d => d.code === c) || {}).desc || '';

function parseDefects(text) {
  const all = csvRows(text);
  let h = all.findIndex(r => r.some(x => /DEFECT\s*NO|CODE|MÃ/i.test(x)));
  if (h < 0) h = 0;
  const head = all[h].map(x => x.trim().toUpperCase());
  const col = (re, d) => { const i = head.findIndex(x => re.test(x)); return i >= 0 ? i : d; };
  const iC = col(/DEFECT\s*NO|CODE|MÃ|^NO$/, 0), iVn = col(/\bVN\b|VIỆT|MÔ TẢ/, -1), iEn = col(/\bENG\b|ENGLISH|DESC/, -1);
  const seen = new Set(), out = [];
  all.slice(h + 1).forEach(c => {
    const code = (c[iC] || '').trim();
    if (!code || seen.has(code)) return;
    seen.add(code);
    const vn = iVn >= 0 ? (c[iVn] || '').trim() : '', en = iEn >= 0 ? (c[iEn] || '').trim() : '';
    out.push({ code, desc: vn || en || (iVn < 0 && iEn < 0 ? (c[iC + 1] || '').trim() : ''), en });
  });
  return out;
}
function fillDefSelect() {
  const frag = document.createDocumentFragment();
  defCodes.forEach(d => { const o = document.createElement('option'); o.value = d.code; o.textContent = d.desc ? `${d.code} · ${d.desc}` : d.code; if (d.en) o.title = d.en; frag.append(o); });
  $('defCode').replaceChildren(frag);
  $('defCount').textContent = `Đang có ${defCodes.length} mã lỗi` + (store.get('pm_defect_url', DEFAULT_DEFECT_URL) ? '' : ' (danh sách mẫu, chưa liên kết Sheets)');
}
async function syncDefects(showMsg) {
  const url = store.get('pm_defect_url', DEFAULT_DEFECT_URL);
  if (!url) return;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw 0;
    const rows = parseDefects(await res.text());
    if (!rows.length) throw 0;
    defCodes = rows; store.set('pm_defects_cache', rows); fillDefSelect(); renderPareto();
    if (showMsg) flash($('defMsg'), `✅ Đã đồng bộ ${rows.length} mã lỗi`);
  } catch { if (showMsg) flash($('defMsg'), '❌ Không tải được link mã lỗi. Kiểm tra lại link CSV đã xuất bản.', true); }
  finally { clearTimeout(t); }
}

let employees = store.get('pm_emp_cache', []);
const norm = t => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
const empNameOf = (id, st) => id === '?' ? 'Không xác định' : (!id || id === '—') ? 'Chưa ghi nhận' : ((employees.find(e => e.id === id) || {}).name || st || '');
function parseEmp(text) {
  const all = csvRows(text);
  let h = all.findIndex(r => r.some(x => /HỌ\s*VÀ\s*TÊN|^ID$/i.test(x.trim())));
  if (h < 0) h = 0;
  const head = all[h].map(x => x.trim().toUpperCase());
  const col = (re, d) => { const i = head.findIndex(x => re.test(x)); return i >= 0 ? i : d; };
  const iId = col(/^ID$|MÃ\s*NV|MSNV|MÃ SỐ/, 1), iN = col(/HỌ|TÊN|NAME/, 2);
  const hn = head.map(x => norm(x).toUpperCase()), iS = hn.findIndex(x => /^CA$|^CA |CA LAM|SHIFT|^CA LV/.test(x));
  const shiftOf = v => { v = String(v || '').trim(); if (!v) return ''; const m = v.match(/^(?:ca\s*)?([A-Za-z0-9])$/i) || v.match(/\bca\s*([A-Za-z0-9])\b/i); return m ? 'Ca ' + m[1].toUpperCase() : v; };
  const seen = new Set(), out = [];
  all.slice(h + 1).forEach(c => { const id = (c[iId] || '').trim(); if (id && !seen.has(id)) { seen.add(id); out.push({ id, name: (c[iN] || '').trim(), shift: iS >= 0 ? shiftOf(c[iS]) : '' }); } });
  return out;
}
function fillEmpSel(fid, sid, unk) {
  const q = norm($(fid).value.trim()), sel = $(sid), cur = sel.value, frag = document.createDocumentFragment();
  const add = (v, t) => { const o = document.createElement('option'); o.value = v; o.textContent = t; frag.append(o); };
  add('', '— Chọn nhân viên —'); if (unk) add('?', 'Không xác định');
  const sh = $('empShift').value;
  const list = employees.filter(e => (!sh || e.shift === sh) && (!q || norm(e.id + ' ' + e.name).includes(q)));
  list.slice(0, 200).forEach(e => add(e.id, `${e.id} · ${e.name}`));
  sel.replaceChildren(frag);
  if (q && list.length === 1) sel.value = list[0].id;
  else if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  return list.length;
}
function fillEmpShiftSel() {
  const sel = $('empShift'), cur = store.get('pm_emp_shift', ''), shs = [...new Set(employees.map(e => e.shift).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Tất cả nhân viên</option>' + shs.map(x => `<option value="${esc(x)}">${esc(x)} (${employees.filter(e => e.shift === x).length} người)</option>`).join('');
  sel.value = shs.includes(cur) ? cur : '';
  $('shiftEmpCnt').textContent = shs.length ? '' : '(file nhân viên chưa có cột CA)';
}
function fillEmpSelect() {
  fillEmpShiftSel();
  const n = fillEmpSel('empFilter', 'defEmp', true); fillEmpSel('opFilter', 'opEmp', false);
  const sh = $('empShift').value;
  $('empCount').textContent = `(${n}/${employees.length}${sh ? ' · ' + sh : ''})`;
  $('empInfo').textContent = `Đang có ${employees.length} nhân viên`;
}
async function syncEmp(show) {
  const url = store.get('pm_emp_url', DEFAULT_EMP_URL);
  if (!url) return;
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw 0;
    const rows = parseEmp(await res.text());
    if (!rows.length) throw 0;
    employees = rows; store.set('pm_emp_cache', rows); fillEmpSelect(); renderPareto();
    if (show) flash($('empMsg'), `✅ Đã đồng bộ ${rows.length} nhân viên`);
  } catch { if (show) flash($('empMsg'), '❌ Không tải được link nhân viên. Kiểm tra link CSV đã xuất bản.', true); }
  finally { clearTimeout(t); }
}

function renderEmp() {
  $('empLabel').textContent = $('parLabel').textContent;
  const fLine = $('filterLine').value, [from, to] = parRange(), by = {};
  reports.filter(r => r.date >= from && r.date <= to && (!fLine || r.line === fLine)).forEach(r => (r.defectList || []).forEach(x => {
    const k = x.emp || '—', e = by[k] || (by[k] = { id: k, st: x.empName, total: 0, codes: {} });
    e.total += x.qty; e.codes[x.code] = (e.codes[x.code] || 0) + x.qty;
  }));
  const arr = Object.values(by).sort((a, b) => b.total - a.total);
  if (!arr.length) { $('empChart').innerHTML = '<div class="empty">Chưa có lỗi gắn với nhân viên trong khoảng thời gian này</div>'; return; }
  const max = arr[0].total, short = n => (n || '').trim().split(/\s+/).pop();
  $('empChart').innerHTML = `<div class="legend"><span><i class="dot bad"></i>Nhiều lỗi nhất</span><span><i class="dot" style="background:#e0a82e"></i>Khác</span></div>
    <div class="plot"><div class="plotin">` + arr.map((e, i) => { const c = i === 0 ? 'bad' : 'mid', nm = empNameOf(e.id, e.st);
      return `<div class="cw"><div class="cb"><div class="val ${c}"><b>${fmt(e.total, 0)}</b></div><div class="bar ${c}" style="height:${e.total / max * 72}%"></div></div><div class="lbl"><b>${esc(e.id)}</b><small title="${esc(nm)}">${esc(short(nm))}</small></div></div>`; }).join('') +
    `</div></div><div class="table-wrap"><table style="min-width:520px"><thead><tr><th>#</th><th>ID</th><th>Họ tên</th><th>Lỗi</th><th>Lỗi nhiều nhất</th><th>Chi tiết mã lỗi</th></tr></thead><tbody>` +
    arr.map((e, i) => { const cs = Object.entries(e.codes).sort((a, b) => b[1] - a[1]), top = cs[0];
      return `<tr><td>${i + 1}</td><td><b>${esc(e.id)}</b></td><td>${esc(empNameOf(e.id, e.st))}</td><td class="${i === 0 ? 'bad' : ''}">${fmt(e.total, 0)}</td><td>${esc(top[0])} · ${esc(defName(top[0]))} (${top[1]})</td><td>${cs.map(([c, q]) => esc(c) + ' ×' + q).join(', ')}</td></tr>`; }).join('') + '</tbody></table></div>';
}

let pendOp = [];
function renderOpList() {
  const p = data[Number($('repFpnr').value)], std = curStd(p);
  $('opList').innerHTML = pendOp.length ? pendOp.map(o => { const eff = o.mins > 0 && std > 0 ? o.qty * std / o.mins * 100 : 0;
    return `<span class="chip"><span><b>${esc(o.emp)}</b> ${esc(empNameOf(o.emp, o.empName))}<br><small style="color:var(--muted)">${fmt(o.qty, 0)} bộ · ${fmt(o.mins, 0)} phút · HS ${fmt(eff, 1)}%</small></span><button type="button" data-rm="${esc(o.emp)}" aria-label="Xóa">×</button></span>`; }).join('')
    : '<span class="hint">Chưa có (bỏ trống nếu chỉ báo cáo theo bộ dây)</span>';
  calcLine();
}

/* ---------- Outbox đồng bộ ---------- */
let outbox = store.get('pm_outbox', []), flushing = false;
if (!Array.isArray(outbox)) outbox = [];
const savedSyncedIds = store.get('pm_synced_report_ids', []);
let syncedIds = new Set(Array.isArray(savedSyncedIds) ? savedSyncedIds : []);
reports.forEach(r => {
  const pending = outbox.some(o => (o.report && o.report.id === r.id) || o.id === r.id);
  if (!pending && r.id) syncedIds.add(r.id);
});
const saveSyncedIds = () => store.set('pm_synced_report_ids', [...syncedIds]);
const saveOut = () => store.set('pm_outbox', outbox);

function payload(r) {
  return { id: r.id, date: r.date, shift: r.shift, line: r.line, user: r.user, fpnr: r.fpnr || '', name: r.name || '', plan: r.plan, actual: r.actual, std: r.std || 0, basis: r.basis || '', stdAsm: r.stdAsm || 0, stdPst: r.stdPst || 0,
    pstQty: r.pstQty || 0, pstPeople: r.pstPeople || 0, pstMins: r.pstMins || 0, pstEff: Math.round(pstEffOf(r) * 10) / 10,
    people: r.people || 0, mins: r.mins || 0, lineEff: Math.round(lineEffOf(r) * 10) / 10,
    ops: (r.ops || []).map(o => ({ emp: o.emp, name: empNameOf(o.emp, o.empName), qty: o.qty, mins: o.mins })),
    defects: (r.defectList || []).map(x => ({ code: x.code, desc: defName(x.code), qty: x.qty, emp: x.emp || '', name: x.emp ? empNameOf(x.emp, x.empName) : '' })) };
}
function updatePushInfo() { $('pushInfo').textContent = `Đang chờ gửi: ${outbox.length} bản ghi` + (store.get('pm_push_url', '') ? '' : ' (chưa nhập link Web App)'); }
function queue(op) {
  const id = op?.report?.id || op?.id;
  const exists = id && outbox.some(x => x.op === op.op && (x.report?.id || x.id) === id);
  if (!exists) outbox.push(op);
  saveOut(); updatePushInfo(); renderTrack(); flushOutbox(false);
}

async function flushOutbox(show) {
  const url = store.get('pm_push_url', ''), token = store.get('pm_push_token', '');
  if (!url) { if (show) flash($('pushMsg'), '❌ Chưa nhập link Web App', true); return; }
  if (flushing) return;
  if (!outbox.length) { if (show) flash($('pushMsg'), '✅ Không còn dữ liệu chờ gửi'); return; }
  flushing = true; let sent = 0;
  try {
    while (outbox.length) {
      const currentItem = outbox[0];
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 25000);
      let res, textRes;
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ token, ...currentItem }),
          signal: ctl.signal
        });
        textRes = await res.text();
      } finally { clearTimeout(t); }
      if (!res.ok) throw new Error(`Máy chủ HTTP ${res.status}`);
      let j;
      try { j = JSON.parse(textRes); } catch { throw new Error('Phản hồi từ server không hợp lệ'); }
      if (j.ok !== true) throw new Error(j.error || 'Máy chủ chưa xác nhận lưu dữ liệu');
      const completedId = currentItem.report?.id || (currentItem.op === 'delete' ? currentItem.id : '');
      outbox.shift();
      if (currentItem.op === 'upsert' && completedId) syncedIds.add(completedId);
      if (currentItem.op === 'delete' && completedId) syncedIds.delete(completedId);
      saveOut(); saveSyncedIds(); sent++;
    }
    if (show || sent) flash($('pushMsg'), `✅ Đã gửi thành công ${sent} bản ghi lên Google Sheets`);
  } catch (e) { if (show) flash($('pushMsg'), '❌ Chưa gửi được: ' + (e.message || 'lỗi mạng') + '. App sẽ tự thử lại ngầm.', true); }
  finally { flushing = false; updatePushInfo(); renderTrack(); }
}

/* ---------- Theo dõi đã nhập ---------- */
const lineEffOf = r => { const s = r.basis ? r.std : (r.stdAsm || r.std); return (r.people > 0 && r.mins > 0 && s > 0) ? (Number(r.actual) || 0) * s / (r.people * r.mins) * 100 : 0; };
const pstEffOf = r => (r.pstQty > 0 && r.pstPeople > 0 && r.pstMins > 0 && r.stdPst > 0) ? r.pstQty * r.stdPst / (r.pstPeople * r.pstMins) * 100 : 0;
const BASIS_NAME = { pst: 'PST', asm: 'ASSEMBLY BOARD', total: 'TOTAL MIN' };
const curStd = p => p ? num(p[$('repBasis').value]) : 0;

function calcLine() {
  const usl = $('repLine').value === 'USL';
  $('opBox').style.display = usl ? 'none' : '';
  $('lineBox').style.display = usl ? '' : 'none';
  const p = data[Number($('repFpnr').value)], actual = num($('repActual').value), plan = num($('repPlan').value), std = curStd(p), bn = BASIS_NAME[$('repBasis').value];
  $('basisHint').textContent = p ? `Đang tính theo phút chuẩn ${bn}: ${fmt(std, 3)} phút/bộ (${p.line})` : '';
  const ok = plan > 0 && actual >= plan;
  $('planBox').className = 'result' + (plan > 0 ? (ok ? ' good' : ' bad') : '');
  $('planRate').textContent = plan > 0 ? fmt(actual / plan * 100, 1) + '%' : '—';
  $('planStatus').textContent = plan <= 0 ? 'Chưa nhập kế hoạch'
    : ok ? `✅ ĐẠT kế hoạch (${fmt(actual, 0)}/${fmt(plan, 0)} bộ)` : `❌ CHƯA ĐẠT kế hoạch (${fmt(actual, 0)}/${fmt(plan, 0)} bộ, thiếu ${fmt(plan - actual, 0)})`;
  if (usl) {
    const ppl = num($('lnPeople').value), mins = num($('lnMin').value),
      eff = ppl > 0 && mins > 0 && std > 0 ? actual * std / (ppl * mins) * 100 : 0;
    $('lnEff').textContent = fmt(eff, 1) + '%';
    $('lnDetail').textContent = `${fmt(actual, 0)} bộ × ${fmt(std, 3)} phút chuẩn ${bn} ÷ (${fmt(ppl, 0)} người × ${fmt(mins, 0)} phút)`;
  } else {
    const q = num($('opQty').value), m = num($('opMin').value), eff = q > 0 && m > 0 && std > 0 ? q * std / m * 100 : 0;
    $('opPrevEff').textContent = fmt(eff, 1) + '%';
    $('opPrevTxt').textContent = `${fmt(q, 0)} bộ × ${fmt(std, 3)} phút chuẩn ${bn} ÷ ${fmt(m, 0)} phút` + (eff > 0 ? (eff >= 100 ? ' · ✅ đạt 100%' : ' · ❌ dưới 100%') : '');
  }
}

function isSent(id) { return syncedIds.has(id) && !outbox.some(o => (o.report && o.report.id === id) || o.id === id); }
function renderTrack() {
  const date = $('repDate').value, shift = $('repShift').value, hasUrl = !!store.get('pm_push_url', '');
  $('trkLabel').textContent = date ? date.split('-').reverse().join('/') : '';
  const list = reports.filter(r => r.date === date).reverse()
    .sort((a, b) => String(a.shift).localeCompare(String(b.shift)));
  const totalA = list.reduce((a, r) => a + (Number(r.actual) || 0), 0);
  $('trkSum').textContent = list.length ? `Đã nhập ${list.length} báo cáo · tổng thực tế ${fmt(totalA, 0)} bộ` : '';
  $('trkList').innerHTML = list.length ? list.map(r => {
    const st = !hasUrl ? ['wn', '💾 Chỉ lưu máy'] : isSent(r.id) ? ['ok', '✔ Đã gửi Sheets'] : ['wn', '⏳ Chờ gửi'];
    const ops = r.people > 0 ? `${fmt(r.people, 0)} người · HS chuyền lắp ráp ${fmt(lineEffOf(r), 1)}%`
      : (r.ops || []).map(o => `${esc(o.emp)} (${fmt(o.qty, 0)})`).join(', ') || 'chưa nhập nhân viên';
    return `<div class="hcard${r.shift === shift ? ' cur' : ''}"><div class="hrow"><b>${esc(r.fpnr || '—')} · ${esc(r.name || '')}</b><span class="pill ${st[0]}">${st[1]}</span></div>
      <div class="hc-o">${esc(r.shift)} · ${esc(r.line)} · ${esc(r.user)}</div>
      <div class="hint" style="margin:6px 0 0">KH ${fmt(r.plan, 0)} · TT ${fmt(r.actual, 0)} · Lỗi ${fmt(r.defects, 0)}<br>👷 ${ops}${r.pstQty > 0 ? `<br>🧪 PST: ${fmt(r.pstQty, 0)} bộ · ${fmt(r.pstPeople, 0)} người · HS ${fmt(pstEffOf(r), 1)}%` : ''}</div>
      <button class="btn-del" type="button" data-del-report="${esc(r.id)}">Xóa</button></div>`;
  }).join('') : '<div class="empty">Chưa có báo cáo nào trong ngày này</div>';
}
$('trkList').addEventListener('click', e => {
  if (!can('del')) return;
  const id = e.target.dataset.delReport;
  if (!id || !confirm('Bạn có chắc muốn xóa báo cáo này không?')) return;
  reports = reports.filter(r => r.id !== id);
  queue({ op: 'delete', id });
  store.set('pm_prod_reports', reports);
  renderDashboard();
  fillFpnr();
});

function renderDefList() {
  $('defList').innerHTML = pendDef.length ? pendDef.map(x => `<span class="chip"><span><b>${esc(x.code)}</b> ${esc(defName(x.code))} × ${x.qty}<br><small style="color:var(--muted)">👷 ${esc(x.emp === '?' ? 'Không xác định' : x.emp + ' · ' + empNameOf(x.emp, x.empName))}</small></span><button type="button" data-rm="${esc(x.code)}|${esc(x.emp)}" aria-label="Xóa">×</button></span>`).join('') : '<span class="hint">Chưa có lỗi nào (có thể bỏ trống nếu không có lỗi)</span>';
  $('defTotal').textContent = fmt(pendDef.reduce((a, x) => a + x.qty, 0), 0);
}
function fillFpnr() {
  const line = $('repLine').value, date = $('repDate').value, shift = $('repShift').value,
    cur = $('repFpnr').value, frag = document.createDocumentFragment();
  const done = new Set(reports.filter(r => r.date === date && r.shift === shift && r.line === line).map(r => r.fpnr));
  let n = 0;
  data.forEach((r, i) => { if (r.line === line) { n++; const o = document.createElement('option'); o.value = i;
    o.textContent = (done.has(r.fpnr) ? '✓ ' : '') + `${r.fpnr} · ${r.name}`; frag.append(o); } });
  $('repFpnr').replaceChildren(frag);
  if ([...$('repFpnr').options].some(o => o.value === cur)) $('repFpnr').value = cur;
  $('fpnrCount').textContent = `(${n} bộ dây · ✓ = đã nhập ${done.size})`;
  fpnrInfo();
  renderTrack();
}
function fpnrInfo() {
  const p = data[Number($('repFpnr').value)];
  renderOpList();
  calcLine();
  $('repFpnrInfo').textContent = p ? `${p.name} · ${p.group} · Assembly: ${fmt(p.asm, 3)} · PST: ${fmt(p.pst, 3)} · Tổng: ${fmt(p.total, 3)}` : 'Chưa có bộ dây cho Line này';
}

/* ---------- Thống kê Pareto & PPM ---------- */
const ymd = dt => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
function parRange() {
  const v = $('parDate').value || localToday(), [y, m, d] = v.split('-').map(Number), sc = $('parScope').value;
  if (sc === 'day') return [v, v];
  if (sc === 'week') { const w = (new Date(y, m - 1, d).getDay() + 6) % 7; return [ymd(new Date(y, m - 1, d - w)), ymd(new Date(y, m - 1, d - w + 6))]; }
  if (sc === 'month') return [ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m, 0))];
  if (sc === 'year') return [`${y}-01-01`, `${y}-12-31`];
  return ['0000-00-00', '9999-99-99'];
}
function parShift(dir) {
  const [y, m, d] = ($('parDate').value || localToday()).split('-').map(Number), sc = $('parScope').value;
  const t = { day: new Date(y, m - 1, d + dir), week: new Date(y, m - 1, d + 7 * dir), month: new Date(y, m - 1 + dir, 1), year: new Date(y + dir, m - 1, 1) }[sc];
  if (!t) return;
  $('parDate').value = ymd(t); renderPareto();
}
function renderPareto() { renderParetoCore(); renderEmp(); }
function renderParetoCore() {
  const sc = $('parScope').value, fLine = $('filterLine').value, [from, to] = parRange();
  const pv = $('parDate').value || localToday(), [y, m] = pv.split('-'), f2 = x => x.split('-').reverse().join('/');
  $('parLabel').textContent = (sc === 'day' ? f2(pv) : sc === 'week' ? `${f2(from).slice(0, 5)} – ${f2(to)}` : sc === 'month' ? `Tháng ${m}/${y}` : sc === 'year' ? `Năm ${y}` : 'Tất cả thời gian') + (fLine ? ' · ' + fLine : '');
  const sum = {}; let total = 0, output = 0;
  reports.filter(r => r.date >= from && r.date <= to && (!fLine || r.line === fLine)).forEach(r => {
    output += Number(r.actual) || 0;
    const list = Array.isArray(r.defectList) && r.defectList.length ? r.defectList : ((Number(r.defects) || 0) > 0 ? [{ code: 'N/A', qty: Number(r.defects) }] : []);
    list.forEach(x => { sum[x.code] = (sum[x.code] || 0) + x.qty; total += x.qty; });
  });
  const arr = Object.entries(sum).sort((a, b) => b[1] - a[1]);
  if (!arr.length) { $('parChart').innerHTML = '<div class="empty">Chưa có dữ liệu lỗi trong khoảng thời gian này</div>'; return; }
  const max = arr[0][1]; let cum = 0;
  const rows = arr.map(([code, q]) => { const before = cum; cum += q; return { code, q, pct: q / total * 100, cum: cum / total * 100, hot: before < 0.8 * total }; });
  $('parChart').innerHTML = `<div class="hint">Tổng ${fmt(total, 0)} lỗi · ${fmt(output > 0 ? total / output * 1e6 : 0, 0)} PPM</div>
    <div class="legend"><span><i class="dot bad"></i>Nhóm gây ~80% lỗi (ưu tiên)</span><span><i class="dot" style="background:#e0a82e"></i>Còn lại</span></div>
    <div class="plot"><div class="plotin">` + rows.map(r => { const c = r.hot ? 'bad' : 'mid';
      return `<div class="cw"><div class="cb"><div class="val ${c}"><b>${fmt(r.q, 0)}</b><small>${fmt(r.pct, 0)}%</small></div><div class="bar ${c}" style="height:${r.q / max * 72}%"></div></div><div class="lbl"><b title="${esc(defName(r.code))}">${esc(r.code)}</b></div></div>`; }).join('') +
    `</div></div><div class="table-wrap"><table style="min-width:380px"><thead><tr><th>Mã</th><th>Mô tả</th><th>Lỗi</th><th>%</th><th>Lũy kế</th></tr></thead><tbody>` +
    rows.map(r => `<tr><td><b>${esc(r.code)}</b></td><td>${esc(defName(r.code))}</td><td>${fmt(r.q, 0)}</td><td>${fmt(r.pct, 1)}%</td><td class="${r.hot ? 'bad' : ''}">${fmt(r.cum, 0)}%</td></tr>`).join('') + '</tbody></table></div>';
}

function ppmTargets() { return store.get('pm_ppm_targets', {}); }
function loadPpmTarget() {
  const t = ppmTargets(), m = $('ppmMonth').value;
  $('ppmTarget').value = t[m] ?? t.default ?? 600;
}
function renderPPM() {
  const month = $('ppmMonth').value || localToday().slice(0, 7), fLine = $('filterLine').value;
  const target = Math.max(0, num($('ppmTarget').value));
  $('ppmLineTxt').textContent = fLine ? 'Line ' + fLine : 'Tất cả Line';
  const byDay = {};
  reports.filter(r => String(r.date).startsWith(month) && (!fLine || r.line === fLine)).forEach(r => {
    const d = byDay[r.date] || (byDay[r.date] = { a: 0, d: 0 });
    d.a += Number(r.actual) || 0; d.d += Number(r.defects) || 0;
  });
  let ca = 0, cd = 0;
  const list = Object.keys(byDay).sort().map(k => {
    const x = byDay[k]; ca += x.a; cd += x.d;
    return { date: k, a: x.a, d: x.d, ppm: x.a > 0 ? x.d / x.a * 1e6 : 0, cppm: ca > 0 ? cd / ca * 1e6 : 0 };
  });
  const ppm = ca > 0 ? cd / ca * 1e6 : 0, allow = target * ca / 1e6, margin = allow - cd;
  const ok = ca > 0 && ppm <= target;
  $('ppmBox').className = 'result' + (ca > 0 ? (ok ? ' good' : ' bad') : '');
  $('ppmNow').textContent = ca > 0 ? fmt(ppm, 0) + ' PPM' : '—';
  $('ppmStatus').textContent = ca === 0 ? 'Chưa có dữ liệu trong tháng này'
    : ok ? `✅ ĐẠT target ${fmt(target, 0)} PPM` : `❌ VƯỢT target ${fmt(target, 0)} PPM (+${fmt(ppm - target, 0)})`;
  $('ppmOut').textContent = fmt(ca, 0) + ' bộ';
  $('ppmDef').textContent = fmt(cd, 0);
  $('ppmAllow').textContent = fmt(Math.floor(allow * 100) / 100, 2);
  $('ppmMargin').textContent = ca > 0 ? (margin >= 0 ? '+' : '') + fmt(margin, 2) : '—';
  $('ppmMargin').style.color = ca > 0 ? (margin >= 0 ? '#4fe0b0' : '#ff8f96') : '';
  if (!list.length) {
    $('ppmChart').innerHTML = '<div class="empty">Chưa có dữ liệu</div>';
    $('ppmBody').innerHTML = '<tr><td colspan="5" class="empty">Chưa có dữ liệu</td></tr>';
    return;
  }
  const sc = Math.max(1, target * 1.15, ...list.map(x => x.cppm));
  $('ppmChart').innerHTML = `<div class="plotin"><div class="thrline"><i style="bottom:${target / sc * 72}%"></i><span style="bottom:${target / sc * 72}%;top:auto;margin-bottom:2px">Target ${fmt(target, 0)}</span></div>` +
    list.map(x => { const c = x.cppm <= target ? 'ok' : 'bad';
      return `<div class="cw sm"><div class="cb"><div class="val ${c}"><b>${fmt(x.cppm, 0)}</b></div><div class="bar ${c}" style="height:${x.cppm / sc * 72}%"></div></div><div class="lbl"><b>${esc(x.date.slice(8))}</b></div></div>`; }).join('') + '</div>';
  $('ppmBody').innerHTML = list.slice().reverse().map(x => `<tr><td>${esc(x.date.split('-').reverse().join('/'))}</td><td>${fmt(x.a, 0)}</td><td style="color:var(--red)">${fmt(x.d, 0)}</td><td>${fmt(x.ppm, 0)}</td><td class="${x.cppm <= target ? 'ok' : 'bad'}">${fmt(x.cppm, 0)}</td></tr>`).join('');
}

function renderDashboard() {
  renderPPM();
  renderPareto();
  const fDate = $('filterDate').value, fLine = $('filterLine').value;
  const filtered = reports.filter(r => (!fDate || r.date === fDate) && (!fLine || r.line === fLine))
    .sort((a, b) => b.date.localeCompare(a.date));
  let tp = 0, ta = 0, td = 0; const lead = {};
  filtered.forEach(r => {
    const p = Number(r.plan) || 0, a = Number(r.actual) || 0, d = Number(r.defects) || 0;
    tp += p; ta += a; td += d;
    const s = lead[r.user] || (lead[r.user] = { p: 0, a: 0, d: 0 });
    s.p += p; s.a += a; s.d += d;
  });
  $('dashPlan').textContent = fmt(tp, 0) + ' bộ';
  $('dashActual').textContent = fmt(ta, 0) + ' bộ';
  $('dashRate').textContent = fmt(tp > 0 ? ta / tp * 100 : 0, 1) + '%';
  $('dashDefects').textContent = fmt(td, 0);

  const names = Object.keys(lead);
  const thr = Math.max(0, num($('passThr').value));
  const dayTxt = fDate ? fDate.split('-').reverse().join('/') : 'tất cả các ngày';
  document.querySelectorAll('.cd').forEach(e => { e.textContent = dayTxt; });
  const lbl = n => {
    const ls = [...new Set(filtered.filter(r => r.user === n).map(r => r.line))].join('/');
    return `<div class="lbl"><b title="${esc(n)}">${esc(n)}</b><small>${esc(ls)}</small></div>`;
  };
  if (!names.length) {
    $('perfChart').innerHTML = $('defChart').innerHTML = '<div class="empty">Chưa có dữ liệu báo cáo</div>';
  } else {
    const rates = names.map(n => lead[n].p > 0 ? lead[n].a / lead[n].p * 100 : 0);
    const sc = Math.max(120, ...rates, thr * 1.1);
    $('perfChart').innerHTML = `<div class="plotin"><div class="thrline"><i style="bottom:${thr / sc * 72}%"></i><span style="bottom:${thr / sc * 72}%;top:auto;margin-bottom:2px">Mục tiêu ${fmt(thr, 0)}%</span></div>` +
      names.map((n, i) => {
        const s = lead[n], ok = rates[i] >= thr, c = ok ? 'ok' : 'bad';
        return `<div class="cw"><div class="cb"><div class="val ${c}"><b>${fmt(rates[i], 1)}%</b><small>${fmt(s.a, 0)}/${fmt(s.p, 0)} bộ</small></div><div class="bar ${c}" style="height:${rates[i] / sc * 72}%"></div></div>${lbl(n)}</div>`;
      }).join('') + '</div>';
    const dmax = Math.max(1, ...names.map(n => lead[n].d));
    $('defChart').innerHTML = '<div class="plotin">' + names.map(n => {
      const s = lead[n], c = s.d === 0 ? 'ok' : 'bad', dr = s.a > 0 ? s.d / s.a * 100 : 0;
      return `<div class="cw"><div class="cb"><div class="val ${c}"><b>${fmt(s.d, 0)} lỗi</b><small>${fmt(dr, 1)}% sản lượng</small></div><div class="bar ${c}" style="height:${s.d / dmax * 72}%"></div></div>${lbl(n)}</div>`;
    }).join('') + '</div>';
  }

  $('reportTableBody').innerHTML = filtered.length ? filtered.map(r => `<tr>
    <td>${esc(r.date)}</td><td>${esc(r.shift)}</td><td><b>${esc(r.line)}</b></td><td>${esc(r.fpnr || "—")}</td><td>${esc(r.user)}</td>
    <td>${esc(r.plan)}</td><td>${esc(r.actual)}</td><td style="color:var(--red)">${esc(r.defects)}</td>
    <td><button class="btn-del" type="button" data-del-report="${esc(r.id)}">Xóa</button></td></tr>`).join('')
    : '<tr><td colspan="9" class="empty">Chưa có báo cáo phù hợp</td></tr>';
  renderTrack();
}

$('reportTableBody').addEventListener('click', e => {
  if (!can('del')) return;
  const id = e.target.dataset.delReport;
  if (!id || !confirm('Bạn có chắc muốn xóa báo cáo này không?')) return;
  reports = reports.filter(r => r.id !== id);
  queue({ op: 'delete', id });
  store.set('pm_prod_reports', reports);
  renderDashboard();
  fillFpnr();
});

function flash(el, text, err) {
  el.textContent = text; el.classList.toggle('err', !!err);
  clearTimeout(el._t); el._t = setTimeout(() => { el.textContent = ''; }, 3500);
}

$('btnSaveReport').addEventListener('click', () => {
  const date = $('repDate').value, plan = num($('repPlan').value), actual = num($('repActual').value), p = data[Number($('repFpnr').value)];
  if (!date) return flash($('repMsg'), '❌ Vui lòng chọn ngày báo cáo!', true);
  if (!p) return flash($('repMsg'), '❌ Vui lòng chọn bộ dây FPNR!', true);
  if (plan < 0 || actual < 0) return flash($('repMsg'), '❌ Số liệu không được âm!', true);
  const user = $('repUser').value || (session ? session.user : 'Admin'), shiftV = $('repShift').value;
  const dup = reports.find(r => r.date === date && r.shift === shiftV && r.fpnr === p.fpnr && r.user === user);
  if (dup && !confirm(`⚠️ ${p.fpnr} đã được nhập cho ${shiftV} ngày ${date.split('-').reverse().join('/')} (Thực tế ${dup.actual} bộ).\nVẫn lưu thêm một báo cáo nữa?`)) return;
  const usl = p.line === 'USL', people = Math.floor(num($('lnPeople').value)), lnMins = num($('lnMin').value);
  if (usl && (people < 1 || lnMins <= 0)) return flash($('repMsg'), '❌ Nhập số người trên chuyền ≥ 1 và phút làm việc > 0', true);
  const defects = pendDef.reduce((a, x) => a + x.qty, 0);
  const rec = { id: uid(), date, shift: shiftV, line: p.line, fpnr: p.fpnr, name: p.name, user, plan, actual, std: curStd(p), basis: $('repBasis').value, stdAsm: p.asm, stdPst: p.pst, defects, defectList: pendDef.map(x => ({ ...x })),
    ops: usl ? [] : pendOp.map(o => ({ ...o })), people: usl ? people : 0, mins: usl ? lnMins : 0 };
  reports.push(rec);
  const savedLocally = store.set('pm_prod_reports', reports);
  queue({ op: 'upsert', report: payload(rec) });
  pendDef = []; pendOp = []; renderDefList(); renderOpList();
  flash($('repMsg'), savedLocally
    ? '✅ Đã lưu báo cáo trên thiết bị; đang chờ/đã đồng bộ theo trạng thái mạng.'
    : '⚠️ Báo cáo đang có trong phiên hiện tại nhưng thiết bị không ghi được bộ nhớ. Hãy xuất CSV hoặc khắc phục dung lượng/quyền lưu trữ ngay.', !savedLocally);
  fillFpnr();
  $('filterDate').value = date; $('parDate').value = date;
  renderDashboard();
});
$('repLine').addEventListener('change', fillFpnr);
$('repDate').addEventListener('change', fillFpnr);
$('repShift').addEventListener('change', fillFpnr);
$('empShift').addEventListener('change', () => { store.set('pm_emp_shift', $('empShift').value); fillEmpSelect(); });
$('repFpnr').addEventListener('change', fpnrInfo);
$('repBasis').value = store.get('pm_rep_basis', 'asm');
$('repBasis').addEventListener('change', () => { store.set('pm_rep_basis', $('repBasis').value); fpnrInfo(); });
['lnPeople', 'lnMin', 'repActual', 'repPlan', 'opQty', 'opMin'].forEach(id => $(id).addEventListener('input', calcLine));
$('btnAddDef').addEventListener('click', () => {
  const code = $('defCode').value, qty = Math.floor(num($('defQty').value)), emp = $('defEmp').value;
  if (!code || qty < 1) return flash($('repMsg'), '❌ Chọn mã lỗi và nhập số lượng ≥ 1', true);
  if (!emp) return flash($('repMsg'), '❌ Vui lòng chọn nhân viên gây lỗi (hoặc "Không xác định")', true);
  const empName = emp === '?' ? 'Không xác định' : (employees.find(e => e.id === emp) || {}).name || '';
  const ex = pendDef.find(x => x.code === code && x.emp === emp);
  if (ex) ex.qty += qty; else pendDef.push({ code, qty, emp, empName });
  $('defQty').value = 1; renderDefList();
});
$('defList').addEventListener('click', e => { const c = e.target.dataset.rm; if (c) { pendDef = pendDef.filter(x => `${x.code}|${x.emp}` !== c); renderDefList(); } });
$('empFilter').addEventListener('input', fillEmpSelect);
$('opFilter').addEventListener('input', fillEmpSelect);
$('btnAddOp').addEventListener('click', () => {
  const emp = $('opEmp').value, qty = Math.floor(num($('opQty').value)), mins = num($('opMin').value);
  if (!emp) return flash($('repMsg'), '❌ Chọn nhân viên chạy bộ dây', true);
  if (qty < 1 || mins <= 0) return flash($('repMsg'), '❌ Nhập sản lượng ≥ 1 và phút làm việc > 0', true);
  const empName = (employees.find(e => e.id === emp) || {}).name || '', ex = pendOp.find(o => o.emp === emp);
  if (ex) { ex.qty += qty; ex.mins += mins; } else pendOp.push({ emp, empName, qty, mins });
  $('repActual').value = pendOp.reduce((a, o) => a + o.qty, 0);
  $('opQty').value = 1; renderOpList();
});
$('opList').addEventListener('click', e => { const c = e.target.dataset.rm; if (c) { pendOp = pendOp.filter(o => o.emp !== c); if (pendOp.length) $('repActual').value = pendOp.reduce((a, o) => a + o.qty, 0); renderOpList(); } });
$('btnPushSave').addEventListener('click', () => { store.set('pm_push_url', $('pushUrl').value.trim()); store.set('pm_push_token', $('pushToken').value.trim()); updatePushInfo(); flushOutbox(true); });
$('btnPushAll').addEventListener('click', () => {
  if (!store.get('pm_push_url', '')) return flash($('pushMsg'), '❌ Chưa nhập link Web App', true);
  const pending = new Set(outbox.map(o => o.report?.id || o.id).filter(Boolean));
  let added = 0;
  reports.forEach(r => {
    if (!r.id || pending.has(r.id)) return;
    outbox.push({ op: 'upsert', report: payload(r) });
    pending.add(r.id); added++;
  });
  saveOut(); updatePushInfo(); renderTrack();
  if (!added) flash($('pushMsg'), 'Không có báo cáo mới cần thêm vào hàng đợi.');
  flushOutbox(true);
});
$('btnEmpSave').addEventListener('click', () => { store.set('pm_emp_url', $('empUrl').value.trim()); syncEmp(true); });
$('btnExport').addEventListener('click', () => {
  if (!can('export')) return;
  const fDate = $('filterDate').value, fLine = $('filterLine').value;
  const list = reports.filter(r => (!fDate || r.date === fDate) && (!fLine || r.line === fLine)).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) return alert('Không có dữ liệu để xuất theo bộ lọc hiện tại.');
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`, rows = [];
  list.forEach(r => {
    const base = [r.date, r.shift, r.line, r.fpnr || '', r.name || '', r.user, r.plan, r.actual];
    const dl = Array.isArray(r.defectList) && r.defectList.length ? r.defectList : ((Number(r.defects) || 0) > 0 ? [{ code: 'N/A', qty: r.defects, emp: '—' }] : [{}]);
    dl.forEach(x => rows.push([...base, x.emp || '', x.emp ? empNameOf(x.emp, x.empName) : '', x.code || '', x.code ? defName(x.code) : '', x.qty ?? '']));
  });
  const head = ['Ngày', 'Ca', 'Line', 'FPNR', 'Tên bộ dây', 'Team Lead', 'Kế hoạch', 'Thực tế', 'ID nhân viên', 'Họ tên', 'Mã lỗi', 'Mô tả lỗi', 'Số lượng lỗi'];
  const blob = new Blob(['\ufeff' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bao-cao-loi_${localToday()}.csv`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
});
$('parScope').addEventListener('change', renderPareto);
$('parDate').addEventListener('change', renderPareto);
$('parPrev').addEventListener('click', () => parShift(-1));
$('parNext').addEventListener('click', () => parShift(1));
$('btnDefSave').addEventListener('click', () => { store.set('pm_defect_url', $('defUrl').value.trim()); fillDefSelect(); syncDefects(true); if (!$('defUrl').value.trim()) flash($('defMsg'), 'Đã xóa link, dùng danh sách mẫu'); });
$('filterDate').addEventListener('change', renderDashboard);
$('filterLine').addEventListener('change', renderDashboard);

/* ---------- Đơn hàng (kết nối sẵn link CSV Google Sheets) ---------- */
let orders = store.get('pm_orders_cache', []);
let ordMiss = store.get('pm_orders_miss', []);
let ordHead = store.get('pm_orders_head', []);
const numL = v => {
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};
function isoDate(v) {
  v = String(v ?? '').trim(); if (!v) return '';
  let m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})$/);
  if (m) return `${new Date().getFullYear()}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = v.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  if (/^\d{5}(\.\d+)?$/.test(v)) return new Date(Math.round((Number(v) - 25569) * 864e5)).toISOString().slice(0, 10);
  return '';
}
const fmtD = d => d ? d.split('-').reverse().join('/') : '—';
function parseOrders(text) {
  const first = text.split('\n').find(l => /FPNR/i.test(l)) || '';
  if (first.includes('\t') && !first.includes(',')) text = text.split('\n').map(l => l.split('\t').map(x => '"' + x.replace(/\r/g, '').replace(/"/g, '""') + '"').join(',')).join('\n');
  const all = csvRows(text), h = all.findIndex(r => r.some(x => /FPNR/i.test(x)));
  if (h < 0) return [];
  const head = all[h].map(x => norm(x.trim()).toUpperCase().replace(/\s+/g, ' ')), col = re => head.findIndex(x => re.test(x));
  const c = {
    g: col(/^GROUP$/), car: col(/CARLINE/), ser: col(/SERIES/), bg: col(/BUILD/), fp: col(/FPNR/), d: col(/DESC/),
    rel: col(/RELEASE/), due: col(/FINISH|EXPECT|DUE/), line: col(/^LINE$|KHU VUC|AREA/),
    plan: col(/PLANNED|PLAN/), mont: col(/MONT/), pr: col(/PRUE?F|FRUE?F|PRUFEN|TEST|KIEM/),
    mins: col(/OPEN.*MIN|MINS?$|MINUTE|PHUT/), wires: col(/WIRE|SOI|DAY|CIRCUIT/), prep: col(/PREP|CHUAN|READY/)
  };
  ordMiss = []; ordHead = head.filter(Boolean);
  if (c.mont < 0) ordMiss.push('Open Qty MONT');
  if (c.pr < 0) ordMiss.push('Open Qty PRUEF');
  if (c.mins < 0) ordMiss.push('Open Mins');
  const out = [];
  all.slice(h + 1).forEach(r => {
    const g = i => i >= 0 ? (r[i] || '').trim() : '', n = i => i >= 0 ? numL(g(i)) : null, fp = g(c.fp);
    if (!fp) return;
    const pv = g(c.prep);
    out.push({
      group: g(c.g), line: g(c.line).toUpperCase(), car: g(c.car), ser: g(c.ser), bg: g(c.bg), fp, d: g(c.d),
      rel: isoDate(g(c.rel)), due: isoDate(g(c.due)),
      plan: numL(g(c.plan)), mont: n(c.mont), pr: n(c.pr), mins: n(c.mins), wires: n(c.wires),
      prep: c.prep >= 0 ? (pv !== '' && !/^(0|no|n|false|không|khong|chưa|chua)$/i.test(pv)) : null
    });
  });
  return out;
}
const ordPrepared = o => o.prep !== null && o.prep !== undefined ? o.prep : !!o.rel;
function ordSt(o) {
  const done = o.pr != null ? o.pr <= 0 : (o.mont != null && o.mont <= 0);
  if (o.plan > 0 && done) return ['Hoàn thành', 'ok', 'done'];
  if (o.due && o.due < localToday()) return ['Quá hạn', 'er', 'late'];
  if (!ordPrepared(o)) return ['Chờ chuẩn bị', 'wn', 'prep0'];
  return ['Đang sản xuất', 'ok', 'run'];
}
function fillOrdGroup() {
  const sel = $('ordGroup'), cur = sel.value, gs = [...new Set(orders.map(o => o.group).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Tất cả Group</option>' + gs.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  if (gs.includes(cur)) sel.value = cur;
}
function updateOrdInfo() {
  const t = store.get('pm_orders_time', ''), d = t ? new Date(t) : null;
  const when = d ? d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '';
  $('ordUpdated').textContent = orders.length ? `cập nhật ${when}` : 'đang chờ dữ liệu';
  $('ordInfo').textContent = orders.length ? `Đang có ${orders.length} đơn hàng · cập nhật ${when}` : 'Chưa có dữ liệu đơn hàng';
}
let ordWeek = '';
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7)); const y = t.getUTCFullYear(); return { y, w: Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7) }; }
const wkOf = iso => { if (!iso) return null; const [y, m, d] = iso.split('-').map(Number); return isoWeek(new Date(y, m - 1, d)); };
const wkKey = iso => { const w = wkOf(iso); return w ? w.y * 100 + w.w : 0; };
function weekInfo() {
  const n = new Date(), w = isoWeek(n), mon = new Date(n.getFullYear(), n.getMonth(), n.getDate() - (n.getDay() + 6) % 7), sun = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + 6);
  const s = d => String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
  return { ...w, key: w.y * 100 + w.w, range: `${s(mon)} – ${s(sun)}/${sun.getFullYear()}` };
}
function updateWeek() { const w = weekInfo(); $('wkBadge').textContent = 'Tuần ' + w.w; $('wkNow').textContent = 'KW ' + w.w; $('wkRange').textContent = `${w.range} · năm ${w.y}`; }
const ordLine = o => ((data.find(r => r.fpnr === o.fp) || {}).line || o.line || '').toUpperCase();
function fillOrdView() {
  const sel = $('ordView'), cur = sel.value, users = [...new Set([...accounts.map(a => a.user), ...reports.map(r => r.user)])].filter(u => u && u !== 'Admin');
  sel.innerHTML = '<option value="">Tất cả khu vực (EAP + USL)</option><option value="EAP">Khu vực EAP</option><option value="USL">Khu vực USL</option>' +
    (users.length ? '<optgroup label="Theo Team Lead quản lý">' + users.map(u => { const ls = [...new Set(reports.filter(r => r.user === u).map(r => r.line))].join('/'); return `<option value="tl:${esc(u)}">${esc(u)}${ls ? ' (' + esc(ls) + ')' : ''}</option>`; }).join('') + '</optgroup>' : '');
  if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
}
function viewLines() {
  const v = $('ordView').value;
  if (!v) return null;
  if (v.startsWith('tl:')) return [...new Set(reports.filter(r => r.user === v.slice(3)).map(r => r.line))];
  return [v];
}
function ordTable(title, list) {
  if (!list.length) return '';
  const sum = k => list.reduce((a, o) => a + (o[k] || 0), 0);
  const sumN = k => list.some(o => o[k] != null) ? sum(k) : null;
  const fv = (x, d = 0) => x == null ? '—' : fmt(x, d);
  const body = list.slice(0, 300).map(o => {
    const st = ordSt(o), w = wkOf(o.due);
    return `<tbody${st[2] === 'late' ? ' class="late"' : ''}><tr><td rowspan="2">${esc(o.group)}</td><td rowspan="2">${esc(o.ser)}</td><td rowspan="2" class="fp"><b>${esc(o.fp)}</b>${o.d ? `<small>${esc(o.d)}</small>` : ''}<small>Hạn: ${w ? 'KW ' + w.w + ' · ' + fmtD(o.due).slice(0, 5) : '—'}</small><span class="pill ${st[1]}" style="margin-top:4px">${st[0]}</span></td><td class="op${o.mont === 0 ? ' z' : ''}">${fv(o.mont)}</td><td class="op${o.pr === 0 ? ' z' : ''}">${fv(o.pr)}</td><td rowspan="2" class="mn">${fv(o.mins, 2)}</td></tr><tr><td class="pl">${fmt(o.plan, 0)}</td><td class="pl">${fmt(o.plan, 0)}</td></tr></tbody>`;
  }).join('');
  return `<div class="area-h"><b>${esc(title)}</b><span>${list.length} đơn · MONT còn ${fv(sumN('mont'))} · PRUEF còn ${fv(sumN('pr'))} · ${fv(sumN('mins'), 1)} phút</span></div><div class="table-wrap"><table class="ot"><thead><tr><th>Group</th><th>Series</th><th>FPNR</th><th>MONT</th><th>PRUEF</th><th>Open Min</th></tr></thead>${body}<tfoot><tr><td colspan="3">Tổng</td><td>${fv(sumN('mont'))}</td><td>${fv(sumN('pr'))}</td><td>${fv(sumN('mins'), 1)}</td></tr></tfoot></table></div>` + (list.length > 300 ? '<div class="hint">Hiển thị 300 đơn đầu, hãy dùng bộ lọc.</div>' : '');
}
function renderOrders() {
  updateWeek();
  const q = norm($('ordSearch').value.trim()), fg = $('ordGroup').value, f = $('ordFilter').value, vl = viewLines(), wn = weekInfo();
  const base = orders.filter(o => (!vl || vl.includes(ordLine(o))) && (!fg || o.group === fg) && (!q || norm(`${o.fp} ${o.d} ${o.ser} ${o.bg}`).includes(q)) && (!f || ordSt(o)[2] === f));
  const cnt = {};
  base.forEach(o => { const k = wkKey(o.due); (cnt[k] = cnt[k] || { n: 0, w: wkOf(o.due) }).n++; });
  if (ordWeek !== '' && !cnt[ordWeek]) ordWeek = '';
  const keys = Object.keys(cnt).map(Number).sort((a, b) => (a || 9e9) - (b || 9e9));
  $('wkChips').innerHTML = `<button class="wkc${ordWeek === '' ? ' on' : ''}" data-wk="" type="button"><b>Tất cả</b>${base.length} đơn</button>` +
    keys.map(k => `<button class="wkc${String(k) === ordWeek ? ' on' : ''}${k === wn.key ? ' now' : ''}${k && k < wn.key ? ' late' : ''}" data-wk="${k}" type="button"><b>${k ? 'KW ' + cnt[k].w.w : 'Chưa có hạn'}</b>${cnt[k].n} đơn</button>`).join('');
  const list = (ordWeek === '' ? base : base.filter(o => String(wkKey(o.due)) === ordWeek))
    .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || String(a.group).localeCompare(String(b.group), undefined, { numeric: true }));
  const sum = k => list.reduce((a, o) => a + (o[k] || 0), 0);
  const sumN = k => list.some(o => o[k] != null) ? sum(k) : null;
  const fv = (x, d = 0, u = '') => x == null ? '—' : fmt(x, d) + u;
  $('ordCount').textContent = fmt(list.length, 0);
  $('ordPlanT').textContent = fmt(sum('plan'), 0) + ' bộ';
  $('ordMontT').textContent = fv(sumN('mont'), 0, ' bộ');
  $('ordPrT').textContent = fv(sumN('pr'), 0, ' bộ');
  $('ordMinsT').textContent = fv(sumN('mins'), 1);
  $('ordWiresT').textContent = fv(sumN('wires'), 0);
  $('ordPrepT').textContent = fmt(list.filter(o => !ordPrepared(o)).length, 0);
  $('ordLateT').textContent = fmt(list.filter(o => ordSt(o)[2] === 'late').length, 0);
  $('ordWarn').style.whiteSpace = 'normal'; $('ordWarn').style.overflowWrap = 'anywhere';
  $('ordWarn').textContent = ordMiss.length
    ? '⚠️ File đơn hàng không có cột: ' + ordMiss.join(', ') + '. Dữ liệu các cột này hiển thị "—" (không phải 0). Các cột app đọc được: ' + ordHead.join(' | ') : '';
  const areas = vl || ['EAP', 'USL'];
  let html = areas.map(a => ordTable(a, list.filter(o => ordLine(o) === a))).join('');
  if (!vl) html += ordTable('Chưa xác định line', list.filter(o => !['EAP', 'USL'].includes(ordLine(o))));
  $('ordTables').innerHTML = html || `<div class="card empty">${vl && !vl.length ? 'Team Lead này chưa có báo cáo nên chưa xác định được khu vực.' : 'Đang đồng bộ dữ liệu đơn hàng từ Google Sheets…'}</div>`;
}
function applyOrders(rows) {
  orders = rows; store.set('pm_orders_cache', rows); store.set('pm_orders_miss', ordMiss); store.set('pm_orders_head', ordHead); store.set('pm_orders_time', new Date().toISOString());
  fillOrdGroup(); renderOrders(); updateOrdInfo();
}
async function syncOrders(show) {
  const url = store.get('pm_orders_url', DEFAULT_ORDERS_URL) || DEFAULT_ORDERS_URL;
  if (!url) { if (show) flash($('ordSetMsg'), '❌ Chưa nhập link CSV đơn hàng', true); return; }
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseOrders(await res.text());
    if (!rows.length) throw new Error('Dữ liệu trống hoặc sai cột FPNR');
    applyOrders(rows);
    if (show) flash($('ordSetMsg'), `✅ Đã đồng bộ ${rows.length} đơn hàng` + (ordMiss.length ? ` · ⚠️ thiếu cột: ${ordMiss.join(', ')}` : ''), !!ordMiss.length);
  } catch (err) {
    if (!orders.length) $('ordUpdated').textContent = 'lỗi kết nối Google Sheets';
    if (show) flash($('ordSetMsg'), '❌ Không tải được file đơn hàng: ' + (err.message || 'Kiểm tra link CSV đã xuất bản'), true);
  }
  finally { clearTimeout(t); }
}
['ordSearch', 'ordView', 'ordGroup', 'ordFilter'].forEach(id => $(id).addEventListener('input', renderOrders));
$('wkChips').addEventListener('click', e => { const b = e.target.closest('[data-wk]'); if (!b) return; ordWeek = b.dataset.wk; renderOrders(); });
$('btnOrdSave').addEventListener('click', () => {
  const val = $('ordUrl').value.trim() || DEFAULT_ORDERS_URL;
  $('ordUrl').value = val;
  store.set('pm_orders_url', val);
  syncOrders(true);
});
$('btnOrdLoad').addEventListener('click', async () => {
  const f = $('ordFile').files[0];
  const text = f ? await f.text() : $('ordPaste').value;
  if (!text.trim()) return flash($('ordSetMsg'), '❌ Hãy chọn file CSV hoặc dán dữ liệu', true);
  const rows = parseOrders(text);
  if (!rows.length) return flash($('ordSetMsg'), '❌ Không đọc được dữ liệu. Dòng tiêu đề cần có cột FPNR.', true);
  if (orders.length && !confirm(`Ghi đè ${orders.length} đơn hiện có bằng ${rows.length} đơn mới?`)) return;
  applyOrders(rows); $('ordFile').value = ''; $('ordPaste').value = '';
  flash($('ordSetMsg'), `✅ Đã nạp ${rows.length} đơn hàng` + (ordMiss.length ? ` · ⚠️ thiếu cột: ${ordMiss.join(', ')}` : ''), !!ordMiss.length);
});

/* ---------- Bộ dây trên xe ---------- */
const HR = [
[1,"01_Adapter MAL_BM4O050","Bộ dây chuyển đổi ổ cắm / Cổng kết nối đa năng","Khu vực bảng điều khiển trung tâm hoặc hộc đựng đồ."],
[2,"02_Adapter Airbag_BM4O055","Bộ dây chuyển đổi Túi khí","Kết nối cụm túi khí với hộp điều khiển (vô-lăng, táp-lô, cột A/B, ghế)."],
[3,"03_ADAPTER_LIGHT_CARPET_RIGHT_BM4O060","Bộ dây chuyển đổi Đèn thảm chào mừng bên phải","Gầm xe / Lót sàn phía bên phải."],
[4,"04_Adapter_PHUD_BM4O070","Bộ dây chuyển đổi Màn hình hiển thị kính lái","Phía trên bảng táp-lô."],
[5,"05_Adapter_SOLARSENSOR_BM4O090","Bộ dây chuyển đổi Cảm biến ánh sáng mặt trời","Phía trên mặt táp-lô sát kính gió trước."],
[6,"06_Adapter_AUDIO_BM4O110","Bộ dây chuyển đổi Hệ thống âm thanh","Kết nối amply, loa hoặc đầu đĩa/màn hình giải trí."],
[7,"07_Adapter_TOPPERPAD_BM4O080","Bộ dây chuyển đổi Đệm đầu / Táp-lô trên","Cụm táp-lô phía trên hoặc khu vực bảng điều khiển trung tâm."],
[8,"08_Front_Bumper_BM4O120","Bộ dây Cản trước","Phía trong cản trước."],
[9,"09_Rear_Bumper_BM4O130","Bộ dây Cản sau","Phía trong cản sau."],
[10,"10_SEAT_VR_BM4O340","Bộ dây Ghế trước bên phải","Phía dưới gầm ghế phụ (bên phải)."],
[11,"11_Adapter_PHUD_RL_BM4O290","Bộ dây chuyển đổi Màn hình kính lái (Tay lái nghịch)","Táp-lô phía trên bên trái."],
[12,"12_ROOF_AUDIO_BM4O160","Bộ dây Loa trần xe","Trên trần xe."],
[13,"13_Rear_Seat_BM4O020","Bộ dây Ghế sau","Dưới hàng ghế sau."],
[14,"14_SEAT_VL_BM4O030","Bộ dây Ghế trước bên trái","Phía dưới gầm ghế tài."],
[15,"15_SEAT_VR_BM4O040","Bộ dây Ghế trước bên phải","Phía dưới gầm ghế phụ."],
[16,"16_MIKO_BM4O140","Bộ dây Bệ trung tâm (Mittelkonsole)","Khu vực bệ cần số, thắng tay điện tử."],
[17,"17_Rear_Passenger_Door_BM4O190","Bộ dây Cửa sau bên phụ","Bên trong cánh cửa sau bên phụ."],
[18,"18_Rear_Driver_Door_BM4O180","Bộ dây Cửa sau bên tài","Bên trong cánh cửa sau bên tài."],
[19,"19_COCKPIT_RL_BM4O300","Bộ dây Khoang lái / Táp-lô (Tay lái nghịch)","Toàn bộ cụm táp-lô khoang lái (xe tay lái nghịch)."],
[20,"20_COCKPIT_BM4O230","Bộ dây Khoang lái / Bảng táp-lô chính","Toàn bộ cụm bảng điều khiển trung tâm & táp-lô."],
[21,"21_Driver_Door_BM4O250","Bộ dây Cửa tài","Phía trong cánh cửa tài."],
[22,"22_Passenger_Door_BM4O260","Bộ dây Cửa phụ","Phía trong cánh cửa phụ."],
[23,"23_Frontend_BM4O240","Bộ dây Đầu xe / Khoang động cơ trước","Phía trước khoang máy."],
[24,"24_Adapter_Topperpad_RL_BM4O295","Bộ dây chuyển đổi Táp-lô trên (Tay lái nghịch)","Phía trên táp-lô khoang lái xe tay lái nghịch."],
[25,"25_PASSENGER_DOOR_RL_BM4O320","Bộ dây Cửa phụ (Tay lái nghịch)","Cánh cửa phụ xe tay lái nghịch."],
[26,"26_DRIVER_DOOR_RL_BM4O310","Bộ dây Cửa tài (Tay lái nghịch)","Cánh cửa tài xe tay lái nghịch."],
[27,"27_SEAT_VR_RL_BM4O280","Bộ dây Ghế trước bên phải (Tay lái nghịch)","Khung ghế trước bên phải (tay lái nghịch)."],
[28,"28_SEAT_VL_RL_BM4O270","Bộ dây Ghế trước bên trái (Tay lái nghịch)","Khung ghế trước bên trái (tay lái nghịch)."],
[29,"29_ROOF_AUDIO_BM4O360","Bộ dây Loa trần xe","Cụm hệ thống âm thanh trên trần xe."]
];
const HZ = [
 { id: 'cockpit', n: 'Táp-lô & khoang lái', c: '#ff9f5a', ids: [20, 19], f: 'Cấp nguồn và truyền tín hiệu cho cụm đồng hồ, màn hình và các công tắc trên táp-lô.' },
 { id: 'hud', n: 'Màn hình kính lái (HUD)', c: '#ff9f5a', ids: [4, 11], f: 'Nối màn hình hiển thị thông tin lên kính lái với hệ thống điều khiển.' },
 { id: 'solar', n: 'Cảm biến ánh sáng mặt trời', c: '#ff9f5a', ids: [5], f: 'Truyền tín hiệu cảm biến ánh sáng mặt trời cho các hệ thống tự động.' },
 { id: 'topper', n: 'Táp-lô trên (Topperpad)', c: '#ff9f5a', ids: [7, 24], f: 'Kết nối cụm trang bị phía trên táp-lô với mạng điện của xe.' },
 { id: 'airbag', n: 'Túi khí', c: '#ef626b', ids: [2], f: 'Kết nối các túi khí với hộp điều khiển để kích hoạt khi va chạm.' },
 { id: 'audio', n: 'Hệ thống âm thanh', c: '#a78bfa', ids: [6], f: 'Kết nối amply, loa và màn hình giải trí.' },
 { id: 'console', n: 'Bệ trung tâm', c: '#ff9f5a', ids: [16, 1], f: 'Cấp điện và tín hiệu cho khu vực cần số, phanh tay điện tử, ổ cắm và cổng kết nối.' },
 { id: 'carpet', n: 'Đèn thảm sàn bên phải', c: '#e0b341', ids: [3], f: 'Cấp điện cho đèn chiếu sáng thảm sàn khi mở cửa.' },
 { id: 'seatL', n: 'Ghế trước bên trái', c: '#5aa2ff', ids: [14, 28], f: 'Cấp điện và tín hiệu cho các chức năng của ghế (nếu trang bị).' },
 { id: 'seatR', n: 'Ghế trước bên phải', c: '#5aa2ff', ids: [10, 15, 27], f: 'Cấp điện và tín hiệu cho các chức năng của ghế (nếu trang bị).' },
 { id: 'seatB', n: 'Ghế sau', c: '#5aa2ff', ids: [13], f: 'Cấp điện và tín hiệu cho hàng ghế sau.' },
 { id: 'doorFL', n: 'Cửa tài', c: '#2fc894', ids: [21, 26], f: 'Nối cửa sổ điện, khóa cửa, gương và công tắc trên cửa với thân xe.' },
 { id: 'doorFR', n: 'Cửa phụ', c: '#2fc894', ids: [22, 25], f: 'Nối cửa sổ điện, khóa cửa, gương và công tắc trên cửa với thân xe.' },
 { id: 'doorRL', n: 'Cửa sau bên tài', c: '#2fc894', ids: [18], f: 'Nối cửa sổ điện, khóa cửa và thiết bị trên cửa sau với thân xe.' },
 { id: 'doorRR', n: 'Cửa sau bên phụ', c: '#2fc894', ids: [17], f: 'Nối cửa sổ điện, khóa cửa và thiết bị trên cửa sau với thân xe.' },
 { id: 'roof', n: 'Loa trần xe', c: '#a78bfa', ids: [12, 29], f: 'Nối các loa trên trần xe với hệ thống âm thanh.' },
 { id: 'bumpF', n: 'Cản trước', c: '#e0b341', ids: [8], f: 'Cấp điện và tín hiệu cho các thiết bị gắn ở cản trước.' },
 { id: 'bumpR', n: 'Cản sau', c: '#e0b341', ids: [9], f: 'Cấp điện và tín hiệu cho các thiết bị gắn ở cản sau.' },
 { id: 'front', n: 'Đầu xe / Khoang máy', c: '#e0b341', ids: [23], f: 'Nối các thiết bị phía đầu xe và khoang máy với thân xe.' }
];
const VW = [
 { id: 'cut', e: '🔍', n: 'Cắt bổ', d: { cockpit: [39, 32], hud: [35, 21], solar: [40, 15], topper: [46, 22], airbag: [37, 40], audio: [44, 29], console: [50, 60], seatL: [42, 52], seatB: [62, 45], doorFL: [53, 36], doorRL: [73, 40], roof: [60, 10], bumpF: [4, 58], front: [12, 42], bumpR: [96, 45] } },
 { id: 'top', e: '🔝', n: 'Trên', d: { bumpF: [5, 50], front: [17, 50], roof: [54, 47], bumpR: [94, 50] } },
 { id: 'left', e: '◀️', n: 'Trái', d: { bumpF: [4, 63], front: [14, 57], doorFL: [39, 60], doorRL: [60, 60], roof: [46, 29], bumpR: [96, 51] } },
 { id: 'right', e: '▶️', n: 'Phải', d: { bumpR: [5, 56], doorRR: [32, 58], doorFR: [54, 58], roof: [44, 30], front: [87, 47], bumpF: [96, 65] } },
 { id: 'front', e: '⬆️', n: 'Trước', d: { solar: [50, 17], hud: [38, 25], front: [50, 45], bumpF: [50, 70] } },
 { id: 'rear', e: '⬇️', n: 'Sau', d: { roof: [49, 13], bumpR: [49, 81] } },
 { id: 'floor', e: '🧱', n: 'Gầm', d: { carpet: [62, 50] } },
 { id: 'cockpit', e: '🎛️', n: 'Cockpit', d: { cockpit: [31, 37], airbag: [22, 56], hud: [52, 17], audio: [56, 35], topper: [75, 25], console: [57, 72] } },
 { id: 'dash', e: '📺', n: 'Taplo', d: { cockpit: [29, 43], airbag: [17, 57], hud: [55, 30], audio: [61, 43], topper: [90, 32], console: [72, 80] } },
 { id: 'seatL', e: '💺', n: 'Ghế L', d: { seatL: [50, 45] } },
 { id: 'seatR', e: '💺', n: 'Ghế R', d: { seatR: [50, 45] } },
 { id: 'seatB', e: '🛋️', n: 'Ghế sau', d: { seatB: [50, 42] } },
 { id: 'doorL', e: '🚪', n: 'Cửa L', d: { doorFL: [50, 55] } },
 { id: 'doorR', e: '🚪', n: 'Cửa R', d: { doorFR: [50, 55] } }
];
(() => {
  let sel = null, hl = null, view = 'cut', edit = false, dd = null;
  const key = 'pm_hz_v3', saved = store.get(key, {});
  const fp = r => (r[1].match(/BM4O\d+/i) || [''])[0].toUpperCase();
  const V = id => VW.find(v => v.id === id);
  const pos = (vid, zid) => (saved[vid] && saved[vid][zid]) || V(vid).d[zid];
  const hv = $('hv'), dz = $('hDots'), img = $('hImg');
  const info = () => {
    const z = HZ.find(x => x.id === sel), box = $('hInfo');
    if (!z) { box.innerHTML = '<div class="hint" style="text-align:center;margin:0">Chạm vào chấm sáng trên xe, hoặc chọn bộ dây ở ô tìm kiếm phía trên, để xem tên, chức năng và vị trí lắp.</div>'; return; }
    box.innerHTML = `<div class="hrow"><b style="color:${z.c};font-size:15px">${esc(z.n)}</b><span class="cdate">${z.ids.length} bộ dây</span></div>
      <div class="hint" style="margin:4px 0 8px"><b>Chức năng:</b> ${esc(z.f)} <i>(tham khảo)</i></div>` +
      z.ids.map(i => { const r = HR[i - 1];
        return `<div class="hcard${r[0] === hl ? ' hl' : ''}"><div class="hrow"><b>${esc(fp(r))} · ${esc(r[2])}</b>${/_RL_/i.test(r[1]) ? '<span class="pill wn">Tay lái nghịch</span>' : ''}</div><div class="hc-o">${esc(r[1])}</div><div class="hint" style="margin:6px 0 0">📍 ${esc(r[3])}</div></div>`; }).join('');
  };
  const dots = () => {
    dz.innerHTML = HZ.filter(z => pos(view, z.id)).map(z => { const [x, y] = pos(view, z.id);
      return `<button type="button" class="hdot${z.id === sel ? ' on' : ''}${x > 72 ? ' r' : ''}" style="left:${x}%;top:${y}%;--c:${z.c}" data-d="${z.id}" data-n="${esc(z.n)}" aria-label="${esc(z.n)}"></button>`; }).join('');
    $('hCap').textContent = '';
  };
  const bar = () => {
    const b = v => `<button type="button" class="${v.id === view ? 'on' : ''}" data-v="${v.id}"><i>${v.e}</i>${v.n}</button>`;
    $('hVA').innerHTML = VW.slice(0, 7).map(b).join(''); $('hVB').innerHTML = VW.slice(7).map(b).join('');
  };
  img.addEventListener('load', () => { hv.style.maxWidth = Math.min(img.naturalWidth * 2.4, 900) + 'px'; });
  img.addEventListener('error', () => { $('hCap').textContent = '⚠️ Không tải được ảnh ' + img.getAttribute('src') + '. Kiểm tra thư mục xe/ đã có đủ ảnh chưa.'; });
  const setView = id => { view = id; img.src = 'xe/' + id + '.webp'; bar(); dots(); };
  const select = id => {
    sel = id;
    if (id && !pos(view, id)) { const v = VW.find(q => q.d[id]); if (v) setView(v.id); }
    dots(); info();
  };
  const pickH = n => { const z = HZ.find(q => q.ids.includes(n)); if (z) { hl = n; select(z.id); } };
  const onView = e => { const b = e.target.closest('[data-v]'); if (b) setView(b.dataset.v); };
  $('hVA').addEventListener('click', onView); $('hVB').addEventListener('click', onView);
  dz.addEventListener('click', e => { const b = e.target.closest('.hdot'); if (b && !edit) { hl = null; $('hSel').value = ''; select(b.dataset.d); } });
  const fillSel = () => {
    const q = norm($('hQ').value.trim()), l = HR.filter(r => !q || norm(r.join(' ')).includes(q)), cur = $('hSel').value;
    $('hSel').innerHTML = '<option value="">— Chọn bộ dây —</option>' + l.map(r => `<option value="${r[0]}">${esc(fp(r))} · ${esc(r[2])}</option>`).join('');
    $('hCnt').textContent = `(${l.length}/${HR.length})`;
    if (q && l.length === 1) { $('hSel').value = String(l[0][0]); pickH(l[0][0]); }
    else if (l.some(r => String(r[0]) === cur)) $('hSel').value = cur;
  };
  $('hQ').addEventListener('input', fillSel);
  $('hSel').addEventListener('change', () => {
    const n = Number($('hSel').value);
    if (n) { pickH(n); $('hInfo').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  });
  $('hEdit').addEventListener('click', () => {
    if (!can('hedit')) return;
    edit = !edit; hv.classList.toggle('edit', edit);
    $('hEdit').classList.toggle('on', edit);
    $('hEdit').textContent = edit ? '✔ Xong chỉnh' : '✏️ Chỉnh chấm';
    $('hReset').style.display = edit ? '' : 'none';
  });
  $('hReset').addEventListener('click', () => {
    if (!can('hedit')) return;
    if (!confirm('Đặt lại vị trí các chấm của góc nhìn này về mặc định?')) return;
    delete saved[view]; store.set(key, saved); dots();
  });
  dz.addEventListener('pointerdown', e => {
    const b = e.target.closest('.hdot'); if (!b || !edit) return;
    dd = b; try { b.setPointerCapture(e.pointerId); } catch {} e.preventDefault();
  });
  dz.addEventListener('pointermove', e => {
    if (!dd) return;
    const r = dz.getBoundingClientRect(), c = v => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
    const x = c((e.clientX - r.left) / r.width * 100), y = c((e.clientY - r.top) / r.height * 100);
    (saved[view] = saved[view] || {})[dd.dataset.d] = [x, y]; dd.style.left = x + '%'; dd.style.top = y + '%';
  });
  const end = () => { if (dd) { dd = null; store.set(key, saved); } };
  dz.addEventListener('pointerup', end); dz.addEventListener('pointercancel', end);
  bar(); fillSel(); dots(); info();
})();

/* ---------- Tài khoản Team Lead & Phân quyền ---------- */
const saveAcc = () => store.set('pm_team_accounts', accounts);
function renderAccounts() {
  const box = $('accountList');
  if (box) box.innerHTML = accounts.length ? accounts.map(a => {
    const p = permsOf(a), n = PERM_LIST.filter(([k]) => p[k]).length;
    return `<div class="hcard"><div class="hrow"><b>${esc(a.user)}</b><span class="pill ${a.blocked ? 'er' : 'ok'}">${a.blocked ? 'Đã chặn' : 'Hoạt động'}</span></div>
      <div class="hint" style="margin:6px 0 0">Được dùng ${n}/${PERM_LIST.length} chức năng</div>
      <div class="accbtns">
        <button class="btn secondary" type="button" data-acc="reset" data-u="${esc(a.user)}">🔑 Cấp lại mật khẩu</button>
        <button class="btn secondary" type="button" data-acc="block" data-u="${esc(a.user)}">${a.blocked ? '✅ Mở chặn' : '⛔ Chặn'}</button>
        <button class="btn-del" type="button" data-acc="del" data-u="${esc(a.user)}">Xóa</button>
      </div>
      <details class="perm" data-u="${esc(a.user)}"${openAcc === a.user ? ' open' : ''}><summary>Phân quyền chức năng</summary>
        ${PERM_LIST.map(([k, t]) => `<label class="chk"><input type="checkbox" data-perm="${k}" data-u="${esc(a.user)}"${p[k] ? ' checked' : ''}>${esc(t)}</label>`).join('')}
      </details></div>`;
  }).join('') : '<div class="empty">Chưa có tài khoản nào</div>';
  updateTeamLeadSelect();
}

$('btnAddAccount').addEventListener('click', async () => {
  const user = $('newUsername').value.trim(), pass = $('newPassword').value;
  if (!user || !pass) return flash($('accMsg'), '❌ Vui lòng nhập đầy đủ tên và mật khẩu!', true);
  if (pass.length < 4) return flash($('accMsg'), '❌ Mật khẩu tối thiểu 4 ký tự!', true);
  if (/^admin$/i.test(user) || accounts.some(a => a.user.toLowerCase() === user.toLowerCase()))
    return flash($('accMsg'), '❌ Tên tài khoản đã tồn tại!', true);
  accounts.push({ user, hash: await sha256(user, pass), perms: { ...DEF_PERMS }, blocked: false });
  saveAcc(); $('newUsername').value = ''; $('newPassword').value = '';
  openAcc = user; renderAccounts();
  flash($('accMsg'), `✅ Đã thêm Team Lead "${user}". Bấm "Phân quyền chức năng" bên dưới để chỉnh quyền.`);
});
$('accountList').addEventListener('click', async e => {
  const b = e.target.closest('[data-acc]'); if (!b || !isAdmin()) return;
  const u = b.dataset.u, a = findAcc(u); if (!a) return;
  if (b.dataset.acc === 'reset') {
    const np = prompt(`Nhập mật khẩu mới cho "${u}".\nĐể trống để hệ thống tự tạo mật khẩu ngẫu nhiên.`);
    if (np === null) return;
    const pw = np.trim() || genPw();
    if (pw.length < 4) return flash($('accMsg'), '❌ Mật khẩu tối thiểu 4 ký tự!', true);
    a.hash = await sha256(a.user, pw); saveAcc();
    alert(`Mật khẩu mới của "${u}":\n\n${pw}\n\nHãy ghi lại và gửi cho Team Lead.`);
  } else if (b.dataset.acc === 'block') {
    a.blocked = !a.blocked; saveAcc(); renderAccounts();
    flash($('accMsg'), a.blocked ? `⛔ Đã chặn "${u}"` : `✅ Đã mở chặn "${u}"`);
  } else if (b.dataset.acc === 'del') {
    if (!confirm(`Xóa tài khoản "${u}"?`)) return;
    accounts = accounts.filter(x => x.user !== u); saveAcc(); renderAccounts();
  }
});
$('accountList').addEventListener('change', e => {
  const k = e.target.dataset.perm; if (!k || !isAdmin()) return;
  const a = findAcc(e.target.dataset.u); if (!a) return;
  a.perms = { ...permsOf(a), [k]: e.target.checked }; saveAcc();
  openAcc = a.user; renderAccounts();
});
$('accountList').addEventListener('toggle', e => {
  const d = e.target; if (!d.matches || !d.matches('details.perm')) return;
  if (d.open) openAcc = d.dataset.u; else if (openAcc === d.dataset.u) openAcc = '';
}, true);
$('btnAdminPw').addEventListener('click', async () => {
  const o = $('oldAdminPw').value, n = $('newAdminPw').value;
  if ((await sha256('Admin', o)) !== adminHash()) return flash($('adminPwMsg'), '❌ Mật khẩu hiện tại không đúng', true);
  if (n.length < 4) return flash($('adminPwMsg'), '❌ Mật khẩu mới tối thiểu 4 ký tự', true);
  store.set('pm_admin_hash', await sha256('Admin', n));
  $('oldAdminPw').value = ''; $('newAdminPw').value = '';
  flash($('adminPwMsg'), '✅ Đã đổi mật khẩu Admin');
});

/* ---------- Đăng nhập / đăng xuất & Hỗ trợ chia sẻ link ---------- */
function renderLogin() {
  const setup = !adminHash();
  $('lgTitle').textContent = setup ? 'Thiết lập mật khẩu Admin' : 'Đăng nhập';
  $('lgHint').textContent = setup
    ? 'Thiết bị mới: tạo mật khẩu quản trị (Admin) để bắt đầu, hoặc dùng link chia sẻ từ Admin để tự đồng bộ tài khoản Team Lead.'
    : 'Đăng nhập bằng tài khoản Admin hoặc Team Lead.';
  $('lgUserF').style.display = setup ? 'none' : '';
  $('lgPass2F').style.display = setup ? '' : 'none';
  $('btnLogin').textContent = setup ? 'Tạo mật khẩu & vào app' : 'Đăng nhập';
  $('lgPass').autocomplete = setup ? 'new-password' : 'current-password';
  $('lgMsg').textContent = '';
}
function applyAccess() {
  document.body.classList.toggle('locked', !session);
  ['del', 'export', 'hedit'].forEach(k => document.body.classList.toggle('no-' + k, !can(k)));
  document.querySelectorAll('.nav button').forEach(b => { b.style.display = canPage(b.dataset.page) ? '' : 'none'; });
  if (session) {
    $('ubName').textContent = session.user;
    $('ubRole').textContent = isAdmin() ? 'Quản trị viên' : 'Team Lead';
    const act = document.querySelector('.page.active');
    if (!(act && act.id !== 'noperm' && canPage(act.id))) showPage(firstPage() || 'noperm');
  }
  updateTeamLeadSelect();
}
function finishLogin() {
  store.set('pm_session', session);
  ['lgUser', 'lgPass', 'lgPass2'].forEach(id => { $(id).value = ''; });
  $('lgMsg').textContent = '';
  applyAccess(); renderAccounts(); fillOrdView();
  showPage(firstPage() || 'noperm'); renderDashboard();
}
const lgErr = t => { $('lgMsg').textContent = '❌ ' + t; };
$('btnLogin').addEventListener('click', async () => {
  $('lgMsg').textContent = '';
  if (!adminHash()) {
    const p = $('lgPass').value;
    if (p.length < 4) return lgErr('Mật khẩu tối thiểu 4 ký tự');
    if (p !== $('lgPass2').value) return lgErr('Hai mật khẩu không khớp');
    store.set('pm_admin_hash', await sha256('Admin', p));
    session = { user: 'Admin', role: 'admin' }; return finishLogin();
  }
  const u = $('lgUser').value.trim(), p = $('lgPass').value;
  if (!u || !p) return lgErr('Nhập tên tài khoản và mật khẩu');
  if (/^admin$/i.test(u)) {
    const h = await sha256('Admin', p);
    if (h !== adminHash()) { await new Promise(r => setTimeout(r, 400)); return lgErr('Sai tên tài khoản hoặc mật khẩu'); }
    session = { user: 'Admin', role: 'admin' };
  } else {
    const a = findAcc(u);
    if (!a) { await new Promise(r => setTimeout(r, 400)); return lgErr('Tài khoản chưa có trên máy này. Hãy mở đúng link chia sẻ của Admin!'); }
    const h = await sha256(a.user, p);
    if (h !== a.hash) { await new Promise(r => setTimeout(r, 400)); return lgErr('Sai tên tài khoản hoặc mật khẩu'); }
    if (a.blocked) return lgErr('Tài khoản đã bị chặn. Vui lòng liên hệ Admin.');
    session = { user: a.user, role: 'lead' };
  }
  finishLogin();
});
['lgUser', 'lgPass', 'lgPass2'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') $('btnLogin').click(); }));
$('btnLogout').addEventListener('click', () => {
  session = null; store.set('pm_session', null);
  applyAccess(); renderLogin(); window.scrollTo(0, 0);
});

document.addEventListener('click', e => {
  const t = e.target;
  if ((t.closest('[data-del-report]') && !can('del')) || (t.closest('#btnExport') && !can('export')) || (t.closest('#hEdit') && !can('hedit'))) {
    e.stopImmediatePropagation(); e.preventDefault();
  }
}, true);

/* ---------- Đồng bộ Google Sheets ---------- */
const badge = $('syncBadge');
const setBadge = (t, warn) => { badge.textContent = t; badge.classList.toggle('warn', !!warn); };
let syncing = false;
async function syncSheets() {
  if (syncing) return;
  syncing = true; setBadge('⌛ Đang đồng bộ…', true);
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(SHEET_CSV_URL, { signal: ctl.signal, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const rows = parseCSV(await res.text());
    if (!rows.length) throw new Error('Trống');
    setData(rows); store.set('pm_sheets_cache_v2', rows);
    setBadge('● Google Sheets');
  } catch {
    if (!data.length || data === SAMPLE_DATA) {
      const cached = store.get('pm_sheets_cache_v2', null);
      if (cached && cached.length) { setData(cached); setBadge('⚠️ Ngoại tuyến (cache)', true); }
      else { setData(SAMPLE_DATA); setBadge('⚠️ Dữ liệu mẫu', true); }
    } else setBadge('⚠️ Ngoại tuyến (cache)', true);
  } finally { clearTimeout(timer); syncing = false; }
}

/* ---------- Khởi chạy ---------- */
['orderMinutes', 'shiftMinutes', 'shifts', 'operators', 'efficiency'].forEach(id => $(id).addEventListener('input', calc1));
['basis', 'work', 'eff2', 'people'].forEach(id => $(id).addEventListener('input', calc2));
$('sel').addEventListener('change', pick);
const syncAll = () => { syncSheets(); syncDefects(false); syncEmp(false); syncOrders(false); };
badge.addEventListener('click', syncAll);
$('btnSync').addEventListener('click', syncAll);
window.addEventListener('online', syncAll);

$('repDate').value = localToday();
$('filterDate').value = localToday();
$('passThr').value = store.get('pm_pass_thr', 100);
$('ppmMonth').value = localToday().slice(0, 7);
loadPpmTarget();
$('ppmMonth').addEventListener('change', () => { loadPpmTarget(); renderDashboard(); });
$('ppmTarget').addEventListener('input', () => {
  const t = ppmTargets(), v = Math.max(0, num($('ppmTarget').value));
  t[$('ppmMonth').value] = v; t.default = v; store.set('pm_ppm_targets', t); renderPPM();
});
$('passThr').addEventListener('input', () => { store.set('pm_pass_thr', num($('passThr').value)); renderDashboard(); });
$('btnAllDays').addEventListener('click', () => { $('filterDate').value = ''; renderDashboard(); });
calc1();

// Đảm bảo link mặc định được điền sẵn nếu chưa từng lưu
if (!store.get('pm_orders_url', '')) store.set('pm_orders_url', DEFAULT_ORDERS_URL);
$('parDate').value = localToday();
$('defUrl').value = store.get('pm_defect_url', DEFAULT_DEFECT_URL);
$('empUrl').value = store.get('pm_emp_url', DEFAULT_EMP_URL);
$('ordUrl').value = store.get('pm_orders_url', DEFAULT_ORDERS_URL);
$('pushUrl').value = store.get('pm_push_url', ''); $('pushToken').value = store.get('pm_push_token', '');
updatePushInfo(); renderOpList(); flushOutbox(false);
setInterval(() => flushOutbox(false), 60 * 60 * 1000);
window.addEventListener('online', () => flushOutbox(false));
document.addEventListener('visibilitychange', () => { if (!document.hidden) flushOutbox(false); });
fillDefSelect(); fillEmpSelect(); renderDefList(); renderDashboard(); syncDefects(false); syncEmp(false);
fillOrdGroup(); fillOrdView(); renderOrders(); updateOrdInfo(); syncOrders(false);

const cachedRows = store.get('pm_sheets_cache_v2', null);
if (cachedRows && cachedRows.length) setData(cachedRows);
syncSheets();

// Kiểm tra phiên đăng nhập khi tải trang
if (session) {
  if (session.role === 'admin') { if (!adminHash()) session = null; }
  else { const a = findAcc(session.user); if (!a || a.blocked) session = null; }
  if (!session) store.set('pm_session', null);
}
renderLogin(); renderAccounts(); applyAccess();

/* ---------- Nút ẩn/hiện card & bảng ---------- */
(() => {
  const KEY = 'pm_hidden_ui', hid = new Set(store.get(KEY, []));
  const save = () => store.set(KEY, [...hid]);
  const title = h => h ? (h.childNodes[0] ? h.childNodes[0].textContent.trim() : '') : '';
  function scan() {
    document.querySelectorAll('.card>h2:not([data-tg])').forEach(h => {
      h.dataset.tg = 1;
      const c = h.parentElement, k = 'c:' + title(h), b = document.createElement('button');
      b.type = 'button'; b.className = 'tg';
      if (hid.has(k)) c.classList.add('col');
      const set = () => { const o = c.classList.contains('col'); b.textContent = o ? '▸' : '▾'; b.setAttribute('aria-label', o ? 'Hiện thông tin' : 'Ẩn thông tin'); };
      set();
      b.onclick = () => { c.classList.toggle('col') ? hid.add(k) : hid.delete(k); set(); save(); };
      h.append(b);
    });
    document.querySelectorAll('.table-wrap:not([data-tg])').forEach(w => {
      w.dataset.tg = 1;
      const sc = w.closest('.card') || w.parentElement, h = sc.querySelector(':scope>h2'),
        idx = [...sc.querySelectorAll('.table-wrap')].indexOf(w), k = 't:' + (h ? title(h) : (sc.id || 'x')) + '#' + idx,
        bar = document.createElement('div'), b = document.createElement('button');
      bar.className = 'tgbar'; b.type = 'button'; b.className = 'tg';
      if (hid.has(k)) w.classList.add('hid');
      const set = () => { b.textContent = w.classList.contains('hid') ? '▸ Hiện bảng' : '▾ Ẩn bảng'; };
      set();
      b.onclick = () => { w.classList.toggle('hid') ? hid.add(k) : hid.delete(k); set(); save(); };
      bar.append(b); w.before(bar);
    });
  }
  let scanQueued = false;
  const observer = new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => { scanQueued = false; scan(); });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scan();
})();
