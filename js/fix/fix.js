// js/fix/fix.js - BAN MOI (thay TOAN BO file cu)
// 1. Them nut "Chi gui loi" hoat dong that
// 2. Keo bao cao + loi tu Google Sheets ve Dashboard (gop, khong lam mat du lieu tren may)
// 3. Don ban ghi rac
(function () {
  if (window.__FIX_V3__) return;
  window.__FIX_V3__ = true;

  const say = (t, err) => { try { flash($('repMsg'), t, err); } catch (e) { alert(t); } };

  // ---------- 1. Don ban ghi rac (khong co FPNR, khong co san luong) ----------
  function cleanGhost() {
    try {
      const n1 = reports.length;
      reports = reports.filter(r => r && (r.fpnr || Number(r.plan) || Number(r.actual) || Number(r.defects)));
      if (reports.length !== n1) store.set('pm_prod_reports', reports);
      const n2 = outbox.length;
      outbox = outbox.filter(o => o.op === 'delete' || !o.report || o.report.fpnr || (o.report.defects || []).length);
      if (outbox.length !== n2) saveOut();
    } catch (e) {}
  }

  // ---------- 2. Nut "Chi gui loi" ----------
  function sendDefectOnly() {
    if (!pendDef.length) return say('❌ Chưa có lỗi nào. Chọn nhân viên + mã lỗi rồi bấm "+ Thêm lỗi" trước.', true);
    const date = $('repDate').value, shift = $('repShift').value, p = data[Number($('repFpnr').value)];
    if (!date) return say('❌ Vui lòng chọn ngày báo cáo!', true);
    if (!p) return say('❌ Vui lòng chọn bộ dây FPNR!', true);
    if (!store.get('pm_push_url', '')) return say('❌ Chưa có link gửi Google Sheets', true);
    const user = $('repUser').value || (session ? session.user : 'Admin');
    const rep = {
      id: uid(), date: date, shift: shift, line: p.line, user: user, fpnr: p.fpnr, name: p.name,
      defects: pendDef.map(x => ({
        code: x.code, desc: defName(x.code), qty: x.qty, emp: x.emp || '',
        name: x.emp ? empNameOf(x.emp, x.empName) : ''
      }))
    };
    queue({ op: 'defect', report: rep });
    pendDef = []; renderDefList();
    say('✅ Đã nhận lỗi, đang gửi lên Google Sheets…');
    pullWhenSent(0);
  }
  function setupButton() {
    const save = document.getElementById('btnSaveReport');
    if (!save || document.getElementById('btnSendDefectOnly')) return;
    save.textContent = 'Lưu báo cáo (kèm lỗi đang nhập)';
    const b = document.createElement('button');
    b.id = 'btnSendDefectOnly'; b.type = 'button'; b.className = 'btn secondary';
    b.style.marginTop = '8px';
    b.textContent = 'Chỉ gửi lỗi (không lưu báo cáo)';
    b.addEventListener('click', sendDefectOnly);
    save.insertAdjacentElement('afterend', b);
  }

  // ---------- 3. Keo du lieu ve Dashboard ----------
  const dateOf = d => { const m = String(d || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? m[0] : String(d || ''); };
  const norm = r => {
    const perf = Array.isArray(r.perfList) ? r.perfList : [];
    const defs = Array.isArray(r.defectList) ? r.defectList : [];
    const plan = perf.length ? perf.reduce((s, p) => s + (Number(p.plan) || 0), 0) : (Number(r.plan) || 0);
    const actual = perf.length ? perf.reduce((s, p) => s + (Number(p.actual) || Number(p.output) || 0), 0) : (Number(r.actual) || 0);
    const defects = defs.length ? defs.reduce((s, d) => s + (Number(d.qty) || 0), 0) : (Number(r.defects) || 0);
    const date = dateOf(r.date), user = r.user || r.teamLead || '';
    const id = r.id || r.reportId || ['srv', date, r.fpnr, user, r.shift, plan, actual].join('|');
    return Object.assign({}, r, { id: id, user: user, date: date, plan: plan, actual: actual, output: actual, defects: defects, defectList: defs });
  };

  async function pullMerge(show) {
    const url = store.get('pm_push_url', ''), token = store.get('pm_push_token', '');
    if (!url) { if (show) alert('Chưa có Link Báo cáo'); return; }
    try {
      const res = await fetch(url + '?mode=list&token=' + encodeURIComponent(token), { cache: 'no-store' });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || 'Máy chủ chưa trả về báo cáo');
      const delIds = new Set(outbox.filter(o => o.op === 'delete').map(o => o.id));
      const server = (j.reports || []).map(norm).filter(r => r.date && !delIds.has(r.id));
      const ids = new Set(server.map(r => r.id));
      const localOnly = reports.filter(r => !r.id || !ids.has(r.id));   // giu lai bao cao chi co tren may
      reports = server.concat(localOnly);
      server.forEach(r => syncedIds.add(r.id)); saveSyncedIds();
      store.set('pm_prod_reports', reports);
      renderDashboard(); fillFpnr();
      if (show) alert('✅ Đã kéo ' + server.length + ' báo cáo từ Google Sheets');
    } catch (e) { if (show) alert('❌ Chưa kéo được: ' + e.message); }
  }
  window.pullReportsP0 = pullMerge;   // thay ham keo cu trong auth-patch.js

  function pullWhenSent(n) {            // doi gui xong roi keo ve
    if (!outbox.length) return pullMerge(false);
    if (n < 20) setTimeout(() => pullWhenSent(n + 1), 1500);
  }
  function autoPull() { if (session && !outbox.length) pullMerge(false); }
  setInterval(autoPull, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) autoPull(); });
  const badgeBtn = document.getElementById('syncBadge');
  if (badgeBtn) badgeBtn.addEventListener('click', autoPull);
  const saveBtn = document.getElementById('btnSaveReport');
  if (saveBtn) saveBtn.addEventListener('click', () => setTimeout(() => pullWhenSent(0), 1500));

  cleanGhost();
  setupButton();  // ---------- 5. Moi danh sach chi hien ~5 dong, con lai cuon len xuong ----------
  const LIM_ROWS = 5;   // <-- doi so nay neu muon hien nhieu hoac it dong hon
  (function () {
    const st = document.createElement('style');
    st.textContent =
      '.pm-lim{overflow-y:auto!important;overflow-x:hidden;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding-right:4px;scrollbar-width:thin;scrollbar-color:#3a5a7a transparent}' +
      '.pm-limt{overflow-y:auto!important;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;scrollbar-width:thin;scrollbar-color:#3a5a7a transparent}' +
      '.pm-lim::-webkit-scrollbar,.pm-limt::-webkit-scrollbar{width:6px;height:6px}' +
      '.pm-lim::-webkit-scrollbar-thumb,.pm-limt::-webkit-scrollbar-thumb{background:#3a5a7a;border-radius:10px}' +
      '.pm-limt thead th{position:sticky;top:0;z-index:3;background:#1a2a3a}';
    document.head.appendChild(st);

    function limit(el, items, extra, cls) {
      if (items.length <= LIM_ROWS) {
        el.style.removeProperty('max-height');
        el.classList.remove(cls);
        return;
      }
      const a = items[0].getBoundingClientRect();
      const b = items[LIM_ROWS - 1].getBoundingClientRect();
      const h = Math.round(b.bottom - a.top + (extra || 0)) + 2;
      if (!(h > 20)) return;                      // dang bi an thi bo qua
      el.classList.add(cls);
      el.style.setProperty('max-height', h + 'px', 'important');
    }

    function apply() {
      // a) Danh sach "Theo doi da nhap" (cac the bao cao)
      const trk = document.getElementById('trkList');
      if (trk) limit(trk, [...trk.children].filter(c => c.classList.contains('hcard')), 0, 'pm-lim');

      // b) Cac bang du lieu (Dashboard, PPM, don hang...)
      document.querySelectorAll('.table-wrap table').forEach(t => {
        const box = t.closest('.pm-scroll') || t.closest('.table-wrap');
        if (!box) return;
        const items = t.classList.contains('ot')
          ? [...t.tBodies]                                            // bang don hang: moi don = 1 khoi
          : [...t.tBodies].flatMap(tb => [...tb.rows]).filter(r => !r.querySelector('td.empty'));
        const head = t.tHead ? t.tHead.getBoundingClientRect().height : 0;
        limit(box, items, head, 'pm-limt');
      });
    }

    let tm = 0;
    const sched = () => { clearTimeout(tm); tm = setTimeout(apply, 300); };
    new MutationObserver(sched).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('click', sched);
    window.addEventListener('resize', sched);
    sched();
  })();
  console.log('[FIX] fix.js v3 da nap');
})();