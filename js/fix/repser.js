(function () {
  'use strict';
  if (window.__repSer) return;
  if (typeof window.__pgAll !== 'function' || typeof payload !== 'function' ||
      typeof fpnrInfo !== 'function' || typeof renderTrack !== 'function' || typeof ordSt !== 'function') {
    console.error('[repser] thiếu hàm gốc hoặc series.js chưa nạp'); return;
  }
  window.__repSer = 1;
  const AUTO = 'pm_auto_mont';

  /* ---- Ô Series + PRUEF trong form báo cáo ---- */
  $('repFpnr').closest('.field').insertAdjacentHTML('afterend',
    '<div class="field"><label for="repSeries">Series đang chạy <span id="repSerInfo" style="color:#cfe2ff"></span></label>' +
    '<select id="repSeries"></select>' +
    '<div class="hint" id="repSerProg" style="margin-top:6px"></div>' +
    '<label class="chk" style="margin-top:8px"><input type="checkbox" id="repAutoMont"> Tự cộng "Thực tế" vào tiến độ MONT của đơn</label></div>' +
    '<div class="field"><label for="repPr">PRUEF đã test (bộ) <small style="color:#9fb3c8">· tự cộng vào tiến độ PRUEF của Series</small></label>' +
    '<input id="repPr" type="number" inputmode="numeric" min="0" value="0"></div>');
  $('repAutoMont').checked = !!store.get(AUTO, false);
  $('repAutoMont').addEventListener('change', e => store.set(AUTO, e.target.checked));

  function syncDef() {
    const d = $('defSer'), v = $('repSeries').value;
    if (d && v && [...d.options].some(o => o.value === v)) d.value = v;
  }
  function showSerProg() {
    const sel = $('repSeries'), box = $('repSerProg');
    const x = JSON.parse(sel.dataset.info || '{}')[sel.value];
    if (!x || !(x.plan > 0)) { box.textContent = ''; return; }
    const done = v => v == null ? '?' : fmt(Math.max(0, x.plan - v), 0);
    const pct = v => v == null ? '?' : fmt(Math.max(0, x.plan - v) / x.plan * 100, 0) + '%';
    box.textContent = `Kế hoạch ${fmt(x.plan, 0)} bộ · MONT xong ${done(x.m)} (${pct(x.m)}) · PRUEF xong ${done(x.p)} (${pct(x.p)})`;
  }
  function fillRepSer() {
    const sel = $('repSeries'), p = data[Number($('repFpnr').value)], cur = sel.value, by = {};
    (p ? window.__pgAll().filter(o => o.fp === p.fpnr) : []).forEach(o => {
      const k = o.ser || '-', x = by[k] || (by[k] = { due: '', m: null, p: null, plan: 0, open: false });
      if (o.due && (!x.due || o.due < x.due)) x.due = o.due;
      x.plan += o.plan || 0;
      if (o.mont != null) x.m = (x.m || 0) + o.mont;
      if (o.pr != null) x.p = (x.p || 0) + o.pr;
      if (ordSt(o)[2] !== 'done') x.open = true;
    });
    let keys = Object.keys(by).filter(k => by[k].open);
    if (!keys.length) keys = Object.keys(by);
    keys.sort((a, b) => (by[a].due || '9999').localeCompare(by[b].due || '9999') || a.localeCompare(b, undefined, { numeric: true }));
    sel.dataset.need = keys.length ? '1' : '0';
    sel.dataset.info = JSON.stringify(by);
    sel.innerHTML = '<option value="">' + (keys.length ? '— Chọn Series —' : '(FPNR này chưa có đơn)') + '</option>' +
      keys.map(k => `<option value="${esc(k)}">${esc(k === '-' ? '(không có series)' : 'Series ' + k)}${by[k].due ? ' · hạn ' + fmtD(by[k].due).slice(0, 5) : ''} · MONT còn ${by[k].m == null ? '?' : fmt(by[k].m, 0)} · PRUEF còn ${by[k].p == null ? '?' : fmt(by[k].p, 0)}</option>`).join('');
    if (keys.includes(cur)) sel.value = cur; else if (keys.length === 1) sel.value = keys[0];
    $('repSerInfo').textContent = keys.length ? `(${keys.length} series)` : '';
    syncDef(); showSerProg();
  }
  $('repFpnr').addEventListener('change', fillRepSer);
  $('repSeries').addEventListener('change', () => { syncDef(); showSerProg(); });
  const _fi = fpnrInfo;
  window.fpnrInfo = function () { const r = _fi.apply(this, arguments); fillRepSer(); return r; };
  const _ao = applyOrders;
  window.applyOrders = function () { const r = _ao.apply(this, arguments); fillRepSer(); return r; };

  /* ---- Kiểm tra trước khi lưu ---- */
  document.addEventListener('click', e => {
    if (!e.target.closest('#btnSaveReport')) return;
    window.__rs = null;
    const sel = $('repSeries'), raw = sel.value, need = sel.dataset.need === '1';
    const actual = num($('repActual').value), pr = Math.max(0, Math.floor(num($('repPr').value)));
    const stop = msg => { e.stopImmediatePropagation(); e.preventDefault(); flash($('repMsg'), msg, true); };
    if (need && !raw) return stop('❌ Vui lòng chọn Series đang chạy!');
    if (pr > 0 && !need) return stop('❌ Bộ dây này chưa có đơn hàng nên không ghi được PRUEF. Hãy để PRUEF = 0.');
    const x = JSON.parse(sel.dataset.info || '{}')[raw] || {};
    if (x.m != null && actual > x.m && !confirm(`⚠️ Thực tế ${actual} bộ lớn hơn MONT còn lại của Series này (${x.m} bộ). Vẫn lưu?`)) {
      e.stopImmediatePropagation(); e.preventDefault(); return;
    }
    if (x.p != null && pr > x.p && !confirm(`⚠️ PRUEF nhập ${pr} lớn hơn số còn lại (${x.p} bộ). Vẫn lưu?`)) {
      e.stopImmediatePropagation(); e.preventDefault(); return;
    }
    window.__rs = { has: need, series: raw === '-' ? '' : raw, n: reports.length, auto: $('repAutoMont').checked, pr };
  }, true);

  /* Gắn Series vào báo cáo ngay lúc app gốc tạo payload gửi Sheets */
  const _pl = payload;
  window.payload = function (r) {
    const s = window.__rs;
    if (r.series === undefined && s && s.has && reports[reports.length - 1] === r) r.series = s.series;
    const o = _pl.apply(this, arguments);
    if (r.series !== undefined) o.series = r.series;
    return o;
  };

  /* Sau khi app gốc lưu xong: cộng tiến độ MONT / PRUEF */
  $('btnSaveReport').addEventListener('click', () => {
    const s = window.__rs; window.__rs = null;
    if (!s || reports.length <= s.n) return;
    const r = reports[reports.length - 1];
    if (s.has && r.series === undefined) r.series = s.series;
    store.set('pm_prod_reports', reports);
    if (s.has && window.__pgAdd) {
      const m = s.auto ? Math.max(0, Number(r.actual) || 0) : 0, p = s.pr || 0;
      if (m + p > 0) window.__pgAdd(r.fpnr, s.series, m, p);
    }
    $('repPr').value = 0;
    fillRepSer(); renderTrack();
  });

  /* ---- Hiện Series trong "Theo dõi đã nhập" và bảng Dashboard ---- */
  function tagSer() {
    document.querySelectorAll('#trkList .hcard, #reportTableBody tr').forEach(el => {
      const b = el.querySelector('[data-del-report]'); if (!b || el.dataset.sr) return;
      const r = reports.find(x => x.id === b.dataset.delReport); if (!r || !r.series) return;
      el.dataset.sr = 1;
      const t = el.matches('tr') ? el.children[3] : el.querySelector('.hrow b');
      if (t) t.insertAdjacentHTML('beforeend', ' · <span style="color:#b79cff">Series ' + esc(r.series) + '</span>');
    });
  }
  const _rt = renderTrack;
  window.renderTrack = function () { const r = _rt.apply(this, arguments); tagSer(); return r; };

  fillRepSer(); renderTrack(); setTimeout(fillRepSer, 1500);
})();