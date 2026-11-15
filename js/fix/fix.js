// js/fix/fix.js - TAO TU DONG BANG LENH
(function() {
  function anLinkToken() {
    const all = [...document.querySelectorAll('input')];
    const link = all.find(e => (e.value || '').includes('script.google.com'));
    if (!link) return;
    link.style.display = 'none';
    const idx = all.indexOf(link);
    const token = all[idx + 1];
    if (token) { token.style.display = 'none'; }
    document.querySelectorAll('label').forEach(lb => {
      if (lb.textContent.includes('Link Web App') || lb.textContent.includes('Mã bảo vệ')) lb.style.display = 'none';
    });
    let box = link.parentElement;
    for (let i = 0; i < 6 && box; i++) { if (box.querySelectorAll('input').length >= 2) break; box = box.parentElement; }
    if (box && !box.querySelector('[data-auto-note]')) {
      const d = document.createElement('div');
      d.setAttribute('data-auto-note', '1');
      d.style.cssText = 'padding:10px;border-radius:10px;background:rgba(0,200,100,.15);color:#fff;font-size:13px;margin:10px 0;text-align:center';
      d.textContent = '✅ App đã tự lấy Link + Token rồi, bạn không cần nhập gì nữa.';
      const btn = box.querySelector('button');
      if (btn) box.insertBefore(d, btn); else box.appendChild(d);
    }
  }
  const obs1 = new MutationObserver(() => anLinkToken());
  obs1.observe(document.body, { childList: true, subtree: true });
  setTimeout(anLinkToken, 1000);
  let daBam = false;
  const obs2 = new MutationObserver(() => {
    const btn = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Tạo mật khẩu & vào app');
    if (!btn || daBam) return;
    daBam = true;
    const ins = [...document.querySelectorAll('input[type="password"]')].filter(e => e.offsetParent !== null);
    if (ins.length >= 2) {
      ins[0].value = '12345'; ins[0].dispatchEvent(new Event('input', { bubbles: true }));
      ins[1].value = '12345'; ins[1].dispatchEvent(new Event('input', { bubbles: true }));
    }
    setTimeout(() => btn.click(), 800);
  });
  obs2.observe(document.body, { childList: true, subtree: true });
})();
// 3. TU DONG KEO DU LIEU TU SHEET VE - DE DASHBOARD HET 0
(function tuKeoDuLieu() {
  async function keo() {
    const link = 'https://script.google.com/macros/s/AKfycbwroNbMBO02aibQ7tFZxLKM9Ke1Gbl_OT0icHG8yThfalAVIjDAfX-xpxiX76mPBQI-Iw/exec';
    const token = 'Davson-2026-9f8K2mQ7xZ4pL1w';
    try {
      const res = await fetch(link + '?mode=list&token=' + encodeURIComponent(token), { cache: 'no-store' });
      const j = await res.json();
      if (!j.ok) return;
      const list = (j.reports || []).map(r => {
        const perf = r.perfList || r.perf || [];
        const defs = r.defectList || r.defects || [];
        const plan = perf.reduce((s, p) => s + (Number(p.plan) || 0), 0);
        const actual = perf.reduce((s, p) => s + (Number(p.actual) || Number(p.output) || 0), 0);
        const defects = Array.isArray(defs) ? defs.reduce((s, d) => s + (Number(d.qty) || Number(d.quantity) || Number(d.defects) || 0), 0) : (Number(r.defects) || 0);
        return { ...r, plan, actual, output: actual, totalPlan: plan, totalActual: actual, defects, defectCount: defects };
      });
      // Luu vao bo nho cua app
      window.reports = list;
      try {
        localStorage.setItem('pm_prod_reports', JSON.stringify(list));
        if (window.store) store.set('pm_prod_reports', list);
      } catch(e) {}
      // Ve lai Dashboard
      if (window.renderDashboard) window.renderDashboard();
      console.log('DA KEO DUOC ' + list.length + ' BAO CAO');
    } catch(e) {
      console.log('CHUA KEO DUOC: ' + e.message);
    }
  }
  // Keo ngay khi mo app + keo lai sau 2 giay + keo lai sau 5 giay
  keo();
  setTimeout(keo, 2000);
  setTimeout(keo, 5000);
  // Keo lai moi khi ban bam nut Dong bo
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn && (btn.textContent || '').includes('Đồng bộ')) {
      setTimeout(keo, 500);
    }
  });
})();