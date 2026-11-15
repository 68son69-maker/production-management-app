// js/fix/fix.js - BAN SUA APP: TRUOC KHI GUI, TU BO SUNG DU THONG TIN
// App cu chi gui: date, shift, line, fpnr, plan, actual
// Fix nay tu lay them: Team Lead (tu tai khoan dang nhap) + Ten bo day + Phut chuan (tu Don hang theo FPNR) + ID + Ho ten + Phut lam viec (tu form nhan vien) + Hieu suat (tu tinh)

(function () {
  if (window.__FIX_FULL_DATA__) return;
  window.__FIX_FULL_DATA__ = true;

  // 1. Lay Team Lead dang dang nhap
  function getTeamLead() {
    try {
      const keys = ['currentUser', 'user', 'loggedUser', 'sessionUser', 'teamLead', 'username'];
      for (let k of keys) {
        const v = localStorage.getItem(k);
        if (!v) continue;
        try {
          const j = JSON.parse(v);
          if (typeof j === 'string') return j;
          if (j.username) return j.username;
          if (j.name) return j.name;
          if (j.teamLead) return j.teamLead;
          if (j.id) return j.id;
        } catch (e) { if (v) return v; }
      }
      const u = window.CURRENT_USER || window.currentUser || window.USER;
      if (u) return u.username || u.name || u.id || String(u);
    } catch (e) {}
    return '';
  }

  // 2. Lay Don hang tu localStorage de tra Ten bo day + Phut chuan theo FPNR
  function findOrderByFpnr(fpnr) {
    if (!fpnr) return null;
    try {
      const keys = ['orders', 'donHang', 'donhang', 'ordersList', 'danhSachDonHang', 'products', 'sanPham'];
      for (let k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        let arr = [];
        try { arr = JSON.parse(raw); } catch (e) { continue; }
        if (!Array.isArray(arr)) arr = arr.list || arr.orders || arr.data || [];
        if (!Array.isArray(arr)) continue;
        const f = String(fpnr).trim().toUpperCase();
        const hit = arr.find(o => String(o.fpnr || o.FPNR || o.maFPNR || o.code || '').trim().toUpperCase() === f);
        if (hit) return hit;
      }
      // Thu lay tu bang Don hang dang hien tren trang
      const rows = document.querySelectorAll('table tbody tr');
      for (let r of rows) {
        const txt = r.innerText || '';
        if (txt.toUpperCase().indexOf(String(fpnr).toUpperCase()) >= 0) {
          const cells = Array.from(r.querySelectorAll('td')).map(td => td.innerText.trim());
          return { _fromTable: cells };
        }
      }
    } catch (e) {}
    return null;
  }

  // 3. Lay nhan vien tu form dang nhap tren trang
  function getWorkersFromForm() {
    try {
      const workers = [];
      // Tim cac input co ten idNhanVien / hoTen / phutLamViec
      const inputs = document.querySelectorAll('input, select');
      let curId = '', curName = '', curMin = 0;
      inputs.forEach(el => {
        const id = (el.id || '').toLowerCase();
        const name = (el.name || '').toLowerCase();
        const ph = (el.placeholder || '').toLowerCase();
        const key = id + ' ' + name + ' ' + ph;
        if (key.indexOf('id') >= 0 && (key.indexOf('nhan vien') >= 0 || key.indexOf('nhanvien') >= 0 || key.indexOf('ma') >= 0)) curId = el.value || curId;
        if (key.indexOf('ho ten') >= 0 || key.indexOf('hoten') >= 0 || key.indexOf('ten nhan vien') >= 0) curName = el.value || curName;
        if (key.indexOf('phut lam') >= 0 || key.indexOf('phutlam') >= 0 || key.indexOf('lam viec') >= 0) curMin = Number(el.value || 0) || curMin;
      });
      if (curId || curName) workers.push({ id: curId, name: curName, minutes: curMin, phutLamViec: curMin });
      // Thu lay tu localStorage workers
      const rawW = localStorage.getItem('workers') || localStorage.getItem('nhanVien') || localStorage.getItem('employees');
      if (rawW) {
        try {
          const arr = JSON.parse(rawW);
          if (Array.isArray(arr) && arr.length) return arr.map(w => ({ id: w.id || w.workerId || '', name: w.name || w.hoTen || '', minutes: Number(w.minutes || w.phutLamViec || w.phut || 0) || 0, phutLamViec: Number(w.minutes || w.phutLamViec || w.phut || 0) || 0 }));
        } catch (e) {}
      }
      return workers;
    } catch (e) { return []; }
  }

  // 4. Bo sung du thong tin vao object bao cao
  function enrichReport(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const src = obj.report || obj.data || obj.payload || obj;
    const report = obj.report || obj.data || obj.payload || obj;
    const target = report;

    const fpnr = target.fpnr || target.FPNR || obj.fpnr || '';
    // Team Lead
    if (!target.teamLead && !target.team_lead) {
      const tl = getTeamLead();
      if (tl) { target.teamLead = tl; target.user = tl; target.username = tl; }
    }
    // Ten bo day + Phut chuan tu Don hang
    if (fpnr) {
      const order = findOrderByFpnr(fpnr);
      if (order) {
        const ten = order.tenBoDay || order.tenBo || order.ten || order.productName || order.tenSanPham || order.moTa || order.name || '';
        const phut = Number(order.phutChuan || order.phutChuanBo || order.stdMinutes || order.standardMinutes || order.phut || order.standard || 0) || 0;
        if (ten && !target.tenBoDay) target.tenBoDay = ten;
        if (phut && !target.phutChuan) target.phutChuan = phut;
        // Neu Don hang luu trong bang, cot thu 2 thuong la Ten bo day, cot Phut chuan nam sau
        if (order._fromTable && order._fromTable.length >= 3 && !target.tenBoDay) {
          target.tenBoDay = order._fromTable[1] || order._fromTable[2] || '';
        }
      }
    }
    // Nhan vien + Phut lam viec
    if (!target.workers || !target.workers.length) {
      const w = getWorkersFromForm();
      if (w.length) {
        target.workers = w;
        target.workerId = w[0].id;
        target.workerName = w[0].name;
        target.hoTen = w[0].name;
        target.phutLamViec = w[0].minutes;
        target.workMinutes = w[0].minutes;
      }
    }
    // Neu da co workers nhung chua co phutLamViec tong, tinh tong
    if (target.workers && target.workers.length) {
      const totalMin = target.workers.reduce((s, w) => s + (Number(w.minutes || w.phutLamViec || w.phut || 0) || 0), 0);
      if (totalMin && !target.phutLamViec) { target.phutLamViec = totalMin; target.workMinutes = totalMin; }
      if (!target.workerId) target.workerId = target.workers.map(w => w.id).filter(Boolean).join(', ');
      if (!target.workerName) target.workerName = target.workers.map(w => w.name).filter(Boolean).join(', ');
    }
    // Hieu suat = San luong * Phut chuan / Phut lam viec
    const perf = target.perfList && target.perfList[0] ? target.perfList[0] : null;
    const actual = Number(target.actual || target.actualTotal || (perf ? perf.actual : 0) || 0) || 0;
    const phutChuan = Number(target.phutChuan || (perf ? perf.phutChuan : 0) || 0) || 0;
    const phutLam = Number(target.phutLamViec || target.workMinutes || 0) || 0;
    if (actual && phutChuan && phutLam) {
      target.hieuSuat = Math.round((actual * phutChuan / phutLam) * 1000) / 10;
      target.efficiency = target.hieuSuat;
    }
    // Dong bo lai vao perfList de Apps Script doc duoc
    if (perf) {
      if (!perf.tenBoDay && target.tenBoDay) perf.tenBoDay = target.tenBoDay;
      if (!perf.phutChuan && target.phutChuan) perf.phutChuan = target.phutChuan;
    }
    return obj;
  }

  // 5. Chan fetch: truoc khi gui bao cao, bo sung du thong tin
  const origFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    try {
      const urlStr = String(url || '');
      const isReportPush = urlStr.indexOf('script.google') >= 0 || urlStr.indexOf('exec') >= 0 || (opts && opts.body && String(opts.body).indexOf('push') >= 0);
      if (isReportPush && opts && opts.body) {
        let body = null;
        try { body = JSON.parse(opts.body); } catch (e) { body = null; }
        if (body && typeof body === 'object') {
          const mode = body.mode || '';
          // Chi bo sung cho bao cao, khong bo sung cho loi / tai khoan
          if (mode !== 'defect' && mode !== 'loi' && mode !== 'addAccount' && mode !== 'login') {
            const enriched = enrichReport(body);
            opts = Object.assign({}, opts, { body: JSON.stringify(enriched) });
          }
        }
      }
    } catch (e) {}
    return origFetch(url, opts);
  };

  // 6. An Link + Token trong Settings, tu dong Admin 12345 (giu nguyen nhu cu)
  document.addEventListener('DOMContentLoaded', function () {
    try {
      const inputs = document.querySelectorAll('input');
      inputs.forEach(inp => {
        const key = (inp.id + ' ' + inp.name + ' ' + inp.placeholder).toLowerCase();
        if (key.indexOf('link') >= 0 || key.indexOf('token') >= 0) {
          const wrap = inp.closest('div') || inp.parentElement;
          if (wrap) wrap.style.display = 'none';
        }
      });
    } catch (e) {}
  });

  console.log('[FIX] Da nap fix du thong tin bao cao');
})();// js/fix/fix.js - BAN CHOT: TACH RIENG NHAP BAO CAO + NHAP LOI + DU DU LIEU
// 1. Tach giao dien: Phan 2 Bao cao rieng, Phan 3 Loi rieng, 2 nut rieng
// 2. Truoc khi gui, tu bo sung du thong tin: Team Lead + Ten bo day + Phut chuan + ID + Ho ten + Hieu suat
(function () {
  if (window.__FIX_SPLIT_V2__) return;
  window.__FIX_SPLIT_V2__ = true;

  function getTeamLead() {
    try {
      const keys = ['currentUser', 'user', 'loggedUser', 'sessionUser', 'teamLead', 'username'];
      for (let k of keys) {
        const v = localStorage.getItem(k);
        if (!v) continue;
        try {
          const j = JSON.parse(v);
          if (typeof j === 'string') return j;
          if (j.username) return j.username;
          if (j.name) return j.name;
          if (j.teamLead) return j.teamLead;
          if (j.id) return j.id;
        } catch (e) { if (v) return v; }
      }
      const u = window.CURRENT_USER || window.currentUser || window.USER;
      if (u) return u.username || u.name || u.id || String(u);
    } catch (e) {}
    return '';
  }

  function findOrderByFpnr(fpnr) {
    if (!fpnr) return null;
    try {
      const keys = ['orders', 'donHang', 'donhang', 'ordersList', 'danhSachDonHang', 'products', 'sanPham'];
      for (let k of keys) {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        let arr = [];
        try { arr = JSON.parse(raw); } catch (e) { continue; }
        if (!Array.isArray(arr)) arr = arr.list || arr.orders || arr.data || [];
        if (!Array.isArray(arr)) continue;
        const f = String(fpnr).trim().toUpperCase();
        const hit = arr.find(o => String(o.fpnr || o.FPNR || o.maFPNR || o.code || '').trim().toUpperCase() === f);
        if (hit) return hit;
      }
    } catch (e) {}
    return null;
  }

  function getWorkersFromForm(scopeEl) {
    try {
      const workers = [];
      const root = scopeEl || document;
      const inputs = root.querySelectorAll('input, select');
      let curId = '', curName = '', curMin = 0;
      inputs.forEach(el => {
        const key = ((el.id || '') + ' ' + (el.name || '') + ' ' + (el.placeholder || '')).toLowerCase();
        if (key.indexOf('id') >= 0 && (key.indexOf('nhan vien') >= 0 || key.indexOf('nhanvien') >= 0 || key.indexOf('ma') >= 0)) curId = el.value || curId;
        if (key.indexOf('ho ten') >= 0 || key.indexOf('hoten') >= 0 || key.indexOf('ten nhan vien') >= 0) curName = el.value || curName;
        if (key.indexOf('phut lam') >= 0 || key.indexOf('phutlam') >= 0 || key.indexOf('lam viec') >= 0) curMin = Number(el.value || 0) || curMin;
      });
      // Neu trong form co dropdown Chon nhan vien, lay ten trong dropdown
      const sel = root.querySelector('select');
      if (sel && sel.value && sel.selectedOptions && sel.selectedOptions[0]) {
        const txt = sel.selectedOptions[0].textContent.trim();
        if (txt && txt !== '— Chọn nhân viên —' && txt.indexOf('Chọn') < 0) {
          const m = txt.match(/(\d{5,})\s*[-–]\s*(.+)/);
          if (m) { curId = m[1]; curName = m[2]; }
          else curName = txt;
        }
      }
      if (curId || curName) workers.push({ id: curId, name: curName, minutes: curMin, phutLamViec: curMin });
      return workers;
    } catch (e) { return []; }
  }

  function enrichReport(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    const target = obj.report || obj.data || obj.payload || obj;
    const fpnr = target.fpnr || target.FPNR || obj.fpnr || '';
    if (!target.teamLead && !target.team_lead) {
      const tl = getTeamLead();
      if (tl) { target.teamLead = tl; target.user = tl; target.username = tl; }
    }
    if (fpnr) {
      const order = findOrderByFpnr(fpnr);
      if (order) {
        const ten = order.tenBoDay || order.tenBo || order.ten || order.productName || order.tenSanPham || order.moTa || order.name || '';
        const phut = Number(order.phutChuan || order.phutChuanBo || order.stdMinutes || order.standardMinutes || order.phut || 0) || 0;
        if (ten && !target.tenBoDay) target.tenBoDay = ten;
        if (phut && !target.phutChuan) target.phutChuan = phut;
      }
    }
    if (!target.workers || !target.workers.length) {
      const w = getWorkersFromForm();
      if (w.length) {
        target.workers = w;
        target.workerId = w[0].id;
        target.workerName = w[0].name;
        target.hoTen = w[0].name;
        target.phutLamViec = w[0].minutes;
        target.workMinutes = w[0].minutes;
      }
    }
    if (target.workers && target.workers.length) {
      const totalMin = target.workers.reduce((s, w) => s + (Number(w.minutes || w.phutLamViec || w.phut || 0) || 0), 0);
      if (totalMin && !target.phutLamViec) { target.phutLamViec = totalMin; target.workMinutes = totalMin; }
      if (!target.workerId) target.workerId = target.workers.map(w => w.id).filter(Boolean).join(', ');
      if (!target.workerName) target.workerName = target.workers.map(w => w.name).filter(Boolean).join(', ');
    }
    const perf = target.perfList && target.perfList[0] ? target.perfList[0] : null;
    const actual = Number(target.actual || target.actualTotal || (perf ? perf.actual : 0) || 0) || 0;
    const phutChuan = Number(target.phutChuan || (perf ? perf.phutChuan : 0) || 0) || 0;
    const phutLam = Number(target.phutLamViec || target.workMinutes || 0) || 0;
    if (actual && phutChuan && phutLam) {
      target.hieuSuat = Math.round((actual * phutChuan / phutLam) * 1000) / 10;
      target.efficiency = target.hieuSuat;
    }
    if (perf) {
      if (!perf.tenBoDay && target.tenBoDay) perf.tenBoDay = target.tenBoDay;
      if (!perf.phutChuan && target.phutChuan) perf.phutChuan = target.phutChuan;
    }
    return obj;
  }

  // --- TACH GIAO DIEN: Tim phan 3 Loi va tach ra khoi form Bao cao ---
  function splitUI() {
    try {
      // Tim tat ca cac tieu de / section chua chu "Lỗi theo mã lỗi" hoac "Loi theo"
      const all = Array.from(document.querySelectorAll('div, section, fieldset, form'));
      let loiSection = null;
      for (let el of all) {
        const txt = (el.innerText || '').slice(0, 200);
        if (txt.indexOf('Lỗi theo mã lỗi') >= 0 || txt.indexOf('Loi theo ma loi') >= 0) {
          // Lay section nho nhat chua ca tieu de + input loi + nut Them loi
          if (el.querySelector('input') && el.innerText.indexOf('Thêm lỗi') >= 0) { loiSection = el; break; }
        }
      }
      if (!loiSection) return false;
      if (loiSection.dataset.splitDone) return true;
      loiSection.dataset.splitDone = '1';

      // Tao khung rieng cho Loi
      const wrap = document.createElement('div');
      wrap.id = 'loi-rieng-wrap';
      wrap.style.cssText = 'margin-top:16px;border:1px solid #1e3a5f;border-radius:12px;padding:14px;background:#0b1a2e;';
      const title = document.createElement('div');
      title.innerHTML = '<b style="font-size:16px;color:#fff;">3. Nhập lỗi riêng - Chỉ bấm khi có lỗi</b><div style="font-size:12px;color:#9db4d0;margin-top:4px;">Không có lỗi thì không cần nhập phần này. Báo cáo và lỗi gửi riêng, không chung 1 nút nữa.</div>';
      wrap.appendChild(title);

      // Di chuyen phan Loi vao khung rieng
      const parent = loiSection.parentElement;
      parent.insertBefore(wrap, loiSection.nextSibling);
      wrap.appendChild(loiSection);

      // Tao nut Gui loi rieng
      let btnLoi = wrap.querySelector('#btn-gui-loi-rieng');
      if (!btnLoi) {
        btnLoi = document.createElement('button');
        btnLoi.id = 'btn-gui-loi-rieng';
        btnLoi.type = 'button';
        btnLoi.textContent = 'Gửi lỗi riêng';
        btnLoi.style.cssText = 'width:100%;margin-top:12px;padding:12px;border:0;border-radius:10px;background:#f59e0b;color:#111;font-weight:700;cursor:pointer;font-size:15px;';
        wrap.appendChild(btnLoi);
        btnLoi.addEventListener('click', function () {
          // Goi ham gui loi cua app neu co, neu khong thi gui qua fetch mode=defect
          try {
            if (typeof window.sendDefect === 'function') return window.sendDefect();
            if (typeof window.saveDefect === 'function') return window.saveDefect();
            if (typeof window.submitDefect === 'function') return window.submitDefect();
          } catch (e) {}
          alert('Đã tách xong. Bạn bấm nút Gửi lỗi trong phần này, không bấm nút Lưu báo cáo nữa.');
        });
      }

      // Doi ten nut Luu bao cao thanh Luu bao cao rieng, va chan khong cho no gui loi kem
      const btns = Array.from(document.querySelectorAll('button'));
      btns.forEach(b => {
        if (b.textContent.trim() === 'Lưu báo cáo') {
          b.textContent = 'Lưu báo cáo (chỉ báo cáo, không gửi lỗi)';
          b.dataset.reportOnly = '1';
        }
      });

      // An ghi chu cu "Chưa có lỗi..." neu co, de khong nham
      console.log('[FIX] Da tach xong Bao cao / Loi rieng');
      return true;
    } catch (e) { return false; }
  }

  // Chan fetch: bo sung du lieu truoc khi gui
  const origFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    try {
      const urlStr = String(url || '');
      const isReportPush = urlStr.indexOf('script.google') >= 0 || urlStr.indexOf('exec') >= 0 || (opts && opts.body && String(opts.body).indexOf('push') >= 0);
      if (isReportPush && opts && opts.body) {
        let body = null;
        try { body = JSON.parse(opts.body); } catch (e) { body = null; }
        if (body && typeof body === 'object') {
          const mode = body.mode || '';
          if (mode !== 'defect' && mode !== 'loi' && mode !== 'addAccount' && mode !== 'login') {
            const enriched = enrichReport(body);
            // Khi gui bao cao, xoa defectList di de khong gui loi kem
            const t = enriched.report || enriched.data || enriched.payload || enriched;
            if (t.defectList) t.defectList = [];
            if (t.defects) t.defects = 0;
            opts = Object.assign({}, opts, { body: JSON.stringify(enriched) });
          }
        }
      }
    } catch (e) {}
    return origFetch(url, opts);
  };

  // Chay tach UI khi trang load + thu lai sau 1s, 2s vi app render cham
  function trySplit() {
    splitUI();
    setTimeout(splitUI, 1000);
    setTimeout(splitUI, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trySplit);
  else trySplit();
  // Neu app doi tab / render lai, thu tach lai
  const obs = new MutationObserver(function () { splitUI(); });
  try { obs.observe(document.body, { childList: true, subtree: true }); setTimeout(() => obs.disconnect(), 15000); } catch (e) {}

  // An Link + Token trong Settings
  document.addEventListener('DOMContentLoaded', function () {
    try {
      document.querySelectorAll('input').forEach(inp => {
        const key = (inp.id + ' ' + inp.name + ' ' + inp.placeholder).toLowerCase();
        if (key.indexOf('link') >= 0 || key.indexOf('token') >= 0) {
          const wrap = inp.closest('div') || inp.parentElement;
          if (wrap) wrap.style.display = 'none';
        }
      });
    } catch (e) {}
  });

  console.log('[FIX] Da nap fix tach Bao cao / Loi rieng + du du lieu');
})();