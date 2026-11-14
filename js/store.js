(function(){
  const DB_NAME='pm_db_v5';
  let dbPromise=null;
  function openDB(){
    if(dbPromise) return dbPromise;
    dbPromise=new Promise((res,rej)=>{
      const req=indexedDB.open(DB_NAME,1);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains('reports')) db.createObjectStore('reports',{keyPath:'id'});
        if(!db.objectStoreNames.contains('orders')) db.createObjectStore('orders',{keyPath:'fp'});
      };
      req.onsuccess=()=>res(req.result);
      req.onerror=()=>rej(req.error);
    });
    return dbPromise;
  }
  window.DB={
    async getAll(store){
      const db=await openDB();
      return new Promise((res,rej)=>{
        const r=db.transaction(store,'readonly').objectStore(store).getAll();
        r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error);
      });
    },
    async put(store,val){
      const db=await openDB();
      return new Promise((res,rej)=>{
        const t=db.transaction(store,'readwrite'); t.objectStore(store).put(val);
        t.oncomplete=res; t.onerror=()=>rej(t.error);
      });
    },
    async delete(store,key){
      const db=await openDB();
      return new Promise((res,rej)=>{
        const t=db.transaction(store,'readwrite'); t.objectStore(store).delete(key);
        t.oncomplete=res; t.onerror=()=>rej(t.error);
      });
    }
  };
  window.store={
    get(k,d){ try{ const v=localStorage.getItem(k); return v===null?d:JSON.parse(v);}catch(e){return d;} },
    set(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true;}catch(e){return false;} }
  };
})();