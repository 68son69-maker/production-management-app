(function(){
  'use strict';
  const ACCOUNTS_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSMJYnJ9kIR3DBgEQOag2Sk4ERaa5g9pRgoktySd2wMTvr8er8dfnt-UK6lsJnnp37SERJFVdV1a4h9/pub?gid=0&single=true&output=csv';
  window.remoteAccounts = [];
  const _toBool = v => /true|1/i.test(String(v||'').trim());
  async function syncRemoteAccounts(){
    try{
      const res = await fetch(ACCOUNTS_CSV_URL, {cache:'no-store'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const rows = csvRows(await res.text());
      console.log('[PM] Sheet raw rows:', rows.length, rows.slice(0,3));
      window.remoteAccounts = rows.slice(1).map(r=>({
        user:(r[0]||'').trim(),
        pw:String(r[1]||'').trim(),
        blocked:_toBool(r[2]),
        perms:{ dash:_toBool(r[3]), report:_toBool(r[4]), perf:_toBool(r[5]), orders:_toBool(r[6]), harness:_toBool(r[7]), export:_toBool(r[8]), del:_toBool(r[9]), hedit:_toBool(r[10]) }
      })).filter(a=>a.user && a.pw);
      console.log('[PM] remoteAccounts:', window.remoteAccounts);
      return window.remoteAccounts;
    }catch(e){
      console.log('[PM] LOI TAI SHEET:', e);
      if($('lgMsg')) $('lgMsg').textContent = '❌ Không tải được Sheet tài khoản. Kiểm tra link Sheet đã Publish chưa! Lỗi: '+e.message;
      return [];
    }
  }
  window.syncRemoteAccounts = syncRemoteAccounts;

  // 1. XOA NUT CU DE XOA LUON HANDLER CU (nguyen nhan chinh gay loi)
  const oldBtn = document.getElementById('btnLogin');
  const newBtn = oldBtn.cloneNode(true);
  oldBtn.parentNode.replaceChild(newBtn, oldBtn);
  console.log('[PM] Da thay nut Dang nhap moi - handler cu da bi xoa');

  const params = new URLSearchParams(location.search);
  const canSetup = params.get('setup_admin') === '1';

  // 2. Chi hien man hinh Dang nhap dung 1 lan, KHONG dung setInterval xoa msg nua
  const hasAdminNow = () => { try{ return !!adminHash(); }catch(e){ return false; } };
  if(!hasAdminNow() && !canSetup){
    const t=$('lgTitle'), h=$('lgHint'), uf=$('lgUserF'), pf=$('lgPass2F');
    if(t) t.textContent='Đăng nhập';
    if(h) h.textContent='Đăng nhập bằng tài khoản trong Sheet. Liên hệ Admin nếu chưa có.';
    if(uf) uf.style.display='';
    if(pf) pf.style.display='none';
    newBtn.textContent='Đăng nhập';
  }

  async function tryLeadLogin(u, p){
    const list = await syncRemoteAccounts();
    if(!list.length){ if($('lgMsg')) $('lgMsg').textContent='❌ Sheet tài khoản trống hoặc chưa tải được. Xem Console (F12) dòng [PM]'; return; }
    const a = list.find(x=>x.user.toLowerCase()===u.toLowerCase());
    if(!a){ if($('lgMsg')) $('lgMsg').textContent='❌ Không thấy "'+u+'" trong Sheet. Sheet đang có: '+list.map(x=>x.user).join(', '); return; }
    if(String(p).trim() !== String(a.pw).trim()){
      if($('lgMsg')) $('lgMsg').textContent='❌ Sai mật khẩu. Bạn nhập "'+p+'" nhưng trong Sheet của "'+a.user+'" là "'+a.pw+'"';
      return;
    }
    if(a.blocked){ if($('lgMsg')) $('lgMsg').textContent='❌ Tài khoản đã bị BLOCKED=TRUE trong Sheet'; return; }
    session = {user:a.user, role:'lead'};
    try{
      const ex = accounts.find(x=>x.user.toLowerCase()===a.user.toLowerCase());
      if(ex){ ex.hash=a.pw; ex.blocked=a.blocked; ex.perms={...a.perms}; }
      else accounts.push({user:a.user, hash:a.pw, perms:{...a.perms}, blocked:a.blocked});
      if(typeof saveAcc==='function') saveAcc();
    }catch(e){}
    if(typeof finishLogin==='function') finishLogin();
  }

  // 3. Nut moi: chi 1 handler duy nhat
  newBtn.addEventListener('click', async ()=>{
    const u = ($('lgUser')?.value||'').trim();
    const p = $('lgPass')?.value||'';
    $('lgMsg').textContent = '';
    // Chua co Admin + khong phai link setup -> chi cho login Lead
    if(!hasAdminNow() && !canSetup){
      if(!u || !p){ $('lgMsg').textContent='❌ Nhập tên và mật khẩu'; return; }
      if(/^admin$/i.test(u)){ $('lgMsg').textContent='❌ Chưa có Admin. Mở link ?setup_admin=1 để tạo Admin.'; return; }
      await tryLeadLogin(u,p);
      return;
    }
    // Da co Admin
    if(!hasAdminNow()){
      // Link setup_admin=1: tao Admin
      if(p.length < 4){ $('lgMsg').textContent='❌ Mật khẩu tối thiểu 4 ký tự'; return; }
      if(p !== $('lgPass2').value){ $('lgMsg').textContent='❌ Hai mật khẩu không khớp'; return; }
      store.set('pm_admin_hash', await sha256('Admin', p));
      session = {user:'Admin', role:'admin'};
      finishLogin();
      return;
    }
    if(/^admin$/i.test(u)){
      const h = await sha256('Admin', p);
      if(h !== adminHash()){ $('lgMsg').textContent='❌ Sai mật khẩu Admin'; return; }
      session = {user:'Admin', role:'admin'};
      finishLogin();
      return;
    }
    // Lead khi da co Admin
    if(!u || !p){ $('lgMsg').textContent='❌ Nhập tên và mật khẩu'; return; }
    await tryLeadLogin(u,p);
  });
  ['lgUser','lgPass','lgPass2'].forEach(id=>{
    const el = document.getElementById(id);
    if(el){
      const n = el.cloneNode(true);
      el.parentNode.replaceChild(n, el);
      n.addEventListener('keydown', e=>{ if(e.key==='Enter') newBtn.click(); });
    }
  });

  // 4. Kiem tra session cu: neu Lead khong con trong Sheet hoac bi BLOCKED thi out
  syncRemoteAccounts().then(()=>{
    try{
      if(session && session.role!=='admin'){
        const a = window.remoteAccounts.find(x=>x.user.toLowerCase()===String(session.user||'').toLowerCase());
        if(!a || a.blocked){
          session=null; store.set('pm_session', null);
          if(typeof applyAccess==='function') applyAccess();
          if(typeof renderLogin==='function') renderLogin();
        } else {
          const ex = accounts.find(x=>x.user.toLowerCase()===a.user.toLowerCase());
          if(ex){ ex.perms={...a.perms}; ex.blocked=a.blocked; }
          else accounts.push({user:a.user, hash:a.pw, perms:{...a.perms}, blocked:a.blocked});
          if(typeof applyAccess==='function') applyAccess();
        }
      }
    }catch(e){}
  });
})();
