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
      box.appendChild(d);
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
})();// 4. CUON RIENG CHO TAB DON HANG - 1 DON HANG = 2 DONG NEN PHAI TINH RIENG
(function cuonDonHang() {
  function lam() {
    document.querySelectorAll('table').forEach(tbl => {
      const text = tbl.innerText || '';
      // Chi lam cho bang Don hang: co chu FPNR + MONT + PRUEF
      if (!text.includes('FPNR') || !text.includes('MONT')) return;
      if (tbl.closest('.pm-scroll-donhang')) return;
      // Tim khung chua bang
      let wrap = tbl.parentElement;
      // Tao khung cuon rieng cho Don hang
      const div = document.createElement('div');
      div.className = 'pm-scroll-donhang';
      div.style.cssText = 'max-height:210px !important; overflow-y:auto !important; overflow-x:auto !important; display:block !important; border-radius:10px;';
      tbl.parentNode.insertBefore(div, tbl);
      div.appendChild(tbl);
      // Cho dong tieu de dinh o tren khi cuon
      tbl.querySelectorAll('thead th').forEach(th => {
        th.style.position = 'sticky';
        th.style.top = '0';
        th.style.zIndex = '3';
        th.style.background = '#1a2a3a';
      });
      // Cho dong Tong dinh o duoi khi cuon
      const rows = tbl.querySelectorAll('tbody tr, tfoot tr, tr');
      rows.forEach(tr => {
        if ((tr.innerText || '').includes('Tổng')) {
          tr.querySelectorAll('td, th').forEach(td => {
            td.style.position = 'sticky';
            td.style.bottom = '0';
            td.style.zIndex = '3';
            td.style.background = '#1a2a3a';
            td.style.fontWeight = 'bold';
          });
        }
      });
    });
    // Them CSS cuon cho Don hang
    if (!document.getElementById('css-donhang')) {
      const st = document.createElement('style');
      st.id = 'css-donhang';
      st.textContent = '.pm-scroll-donhang::-webkit-scrollbar{width:6px;height:6px} .pm-scroll-donhang::-webkit-scrollbar-thumb{background:#3a4a5a;border-radius:10px} .pm-scroll-donhang table{width:100% !important;}';
      document.head.appendChild(st);
    }
  }
  // Chay ngay + chay lai khi ban doi Line / loc / chuyen tab
  lam();
  setTimeout(lam, 1000);
  setTimeout(lam, 2000);
  const obs = new MutationObserver(() => lam());
  obs.observe(document.body, { childList: true, subtree: true });
  document.addEventListener('click', () => setTimeout(lam, 500));
})();// 5. TACH NHAP LIEU: BAO CAO RIENG + LOI RIENG
(function tachNhapLieu() {
  function lam() {
    const btnLuu = [...document.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'Lưu báo cáo');
    if (!btnLuu) return;
    if (btnLuu.dataset.daTach) return;
    btnLuu.dataset.daTach = '1';
    // Doi ten nut cu thanh Luu bao cao rieng
    btnLuu.textContent = '💾 Lưu báo cáo (không gửi lỗi)';
    btnLuu.style.background = '#1a8cff';
    // Tao nut Gui loi rieng ngay duoi nut Luu bao cao
    const btnLoi = document.createElement('button');
    btnLoi.type = 'button';
    btnLoi.textContent = '⚠️ Gửi lỗi riêng (không cần báo cáo)';
    btnLoi.style.cssText = 'width:100%;margin-top:8px;padding:12px;border-radius:10px;border:0;background:#e8a020;color:#fff;font-weight:bold;cursor:pointer;font-size:15px';
    btnLuu.parentNode.insertBefore(btnLoi, btnLuu.nextSibling);
    // Ghi chu cho cong nhan hieu
    const note = document.createElement('div');
    note.style.cssText = 'margin-top:6px;font-size:12px;opacity:.7;text-align:center';
    note.textContent = 'Không có lỗi thì chỉ bấm Lưu báo cáo. Có lỗi mới bấm Gửi lỗi riêng.';
    btnLoi.parentNode.insertBefore(note, btnLoi.nextSibling);

    btnLoi.addEventListener('click', async () => {
      // Lay thong tin chung: Ngay, Ca, Line, Team Lead, FPNR tu cac o nhap tren form
      const getVal = (label) => {
        const el = [...document.querySelectorAll('input, select')].find(e => {
          const lb = e.closest('div')?.previousElementSibling?.textContent || '';
          return (e.placeholder || '').includes(label) || lb.includes(label);
        });
        return el ? el.value : '';
      };
      const date = document.querySelector('input[type="date"]')?.value || new Date().toISOString().slice(0, 10);
      const allInputs = [...document.querySelectorAll('input, select')];
      // Tim o Loi: o co chu Ma loi / Ten loi / So luong loi
      const allText = document.body.innerText || '';
      // Lay du lieu loi tu form: tim cac o nhap trong phan 3. Loi
      const loiSection = [...document.querySelectorAll('*')].find(el => (el.textContent || '').trim().startsWith('3. Lỗi'));
      let defectData = [];
      if (loiSection) {
        const box = loiSection.parentElement;
        const ins = box ? [...box.querySelectorAll('input, select')] : [];
        // ins[0]=Nhan vien loi, ins[1]=Ma loi, ins[2]=So luong
        if (ins.length >= 3) {
          defectData = [{ worker: ins[0].value || '', name: ins[1].value || '', qty: Number(ins[2].value || 0) || 0 }];
        }
      }
      if (!defectData.length || !defectData[0].qty) {
        alert('❌ Bạn chưa nhập Số lượng lỗi. Nhập Số lượng rồi mới bấm Gửi lỗi riêng.');
        return;
      }
      const link = (localStorage.getItem('pm_push_url') || '').replace(/"/g, '').trim();
      const token = (localStorage.getItem('pm_push_token') || '').replace(/"/g, '').trim();
      if (!link || !token) { alert('❌ Chưa có Link + Token'); return; }
      btnLoi.textContent = 'Đang gửi lỗi...'; btnLoi.disabled = true;
      try {
        const q = new URLSearchParams({
          mode: 'defect', token,
          date: date,
          defectList: JSON.stringify(defectData)
        });
        const res = await fetch(link + '?' + q.toString());
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || 'Không gửi được');
        alert('✅ Đã gửi lỗi riêng lên tab Lỗi! Bạn không cần gửi lại báo cáo.');
      } catch (e) {
        alert('❌ Chưa gửi lỗi được: ' + e.message);
      } finally {
        btnLoi.textContent = '⚠️ Gửi lỗi riêng (không cần báo cáo)';
        btnLoi.disabled = false;
      }
    });
  }
  const obs = new MutationObserver(() => lam());
  obs.observe(document.body, { childList: true, subtree: true });
  lam();
  setTimeout(lam, 1000);
})();