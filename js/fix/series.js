(function () {
  'use strict';
  if (window.__progPatch) return;
  if (typeof orders === 'undefined' || typeof applyOrders !== 'function' ||
      typeof queue !== 'function' || typeof renderOrders !== 'function') {
    console.error('[progress] thiếu hàm gốc, không chạy'); return;
  }
  window.__progPatch = 1;
  window.__pgAll = () => all;
  const KEY = 'pm_ord_prog', KEYB = 'pm_ord_basek';
  const kf = (fp, ser) => fp + '|' + (ser || '');
  const fv = v => v == null ? '?' : fmt(v, 0);
  let prog = store.get(KEY, []); if (!Array.isArray(prog)) prog = [];
  let all = orders.slice(), showDone = false, G = {}, pulling = false;
  const saveProg = () => store.set(KEY, prog);
  const ordActive = () => $('orders').classList.contains('active');
  const rerender = () => { if (!ordActive()) return; try { renderOrders(); } catch (e) { console.error(e); } };
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  function refresh() {
    const base = store.get(KEYB, {}), dm = {}, dp = {};
    prog.forEach(p => {
      const k = kf(p.fp, p.ser);
      if (base[k] && String(p.ts || '') <= base[k]) return;
      dm[k] = (dm[k] || 0) + (Number(p.mont) || 0);
      dp[k] = (dp[k] || 0) + (Number(p.pr) || 0);
    });
    all.forEach(o => { if (o._m0 === undefined) { o._m0 = o.mont; o._p0 = o.pr; } });
    [...all].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999')).forEach(o => {
      const k = kf(o.fp, o.ser);
      if (o._m0 != null) { const t = Math.min(dm[k] || 0, o._m0); dm[k] = (dm[k] || 0) - t; o.mont = o._m0 - t; }
      if (o._p0 != null) { const t = Math.min(dp[k] || 0, o._p0); dp[k] = (dp[k] || 0) - t; o.pr = o._p0 - t; }
    });
    orders = showDone ? all.slice() : all.filter(o => ordSt(o)[2] !== 'done');
    window._ordCache = null;
  }

  function rebase(rows) {
    const sum = (list, raw) => { const r = {}; list.forEach(o => {
      const x = r[kf(o.fp, o.ser)] || (r[kf(o.fp, o.ser)] = { m: 0, p: 0 });
      x.m += (raw && o._m0 !== undefined ? o._m0 : o.mont) || 0;
      x.p += (raw && o._p0 !== undefined ? o._p0 : o.pr) || 0; }); return r; };
    const prev = sum(all, true), cur = sum(rows, false), b = store.get(KEYB, {}), t = new Date().toISOString();
    Object.keys(cur).forEach(k => { if (prev[k] && (prev[k].m !== cur[k].m || prev[k].p !== cur[k].p)) b[k] = t; });
    store.set(KEYB, b);
  }

  const _ao = applyOrders;
  window.applyOrders = function (rows) {
    try { rebase(rows); } catch (e) {}
    all = rows;
    const r = _ao.apply(this, arguments);
    refresh(); fillSel(); rerender();
    return r;
  };

  $('trkList').closest('.card').insertAdjacentHTML('beforebegin', `<div class="card tc t-rep"><h2>📦 Cập nhật tiến độ đơn hàng <span class="cdate">(tra theo Series)</span></h2>
    <div class="field"><label for="pgQ">Series <span id="pgCnt" style="color:#cfe2ff"></span></label>
      <input id="pgQ" type="search" placeholder="Gõ Series (hoặc FPNR) để tra đơn…" autocomplete="off" autocapitalize="off" style="margin-bottom:8px"><select id="pgSel"></select></div>
    <div class="hint" id="pgInfo"></div>
    <div class="row2">
      <div class="field"><label for="pgMont">MONT đã làm (bộ)</label><input id="pgMont" type="number" inputmode="numeric" min="0" value="0"></div>
      <div class="field"><label for="pgPr">PRUEF đã test (bộ)</label><input id="pgPr" type="number" inputmode="numeric" min="0" value="0"></div>
    </div>
    <button class="btn" id="btnPg" type="button">Lưu tiến độ</button>
    <div id="pgMsg" class="msg" role="status"></div>
    <h3 style="font-size:13px;margin:14px 0 4px">Đã nhập gần đây</h3><div id="pgList"></div></div>`);
  $('ordTables').insertAdjacentHTML('beforebegin',
    '<label class="chk" style="margin:6px 0"><input type="checkbox" id="ordShowDone"> Hiện cả đơn đã hoàn thành (mặc định đã ẩn)</label>');
  $('ordShowDone').addEventListener('change', e => { showDone = e.target.checked; refresh(); rerender(); });

  function groups() {
    const q = norm($('pgQ').value.trim()), g = {};
    if (!q) return g;
    all.forEach(o => {
      if (!norm((o.ser || '') + ' ' + o.fp).includes(q)) return;
      const k = kf(o.fp, o.ser), x = g[k] || (g[k] = { fp: o.fp, ser: o.ser || '', d: o.d, plan: 0, m: null, p: null, due: o.due, open: 0 });
      x.plan += o.plan || 0;
      if (o.mont != null) x.m = (x.m || 0) + o.mont;
      if (o.pr != null) x.p = (x.p || 0) + o.pr;
      if (ordSt(o)[2] !== 'done') x.open++;
      if (o.due && (!x.due || o.due < x.due)) x.due = o.due;
    });
    Object.keys(g).forEach(k => { if (!g[k].open) delete g[k]; });
    return g;
  }
  function fillSel() {
    G = groups();
    const sel = $('pgSel'), cur = sel.value, keys = Object.keys(G).sort((a, b) => (G[a].due || '9999').localeCompare(G[b].due || '9999')).slice(0, 100);
    sel.innerHTML = '<option value="">' + (keys.length ? '— Chọn đơn hàng —' : ($('pgQ').value.trim() ? '(không có đơn chưa hoàn thành)' : '(gõ Series để tra)')) + '</option>' +
      keys.map(k => `<option value="${esc(k)}">${esc(G[k].fp)} · Series ${esc(G[k].ser || '—')} · MONT còn ${fv(G[k].m)} · PRUEF còn ${fv(G[k].p)}</option>`).join('');
    $('pgCnt').textContent = $('pgQ').value.trim() ? `(${keys.length} đơn)` : '';
    if (keys.length === 1) sel.value = keys[0]; else if (keys.includes(cur)) sel.value = cur;
    showInfo();
  }
  function showInfo() {
    const g = G[$('pgSel').value];
    $('pgInfo').textContent = g ? `${g.d || ''} · KH ${fmt(g.plan, 0)} bộ · MONT còn ${fv(g.m)} · PRUEF còn ${fv(g.p)} · Hạn ${g.due ? fmtD(g.due) : '—'}` : '';
  }
  function renderList() {
    const pend = new Set(outbox.filter(o => o.op === 'ordprog').map(o => o.id));
    const list = prog.slice().sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 8);
    $('pgList').innerHTML = list.length ? list.map(p => `<div class="hcard"><div class="hrow"><b>${esc(p.fp)} · Series ${esc(p.ser || '—')}</b><span class="pill ${pend.has(p.id) ? 'wn' : 'ok'}">${pend.has(p.id) ? '⏳ Chờ gửi' : '✔ Đã gửi Sheets'}</span></div>
      <div class="hint" style="margin:6px 0 0">MONT +${fmt(p.mont, 0)} · PRUEF +${fmt(p.pr, 0)} · ${esc(p.user || '')} · ${esc(fmtD(p.date))}</div>
      <button class="btn secondary" type="button" data-pgdel="${esc(p.id)}" style="min-height:34px;margin-top:6px">Xóa nhập này</button></div>`).join('')
      : '<div class="empty">Chưa có tiến độ nào</div>';
  }
  $('pgQ').addEventListener('input', debounce(fillSel, 180));
  $('pgSel').addEventListener('change', showInfo);

  $('btnPg').addEventListener('click', () => {
    const k = $('pgSel').value, g = G[k], m = Math.floor(num($('pgMont').value)), p = Math.floor(num($('pgPr').value));
    if (!g) return flash($('pgMsg'), '❌ Gõ Series và chọn đơn hàng!', true);
    if (m < 0 || p < 0 || m + p <= 0) return flash($('pgMsg'), '❌ Nhập số MONT hoặc PRUEF lớn hơn 0', true);
    if (g.m != null && m > g.m && !confirm(`⚠️ MONT nhập ${m} lớn hơn số còn lại (${g.m}). Vẫn lưu?`)) return;
    if (g.p != null && p > g.p && !confirm(`⚠️ PRUEF nhập ${p} lớn hơn số còn lại (${g.p}). Vẫn lưu?`)) return;
    const rec = { id: uid(), fp: g.fp, ser: g.ser, mont: m, pr: p, user: session ? session.user : '', date: localToday(), ts: new Date().toISOString() };
    prog.push(rec); saveProg();
    queue({ op: 'ordprog', id: rec.id, prog: rec });
    refresh();
    $('pgMont').value = 0; $('pgPr').value = 0;
    fillSel(); renderList(); rerender();
    const now = groups()[k];
    flash($('pgMsg'), now ? `✅ Đã lưu. Còn MONT ${fv(now.m)} · PRUEF ${fv(now.p)}` : '✅ Đã lưu. Đơn đã hoàn thành và được ẩn khỏi tab Đơn hàng.');
    setTimeout(renderList, 4000);
  });
  $('pgList').addEventListener('click', e => {
    const id = e.target.dataset.pgdel; if (!id) return;
    const r = prog.find(x => x.id === id); if (!r) return;
    if (!(can('del') || (session && r.user === session.user))) return flash($('pgMsg'), '❌ Bạn không có quyền xóa nhập này', true);
    if (!confirm('Xóa lần nhập tiến độ này?')) return;
    prog = prog.filter(x => x.id !== id); saveProg();
    queue({ op: 'ordprogdel', id });
    refresh(); fillSel(); renderList(); rerender();
  });

  async function pull() {
    const url = store.get('pm_push_url', ''), token = store.get('pm_push_token', '');
    if (!url || pulling || document.hidden) return;
    pulling = true;
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 15000);
    try {
      const res = await fetch(url + '?mode=prog&token=' + encodeURIComponent(token), { cache: 'no-store', signal: ctl.signal });
      const j = await res.json();
      if (!j.ok || !Array.isArray(j.prog)) return;
      const pend = new Set(outbox.filter(o => o.op === 'ordprog').map(o => o.id));
      const pdel = new Set(outbox.filter(o => o.op === 'ordprogdel').map(o => o.id));
      const srv = new Set(j.prog.map(x => x.id));
      const next = [...j.prog.filter(x => !pdel.has(x.id)), ...prog.filter(x => pend.has(x.id) && !srv.has(x.id))];
      const sig = a => a.map(x => x.id).sort().join(',');
      if (sig(next) === sig(prog)) { renderList(); return; }
      prog = next; saveProg(); refresh(); fillSel(); renderList(); rerender();
    } catch (e) {} finally { clearTimeout(t); pulling = false; }
  }
  window.addEventListener('online', pull);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(); });
  $('syncBadge').addEventListener('click', pull);
  $('btnSync').addEventListener('click', pull);
  setInterval(pull, 5 * 60 * 1000);
    window.__pgAdd = (fp, ser, m, p) => {
    const rec = { id: uid(), fp, ser: ser || '', mont: m, pr: p, user: session ? session.user : '', date: localToday(), ts: new Date().toISOString() };
    prog.push(rec); saveProg(); queue({ op: 'ordprog', id: rec.id, prog: rec });
    refresh(); fillSel(); renderList(); rerender();
  };

  refresh(); fillSel(); renderList();
  setTimeout(pull, 1500);
})();