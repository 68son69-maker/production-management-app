(function () {
  'use strict';
  if (window.__repSer) return;
  if (typeof window.__pgAll !== 'function' || typeof payload !== 'function' ||
      typeof fpnrInfo !== 'function' || typeof renderTrack !== 'function' || typeof ordSt !== 'function') {
    console.error('[repser] thiếu hàm gốc hoặc series.js chưa nạp'); return;
  }
  window.__repSer = 1;
  const AUTO = 'pm_auto_mont';

  $('repFpnr').closest('.field').insertAdjacentHTML('afterend',
    '<div class="field"><label for="repSeries">Series đang chạy <span id="repSerInfo" style="color:#cfe2ff"></span></label><select id="repSeries"></select>' +
    '<label class="chk" style="margin-top:8px"><input type="checkbox" id="repAutoMont"> Tự cộng sản lượng này vào tiến độ MONT của đơn</label></div>');
  $('repAutoMont').checked = !!store.get(AUTO, false);
  $('repAutoMont').addEventListener('change', e => store.set(AUTO, e.target.checked));

  function syncDef() {
    const d = $('defSer'), v = $('repSeries').value;
    if (d && v && [...d.options].some(o => o.value === v)) d.value = v;
  }
  function fillRepSer() {
    const sel = $('repSeries'), p = data[Number($('repFpnr').value)], cur = sel.value, by = {};
    (p ? window.__pgAll().filter(o => o.fp === p.fpnr) : []).forEach(o => {
      const k = o.ser || '-', x = by[k] || (by[k] = { due: '', left: null, open: false });
      if (o.due && (!x.due || o.due < x.due)) x.due = o.due;
      if (o.mont != null) x.left = (x.left || 0) + o.mont;
      if (ordSt(o)[2] !== 'done') x.open = true;
    });
    let keys = Object.keys(by).filter(k => by[k].open);
    if (!keys.length) keys = Object.keys(by);
    keys.sort((a, b) => (by[a].due || '9999').localeCompare(by[b].due || '9999') || a.localeCompare(b, undefined, { numeric: true }));
    sel.dataset.need = keys.length ? '1' : '0';
    sel.dataset.left = JSON.stringify(Object.fromEntries(keys.map(k => [k, by[k].left])));
    sel.innerHTML = '<option value="">' + (keys.length ? '— Chọn Series —' : '(FPNR này chưa có đơn)') + '</option>' +
      keys.map(k => `<option value="${esc(k)}">${esc(k === '-' ? '(không có series)' : 'Series ' + k)}${by[k].due ? ' · hạn ' + fmtD(by[k].due).slice(0, 5) : ''}${by[k].left != null ? ' · còn MONT ' + fmt(by[k].left, 0) : ''}</option>`).join('');
    if (keys.includes(cur)) sel.value = cur; else if (keys.length === 1) sel.value = keys[0];
    $('repSerInfo').textContent = keys.length ? `(${keys.length} series)` : '';
    syncDef();
  }
  $('repFpnr').addEventListener('change', fillRepSer);
  $('repSeries').addEventListener('change', syncDef);
  const _fi = fpnrInfo;
  window.fpnrInfo = function () { const r = _fi.apply(this, arguments); fillRepSer(); return r; };
  const _ao = applyOrders;
  window.applyOrders = function () { const r = _ao.apply(this, arguments); fillRepSer(); return r; };

  document.addEventListener('click', e => {
    if (!e.target.closest('#btnSaveReport')) return;
    window.__rs = null;
    const sel = $('repSeries'), raw = sel.value;
    if (sel.dataset.need === '1' && !raw) {
      e.stopImmediatePropagation(); e.preventDefault();
      return flash($('repMsg'), '❌ Vui lòng chọn Series đang chạy!', true);
    }
    const left = JSON.parse(sel.dataset.left || '{}')[raw], actual = num($('repActual').value);
    if (left != null && actual > left && !confirm(`⚠️ Thực tế ${actual} bộ lớn hơn MONT còn lại của Series này (${left} bộ). Vẫn lưu?`)) {
      e.stopImmediatePropagation(); e.preventDefault(); return;
    }
    window.__rs = { has: sel.dataset.need === '1', series: raw === '-' ? '' : raw, n: reports.length, auto: $('repAutoMont').checked };
  }, true);

  const _pl = payload;
  window.payload = function (r) {
    const s = window.__rs;
    if (r.series === undefined && s && s.has && reports[reports.length - 1] === r) r.series = s.series;
    const o = _pl.apply(this, arguments);
    if (r.series !== undefined) o.series = r.series;
    return o;
  };

  $('btnSaveReport').addEventListener('click', () => {
    const s = window.__rs; window.__rs = null;
    if (!s || reports.length <= s.n) return;
    const r = reports[reports.length - 1];
    if (s.has && r.series === undefined) r.series = s.series;
    store.set('pm_prod_reports', reports);
    if (s.auto && s.has && r.actual > 0 && window.__pgAdd) window.__pgAdd(r.fpnr, s.series, Number(r.actual), 0);
    fillRepSer(); renderTrack();
  });

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