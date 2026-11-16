(function () {
  'use strict';
  if (window.__uiPatch) return;
  if (!$('repMontFill') || !$('pgQ') || !$('btnSaveReport')) { console.error('[ui] thiếu phần tử, cần nạp sau repser.js'); return; }
  window.__uiPatch = 1;

  /* Bỏ nút "MONT = Thực tế", sửa lời nhắc */
  $('repMontFill').remove();
  const hint = $('repMont').closest('.row2').nextElementSibling;
  if (hint) hint.textContent = 'MONT (lắp ráp trên board) và PRUEF (test) nhập riêng, số có thể khác nhau. Để 0 nếu chưa có.';

  /* Đổi tên nút */
  $('btnSaveReport').textContent = 'Gửi báo cáo';

  /* Ẩn phần nhập của card "Cập nhật tiến độ", chỉ giữ danh sách đã gửi để xóa khi nhập nhầm */
  const card = $('pgQ').closest('.card');
  [...card.children].forEach(el => {
    if (el.matches('h2') || el.matches('h3') || el.id === 'pgMsg' || el.id === 'pgList') return;
    el.style.display = 'none';
  });
  const h2 = card.querySelector('h2');
  if (h2 && h2.firstChild) h2.firstChild.textContent = '📦 Tiến độ đơn hàng đã gửi ';
  const cd = card.querySelector('.cdate'); if (cd) cd.textContent = '(bấm Xóa nếu nhập nhầm)';
  const h3 = card.querySelector('h3'); if (h3) h3.textContent = 'Gửi gần đây';
})();