(function () {
  'use strict';
  if (window.__defSer) return;
  if (typeof pendDef === 'undefined' || typeof renderDefList !== 'function' ||
      typeof payload !== 'function' || typeof renderPareto !== 'function' ||
      typeof window.__pgAll !== 'function') {
    console.error('[defser] thiếu hàm gốc hoặc series.js chưa nạp'); return;
  }
  window.__defSer = 1;
  const serName = s => s === '?' ? 'Không rõ' : (s || 'Chưa gán');

  $('defCode').closest('.field').insertAdjacentHTML('beforebegin',
    '<div class="field"><label for="defSer">Series của đơn hàng <span id="defSerInfo" style="color:#cfe2ff"></span></label><select id="defSer"></select></div>');

  function fillDefSer() {
    const sel = $('defSer'), p = data[Number($('repFpnr').value)], cur = sel.value, by = {};
    (p ? window.__pgAll().filter(o => o.fp === p.fpnr) : []).forEach(o => {
      const k = o.ser || '-';
      if (!(k in by) || (o.due && (!by[k] || o.due < by[k]))) by[k] = o.due || by[k] || '';
    });
    const keys = Object.keys(by).sort((a, b) => (by[a] || '9999').localeCompare(by[b] || '9999') || a.localeCompare(b, undefined, { numeric: true }));
    sel.dataset.need = keys.length ? '1' : '0';
    sel.innerHTML = '<option value="">' + (keys.length ? '— Chọn Series —' : '(FPNR này chưa có đơn)') + '</option>' +
      keys.map(k => `<option value="${esc(k)}">${esc(k === '-' ? '(không có series)' : 'Series ' + k)}${by[k] ? ' · hạn ' + fmtD(by[k]).slice(0, 5) : ''}</option>`).join('') +
      '<option value="?">Không xác định</option>';
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
    else if (keys.length === 1) sel.value = keys[0];
    $('defSerInfo').textContent = keys.length ? `(${keys.length} series)` : '';
  }
  $('repFpnr').addEventListener('change', fillDefSer);
  $('repLine').addEventListener('change', () => setTimeout(fillDefSer, 0));
  const _fi = fpnrInfo;
  window.fpnrInfo = function () { const r = _fi.apply(this, arguments); fillDefSer(); return r; };
  const _ao = applyOrders;
  window.applyOrders = function () { const r = _ao.apply(this, arguments); fillDefSer(); return r; };

  document.addEventListener('click', e => {
    if (!e.target.closest('#btnAddDef')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const code = $('defCode').value, qty = Math.floor(num($('defQty').value)), emp = $('defEmp').value;
    if (!code || qty < 1) return flash($('repMsg'), '❌ Chọn mã lỗi và nhập số lượng ≥ 1', true);
    if (!emp) return flash($('repMsg'), '❌ Vui lòng chọn nhân viên gây lỗi (hoặc "Không xác định")', true);
    const sv = $('defSer').value;
    if ($('defSer').dataset.need === '1' && !sv) return flash($('repMsg'), '❌ Vui lòng chọn Series của đơn bị lỗi!', true);
    const ser = sv === '-' ? '' : sv;
    const empName = emp === '?' ? 'Không xác định' : (employees.find(x => x.id === emp) || {}).name || '';
    const ex = pendDef.find(x => x.code === code && x.emp === emp && (x.ser || '') === ser);
    if (ex) ex.qty += qty; else pendDef.push({ code, qty, emp, empName, ser });
    $('defQty').value = 1; renderDefList();
  }, true);

  document.addEventListener('click', e => {
    const b = e.target.closest('#defList [data-rm]'); if (!b) return;
    e.stopImmediatePropagation(); e.preventDefault();
    const i = [...$('defList').querySelectorAll('.chip')].indexOf(b.closest('.chip'));
    if (i >= 0) { pendDef.splice(i, 1); renderDefList(); }
  }, true);

  const _rd = renderDefList;
  window.renderDefList = function () {
    const r = _rd.apply(this, arguments);
    $('defList').querySelectorAll('.chip').forEach((c, i) => {
      const s = c.querySelector('small'), x = pendDef[i];
      if (s && x) s.textContent = '📦 ' + serName(x.ser) + ' · ' + s.textContent;
    });
    return r;
  };

  const _pl = payload;
  window.payload = function (r) {
    const o = _pl.apply(this, arguments), dl = r.defectList || [];
    (o.defects || []).forEach((d, i) => { d.ser = (dl[i] && dl[i].ser) || ''; });
    return o;
  };

  $('empChart').closest('.card').insertAdjacentHTML('afterend',
    '<div class="card tc t-def"><h2>📦 Lỗi theo Series <span class="cdate">(<span id="serLabel"></span>)</span></h2><div id="serChart"></div></div>');
  function renderSer() {
    const box = $('serChart'); if (!box) return;
    $('serLabel').textContent = $('parLabel').textContent;
    const fLine = $('filterLine').value, [from, to] = parRange(), by = {};
    reports.filter(r => r.date >= from && r.date <= to && (!fLine || r.line === fLine)).forEach(r => (r.defectList || []).forEach(x => {
      const k = (r.fpnr || '—') + '|' + (x.ser || ''), g = by[k] || (by[k] = { fp: r.fpnr || '—', ser: x.ser || '', total: 0, emps: {}, codes: {} });
      const q = Number(x.qty) || 0;
      g.total += q; g.codes[x.code] = (g.codes[x.code] || 0) + q;
      const ek = x.emp || '—'; g.emps[ek] = (g.emps[ek] || 0) + q;
    }));
    const arr = Object.values(by).sort((a, b) => b.total - a.total);
    if (!arr.length) { box.innerHTML = '<div class="empty">Chưa có lỗi trong khoảng thời gian này</div>'; return; }
    box.innerHTML = '<div class="table-wrap"><table style="min-width:520px"><thead><tr><th>#</th><th>FPNR</th><th>Series</th><th>Lỗi</th><th>Nhân viên gây lỗi</th><th>Mã lỗi</th></tr></thead><tbody>' +
      arr.map((g, i) => {
        const emps = Object.entries(g.emps).sort((a, b) => b[1] - a[1]).map(([id, q]) => esc(id === '?' ? 'Không xác định' : id + ' ' + empNameOf(id, '')) + ' ×' + q).join(', ');
        const codes = Object.entries(g.codes).sort((a, b) => b[1] - a[1]).map(([c, q]) => esc(c) + ' ×' + q).join(', ');
        return `<tr><td>${i + 1}</td><td>${esc(g.fp)}</td><td><b>${esc(serName(g.ser))}</b></td><td class="${i === 0 ? 'bad' : ''}">${fmt(g.total, 0)}</td><td>${emps}</td><td>${codes}</td></tr>`;
      }).join('') + '</tbody></table></div>';
  }
  const _rp = renderPareto;
  window.renderPareto = function () { const r = _rp.apply(this, arguments); renderSer(); return r; };

  fillDefSer(); renderSer(); setTimeout(fillDefSer, 1500);
})();