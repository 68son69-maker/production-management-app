// accounts.js - gửi tài khoản Team Lead mới lên Google Sheet Taikhoan và hiện kết quả ngay dưới nút
(function () {
  'use strict';
  if (window.__acctPatch) return;
  window.__acctPatch = 1;
  const SALT = 'DAVSON-2026-';

  function show(t, err) {
    const b = $('accMsg'); if (!b) return;
    clearTimeout(b._t); b.textContent = t; b.classList.toggle('err', !!err);
    b._t = setTimeout(() => { b.textContent = ''; }, 20000);
  }

  async function send(user, pass) {
    const c = (typeof CFG_AUTO !== 'undefined') ? CFG_AUTO : {};
    const url = c.accountUrl || store.get('pm_add_account_url', '');
    const token = c.token || store.get('pm_push_token', '');
    if (!url || !token) return show('❌ Thiếu link hoặc token tài khoản (xem auth-patch.js)', true);
    show('⏳ Đang gửi "' + user + '" lên Sheet Taikhoan…');
    try {
      const hash = await sha256(user, pass + SALT + user);
      if (hash.length !== 64) return show('❌ Trình duyệt không tạo được mã băm đủ 64 ký tự. Hãy mở app bằng địa chỉ https.', true);
      const q = new URLSearchParams({ mode: 'addAccount', token, user, hash,
        DASH: 'true', REPORT: 'true', PERF: 'true', ORDERS: 'true', HARNESS: 'true', EXPORT: 'false', DEL: 'false', HEDIT: 'false' });
      const res = await fetch(url + '?' + q.toString());
      const txt = await res.text();
      let j = null; try { j = JSON.parse(txt); } catch (e) {}
      console.log('[acct]', res.status, txt.slice(0, 300));
      if (j && j.ok) show('✅ Đã gửi "' + user + '" lên Sheet Taikhoan. Bản CSV của Google có thể trễ 2-5 phút mới hiện trong danh sách.');
      else if (j && /ton tai/i.test(j.error || '')) show('✅ "' + user + '" đã có trên Sheet Taikhoan (có thể vừa được gửi ngay trước đó). Mở Google Sheet để kiểm tra.');
      else if (j) show('❌ Sheet từ chối: ' + (j.error || 'không rõ lỗi'), true);
      else show('❌ Phản hồi không đọc được (HTTP ' + res.status + '). Kiểm tra Apps Script Taikhoan đã triển khai với quyền "Bất kỳ ai".', true);
    } catch (err) { show('❌ Không gửi được: ' + err.message, true); }
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('#btnAddAccount') || !isAdmin()) return;
    const user = $('newUsername').value.trim(), pass = $('newPassword').value;
    if (!user || pass.length < 4 || /^admin$/i.test(user)) return;
    send(user, pass);
  }, true);
})();