(function () {
  'use strict';
  if (window.__uiPatch) return;
  if (!$('repMont') || !$('pgQ') || !$('btnSaveReport')) { console.error('[ui] thiếu phần tử, cần nạp sau repser.js'); return; }
  window.__uiPatch = 1;

  if ($('repMontFill')) $('repMontFill').remove();
  const row = $('repMont').closest('.row2');
  const hint = row.nextElementSibling;
  if (hint && hint.classList.contains('hint')) hint.textContent = 'MONT (lắp ráp trên board) và PRUEF (test) nhập riêng. PRUEF chỉ test được số bộ đã lắp xong trên board.';

  row.insertAdjacentHTML('beforebegin',
    '<label class="chk" style="margin:4px 0 10px"><input type="checkbox" id="repTestOnly"> Hôm nay chỉ test PRUEF (không lắp ráp trên board)</label>');
  row.insertAdjacentHTML('afterend', '<div class="hint" id="repPrMax" style="margin:-2px 0 8px;color:#ffd88a"></div>');

  const btn = $('btnSaveReport');
  const montNow = () => $('repTestOnly').checked ? 0 : Math.max(0, Math.floor(num($('repMont').value)));
  const prNow = () => Math.max(0, Math.floor(num($('repPr').value)));

  /* Số PRUEF được phép test = MONT đã xong - PRUEF đã test (+ MONT nhập thêm lần này) */
  function maxPr(mont) {
    const sel = $('repSeries'), x = JSON.parse(sel.dataset.info || '{}')[sel.value];
    if (!x || x.m == null || x.p == null) return null;
    return Math.max(0, x.p - x.m + mont);
  }
  function upd() {
    const on = $('repTestOnly').checked;
    $('repMont').disabled = on;
    if (on) $('repMont').value = 0;
    btn.textContent = on ? 'Gửi PRUEF' : 'Gửi báo cáo';
    const mx = maxPr(montNow()), box = $('repPrMax');
    box.textContent = mx == null ? '' : mx > 0
      ? `PRUEF test được tối đa: ${fmt(mx, 0)} bộ (= số đã lắp MONT trừ số đã test PRUEF)`
      : '⚠️ Series này chưa có bộ nào lắp xong đang chờ test (PRUEF = 0).';
  }
  $('repTestOnly').addEventListener('change', upd);
  ['repMont', 'repPr'].forEach(id => $(id).addEventListener('input', upd));
  $('repSeries').addEventListener('change', upd);
  new MutationObserver(upd).observe($('repSerProg'), { childList: true, characterData: true, subtree: true });
  upd();

  /* Kiểm tra trước khi gửi (chạy trước mọi xử lý khác) */
  window.addEventListener('click', e => {
    if (!e.target.closest('#btnSaveReport')) return;
    const testOnly = $('repTestOnly').checked, pr = prNow(), mont = montNow();
    const sel = $('repSeries'), raw = sel.value, need = sel.dataset.need === '1';
    const stop = msg => { e.stopImmediatePropagation(); e.preventDefault(); flash($('repMsg'), msg, true); };
    if (testOnly) {
      const p = data[Number($('repFpnr').value)];
      if (!p) return stop('❌ Vui lòng chọn bộ dây FPNR!');
      if (!need) return stop('❌ Bộ dây này chưa có đơn hàng nên không ghi được PRUEF.');
      if (!raw) return stop('❌ Vui lòng chọn Series đang test!');
      if (pr < 1) return stop('❌ Nhập số PRUEF đã test lớn hơn 0');
    }
    if (pr > 0 && need && raw) {
      const mx = maxPr(mont);
      if (mx != null && pr > mx) {
        return stop(mx > 0
          ? `❌ PRUEF ${pr} vượt số được test. Series này chỉ test được tối đa ${mx} bộ (số đã lắp xong trên board).`
          : '❌ Series này chưa có bộ nào lắp xong trên board nên chưa test được PRUEF.');
      }
    }
    if (testOnly) {
      e.stopImmediatePropagation(); e.preventDefault();
      const p = data[Number($('repFpnr').value)];
      window.__rs = null;
      window.__pgAdd(p.fpnr, raw === '-' ? '' : raw, 0, pr);
      $('repPr').value = 0;
      $('repFpnr').dispatchEvent(new Event('change'));
      flash($('repMsg'), `✅ Đã gửi PRUEF +${pr} bộ cho Series ${raw === '-' ? '(không có series)' : raw}.`);
    }
  }, true);

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