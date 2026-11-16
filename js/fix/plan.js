(function () {
  'use strict';
  if (window.__planPatch) return;
  if (!$('perf') || typeof window.__pgAll !== 'function' || typeof ordSt !== 'function' ||
      typeof ordLine !== 'function' || typeof wkOf !== 'function') {
    console.error('[plan] thiếu hàm gốc hoặc series.js chưa nạp'); return;
  }
  window.__planPatch = 1;

  const KEY = 'pm_plan_v1';
  const SC = { asm: 'Board (lắp ráp)', pst: 'PST (test)', both: 'Board + PST' };
  const kf = (fp, ser) => fp + '|' + (ser || '');
  const st0 = store.get(KEY, null) || {};
  const st = { people: st0.people || 5, work: st0.work || 480, eff: st0.eff || 40, sel: st0.sel || {} };
  const save = () => store.set(KEY, st);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  let cur = [];

  /* ---------- Dữ liệu ---------- */
  function groups() {
    const g = {};
    window.__pgAll().forEach(o => {
      const k = kf(o.fp, o.ser);
      const x = g[k] || (g[k] = { key: k, fp: o.fp, ser: o.ser || '', d: o.d || '', due: o.due || '', plan: 0, m: null, p: null, open: false, line: ordLine(o) });
      x.plan += o.plan || 0;
      if (o.mont != null) x.m = (x.m || 0) + o.mont;
      if (o.pr != null) x.p = (x.p || 0) + o.pr;
      if (o.due && (!x.due || o.due < x.due)) x.due = o.due;
      if (ordSt(o)[2] !== 'done') x.open = true;
    });
    return Object.values(g).filter(x => x.open);
  }
  function stdOf(g, sc) {
    const r = data.find(x => x.fpnr === g.fp);
    if (!r) return 0;
    return sc === 'pst' ? r.pst : sc === 'both' ? r.total : r.asm;
  }
  function capOf(g, sc) {
    if (sc === 'pst') return g.p == null ? 0 : (g.m == null ? g.p : Math.max(0, g.p - g.m));
    return g.m == null ? g.plan : g.m;
  }
  function split(q, p) {
    if (p < 1 || q < 1) return '';
    const b = Math.floor(q / p), r = q % p;
    if (r === 0) return `Mỗi người ${b} bộ`;
    if (b === 0) return `${r} người × 1 bộ (${p - r} người không có bộ)`;
    return `${r} người × ${b + 1} bộ + ${p - r} người × ${b} bộ`;
  }

  /* ---------- Giao diện ---------- */
  $('perf').insertAdjacentHTML('beforeend', `<div class="card tc t-cap" id="plCard"><h2>🗓️ Kế hoạch ngày: nhiều đơn hàng · nhiều người</h2>
    <div class="hint">Tick các đơn sẽ chạy trong ngày, chọn làm ở Board hay PST cho từng đơn. App tính số bộ và số người để đạt hiệu suất mục tiêu. Ngày chỉ lắp board thì chọn Board, ngày test thì chọn PST.</div>
    <div class="row2">
      <div class="field"><label for="plPeople">Số người bố trí</label><input id="plPeople" type="number" inputmode="numeric" min="0"></div>
      <div class="field"><label for="plWork">Phút làm việc / người</label><input id="plWork" type="number" inputmode="decimal" min="0"></div>
      <div class="field"><label for="plEff">Hiệu suất mục tiêu (%)</label><input id="plEff" type="number" inputmode="decimal" min="0"></div>
      <div class="field"><label for="plAll">Đặt phạm vi cho tất cả đơn</label><select id="plAll"><option value="">— chọn để áp dụng —</option><option value="asm">Tất cả: Board</option><option value="pst">Tất cả: PST</option><option value="both">Tất cả: Board + PST</option></select></div>
    </div>
    <h3 style="font-size:13px;margin:12px 0 4px">1. Chọn đơn hàng (từ tab Đơn hàng)</h3>
    <div class="row2">
      <div class="field"><label for="plQ">Tìm</label><input id="plQ" type="search" placeholder="FPNR / Series / mô tả" autocomplete="off"></div>
      <div class="field"><label for="plKw">Tuần hạn</label><select id="plKw"></select></div>
      <div class="field"><label for="plLine">Khu vực</label><select id="plLine"><option value="">Tất cả</option><option value="EAP">EAP</option><option value="USL">USL</option></select></div>
    </div>
    <div id="plList" style="max-height:260px;overflow:auto;border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:6px 10px"></div>
    <div class="hint" id="plCnt"></div>
    <h3 style="font-size:13px;margin:14px 0 4px">2. Bố trí người &amp; số bộ cho từng đơn</h3>
    <div class="row2">
      <button class="btn" id="plAuto" type="button">⚙️ Tự chia người &amp; số bộ</button>
      <button class="btn secondary" id="plClear" type="button">Bỏ chọn tất cả</button>
    </div>
    <div id="plRows" style="margin-top:8px"></div>
    <h3 style="font-size:13px;margin:14px 0 4px">3. Tổng kết</h3>
    <div class="result-grid" id="plSum"></div>
    <div class="hint" id="plStatus" style="margin-top:8px"></div></div>`);

  $('plPeople').value = st.people; $('plWork').value = st.work; $('plEff').value = st.eff;

  function renderList() {
    const q = norm($('plQ').value.trim()), ln = $('plLine').value, kwSel = $('plKw').value;
    const all = groups();
    const kws = {};
    all.forEach(g => { const w = wkOf(g.due); if (w) kws[w.y * 100 + w.w] = 'KW ' + w.w; });
    const keys = Object.keys(kws).map(Number).sort((a, b) => a - b);
    $('plKw').innerHTML = '<option value="">Tất cả tuần</option>' + keys.map(k => `<option value="${k}">${kws[k]}</option>`).join('');
    if (keys.map(String).includes(kwSel)) $('plKw').value = kwSel;
    const kw = $('plKw').value;
    const list = all.filter(g => (!ln || g.line === ln) && (!kw || String((wkOf(g.due) || { y: 0, w: 0 }).y * 100 + (wkOf(g.due) || { w: 0 }).w) === kw) &&
      (!q || norm(g.fp + ' ' + g.ser + ' ' + g.d).includes(q)))
      .sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.fp.localeCompare(b.fp));
    $('plList').innerHTML = list.slice(0, 150).map(g => {
      const w = wkOf(g.due);
      return `<label class="chk" style="display:block;margin:5px 0"><input type="checkbox" data-pk="${esc(g.key)}"${st.sel[g.key] ? ' checked' : ''}> <b>${esc(g.fp)}</b> · Series ${esc(g.ser || '—')} · <small>${esc(g.d)}</small> · ${w ? 'KW ' + w.w : 'chưa có hạn'} · MONT còn ${g.m == null ? '?' : fmt(g.m, 0)} · PRUEF còn ${g.p == null ? '?' : fmt(g.p, 0)}</label>`;
    }).join('') || '<div class="empty">Không có đơn phù hợp</div>';
    $('plCnt').textContent = `${list.length} đơn chưa hoàn thành${list.length > 150 ? ' (hiện 150 đơn đầu, hãy lọc thêm)' : ''} · đã chọn ${Object.keys(st.sel).length}`;
  }

  function rowHtml(x, i) {
    const g = x.g, s = x.s;
    const opts = Object.entries(SC).map(([v, t]) => `<option value="${v}"${s.scope === v ? ' selected' : ''}>${t}</option>`).join('');
    return `<div class="hcard"><div class="hrow"><b>${esc(g.fp)} · Series ${esc(g.ser || '—')}</b><button class="btn-del" type="button" data-pdel="${i}">Bỏ</button></div>
      <div class="hc-o">${esc(g.d)} · hạn ${g.due ? esc(fmtD(g.due)) : '—'}</div>
      <div class="row2">
        <div class="field"><label>Làm ở</label><select data-i="${i}" data-f="scope">${opts}</select></div>
        <div class="field"><label>Số người</label><input type="number" inputmode="numeric" min="0" data-i="${i}" data-f="people" value="${s.people || 0}"></div>
        <div class="field"><label>Số bộ chạy</label><input type="number" inputmode="numeric" min="0" data-i="${i}" data-f="qty" value="${s.qty || 0}"></div>
      </div><div class="hint" id="plr${i}" style="margin:4px 0 0"></div></div>`;
  }

  function renderRows() {
    const gs = {}; groups().forEach(g => { gs[g.key] = g; });
    Object.keys(st.sel).forEach(k => { if (!gs[k]) delete st.sel[k]; });
    cur = Object.keys(st.sel).sort((a, b) => (gs[a].due || '9999').localeCompare(gs[b].due || '9999'))
      .map(k => ({ k, g: gs[k], s: st.sel[k] }));
    $('plRows').innerHTML = cur.length ? cur.map(rowHtml).join('') : '<div class="empty">Chưa chọn đơn hàng nào. Tick ở danh sách phía trên.</div>';
    save(); calc();
  }

  /* ---------- Tính toán ---------- */
  function calc() {
    const N = Math.max(0, Math.floor(num($('plPeople').value))), W = Math.max(0, num($('plWork').value)), E = Math.max(0, num($('plEff').value));
    let sMin = 0, sQty = 0, sP = 0, errs = 0;
    cur.forEach((x, i) => {
      const s = x.s, std = stdOf(x.g, s.scope), cap = capOf(x.g, s.scope);
      const p = Math.max(0, Math.floor(num(s.people))), q = Math.max(0, Math.floor(num(s.qty)));
      const min = q * std, eff = p > 0 && W > 0 ? min / (p * W) * 100 : null;
      const need = W > 0 && E > 0 ? Math.ceil(min / (W * E / 100) - 1e-9) : 0;
      sMin += min; sQty += q; sP += p;
      const L = [`Phút chuẩn ${fmt(std, 3)}/bộ · ${s.scope === 'pst' ? 'đã lắp chưa test, test được tối đa' : 'còn lại trên board'}: ${fmt(cap, 0)} bộ`];
      let bad = false;
      if (!(std > 0)) { L.push('❌ Bộ dây này chưa có phút chuẩn trong Google Sheets FPNR'); bad = true; }
      if (q > cap) { L.push(s.scope === 'pst' ? `❌ Vượt số được test (chỉ test được ${fmt(cap, 0)} bộ đã lắp xong)` : `❌ Vượt số còn lại (${fmt(cap, 0)} bộ)`); bad = true; }
      if (q > 0 && p < 1) { L.push('❌ Chưa bố trí người'); bad = true; }
      if (q > 0 && !bad) {
        L.push(`Chạy ${fmt(q, 0)} bộ = ${fmt(min, 1)} phút chuẩn · ${p} người · hiệu suất ${eff == null ? '—' : fmt(eff, 1) + '%'} ${eff != null && eff >= E ? '✅' : '⚠️ dưới mục tiêu'} · cần ≥ ${need} người cho ${fmt(E, 0)}%`);
        L.push('👷 ' + split(q, p));
        if (cap - q > 0) L.push(`Còn lại sau hôm nay: ${fmt(cap - q, 0)} bộ`);
      }
      if (bad) errs++;
      const el = $('plr' + i);
      if (el) { el.innerHTML = L.join('<br>'); el.style.color = bad ? '#ff8f96' : ''; }
    });
    const capMin = N * W * E / 100, effAll = sP > 0 && W > 0 ? sMin / (sP * W) * 100 : null;
    const needAll = W > 0 && E > 0 ? Math.ceil(sMin / (W * E / 100) - 1e-9) : 0;
    $('plSum').innerHTML =
      `<div class="result-item"><span>Số đơn</span><b>${cur.length}</b></div>
       <div class="result-item"><span>Tổng số bộ chạy</span><b>${fmt(sQty, 0)}</b></div>
       <div class="result-item"><span>Phút chuẩn cần</span><b>${fmt(sMin, 1)}</b></div>
       <div class="result-item"><span>Công suất ${N} người × ${fmt(E, 0)}%</span><b>${fmt(capMin, 1)}</b></div>
       <div class="result-item"><span>Người đã bố trí</span><b style="color:${sP > N ? 'var(--red)' : ''}">${sP} / ${N}</b></div>
       <div class="result-item"><span>Hiệu suất chung</span><b>${effAll == null ? '—' : fmt(effAll, 1) + '%'}</b></div>
       <div class="result-item"><span>Cần tối thiểu</span><b>${needAll} người</b></div>`;
    const msg = [];
    if (errs) msg.push(`❌ ${errs} đơn có lỗi, xem chi tiết ở từng đơn.`);
    if (sP > N) msg.push('❌ Bố trí vượt số người hiện có.');
    if (cur.length && !errs && sP <= N) msg.push(effAll != null && effAll >= E ? `✅ Đạt hiệu suất mục tiêu ${fmt(E, 0)}% với ${sP} người.` : `⚠️ Hiệu suất chung chưa đạt ${fmt(E, 0)}%.`);
    $('plStatus').textContent = msg.join(' ');
  }

  /* ---------- Tự chia ---------- */
  function auto() {
    const N = Math.max(0, Math.floor(num($('plPeople').value))), W = num($('plWork').value), E = num($('plEff').value) / 100;
    if (!(W > 0) || !(E > 0)) return flash($('plStatus'), '❌ Nhập phút làm việc và hiệu suất mục tiêu lớn hơn 0', true);
    cur.forEach(x => { x.s.people = 0; x.s.qty = 0; });
    const rows = cur.map(x => {
      const std = stdOf(x.g, x.s.scope), cap = capOf(x.g, x.s.scope);
      return { x, std, cap, need: std > 0 && cap > 0 ? cap * std / (W * E) : 0, p: 0 };
    }).filter(r => r.std > 0 && r.cap > 0);
    let left = N;
    rows.forEach(r => { if (left > 0) { r.p = 1; left--; } });
    while (left > 0) {
      let best = null;
      rows.forEach(r => { if (r.p > 0 && r.need - r.p > 1e-9 && (!best || r.need - r.p > best.need - best.p)) best = r; });
      if (!best) break;
      best.p++; left--;
    }
    rows.forEach(r => {
      r.x.s.people = r.p;
      r.x.s.qty = r.p > 0 ? Math.min(r.cap, Math.ceil(r.p * W * E / r.std - 1e-9)) : 0;
    });
    renderRows();
  }

  /* ---------- Sự kiện ---------- */
  ['plPeople', 'plWork', 'plEff'].forEach(id => $(id).addEventListener('input', () => {
    st.people = num($('plPeople').value); st.work = num($('plWork').value); st.eff = num($('plEff').value);
    save(); calc();
  }));
  $('plQ').addEventListener('input', debounce(renderList, 150));
  $('plKw').addEventListener('change', renderList);
  $('plLine').addEventListener('change', renderList);
  $('plList').addEventListener('change', e => {
    const k = e.target.dataset.pk; if (k == null) return;
    if (e.target.checked) st.sel[k] = st.sel[k] || { scope: 'asm', people: 1, qty: 0 }; else delete st.sel[k];
    renderRows(); renderList();
  });
  const onField = e => {
    const t = e.target, i = t.dataset.i, x = i != null ? cur[i] : null; if (!x) return;
    x.s[t.dataset.f] = t.dataset.f === 'scope' ? t.value : num(t.value);
    save(); calc();
  };
  $('plRows').addEventListener('input', onField);
  $('plRows').addEventListener('change', onField);
  $('plRows').addEventListener('click', e => {
    const i = e.target.dataset.pdel; if (i == null || !cur[i]) return;
    delete st.sel[cur[i].k]; renderRows(); renderList();
  });
  $('plAll').addEventListener('change', e => {
    const v = e.target.value; if (!v) return;
    Object.values(st.sel).forEach(s => { s.scope = v; });
    e.target.value = ''; renderRows();
  });
  $('plAuto').addEventListener('click', auto);
  $('plClear').addEventListener('click', () => { st.sel = {}; renderRows(); renderList(); });

  const refreshAll = () => { renderList(); renderRows(); };
  const _ao = applyOrders;
  window.applyOrders = function () { const r = _ao.apply(this, arguments); setTimeout(refreshAll, 0); return r; };
  const nb = document.querySelector('.nav button[data-page="perf"]');
  if (nb) nb.addEventListener('click', refreshAll);

  refreshAll(); setTimeout(refreshAll, 1500);
})();