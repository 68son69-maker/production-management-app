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
