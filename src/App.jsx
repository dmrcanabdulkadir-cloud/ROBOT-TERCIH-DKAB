import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
// (İsteğe bağlı) Analytics – tarayıcıda ve measurementId varsa çalıştıracağız
import { getAnalytics } from "firebase/analytics";

// ---------------- Firebase Config (Console’daki “Config”ten birebir kopyala) ----------------
const firebaseConfig = {
  apiKey: "AIzaSyAkCu5wdApEe5UVnd3xYu83_v2vcphACHY",
  authDomain: "robot-tercih-dkab.firebaseapp.com",
  projectId: "robot-tercih-dkab",
  // DİKKAT: Console’da ne yazıyorsa onu kullan. Genelde ...appspot.com olur:
  storageBucket: "robot-tercih-dkab.appspot.com",
  messagingSenderId: "762577378078",
  appId: "1:762577378078:web:b0b6f07dfd977aff02870f",
  measurementId: "G-C8W1PM0GCP",
};

// ---------------- Firebase Init (TEK KEZ) ----------------
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
// Analytics’i yalnızca tarayıcıda ve measurementId varsa çalıştır
if (typeof window !== "undefined" && firebaseConfig.measurementId) {
  try { getAnalytics(app); } catch {}
}

// ---------------- Yardımcılar ----------------
const PROVINCES = [
  "Adana","Adıyaman","Afyonkarahisar","Ağrı","Aksaray","Amasya","Ankara","Antalya","Ardahan","Artvin","Aydın","Balıkesir","Bartın","Batman","Bayburt","Bilecik","Bingöl","Bitlis","Bolu","Burdur","Bursa","Çanakkale","Çankırı","Çorum","Denizli","Diyarbakır","Düzce","Edirne","Elazığ","Erzincan","Erzurum","Eskişehir","Gaziantep","Giresun","Gümüşhane","Hakkari","Hatay","Iğdır","Isparta","İstanbul","İzmir","Kahramanmaraş","Karabük","Karaman","Kars","Kastamonu","Kayseri","Kilis","Kırıkkale","Kırklareli","Kırşehir","Kocaeli","Konya","Kütahya","Malatya","Manisa","Mardin","Mersin","Muğla","Muş","Nevşehir","Niğde","Ordu","Osmaniye","Rize","Sakarya","Samsun","Şanlıurfa","Siirt","Sinop","Sivas","Şırnak","Tekirdağ","Tokat","Trabzon","Tunceli","Uşak","Van","Yalova","Yozgat","Zonguldak"
];

function mulberry32(a){return function(){let t=(a+=0x6d2b79f5);t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function seededShuffle(array,seed){const rand=mulberry32(seed||42);for(let i=array.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[array[i],array[j]]=[array[j],array[i]];}}
function simulateAssignments(teachers, schools, seed){
  const remain=new Map(); schools.forEach(s=>remain.set(s.id, Number(s.quota)||0));
  const sorted=[...teachers].sort((a,b)=>(a.rank-b.rank)||a.name.localeCompare(b.name,"tr"));
  const out=[];
  for(const t of sorted){
    let placed=null; const prefs=Array.isArray(t.preferences)?t.preferences.slice(0,40):[];
    for(let i=0;i<prefs.length;i++){const sid=prefs[i];const r=remain.get(sid)??0;if(r>0){remain.set(sid,r-1);placed={teacherId:t.id,schoolId:sid,method:"preference",matchIndex:i};break;}}
    if(!placed) out.push({teacherId:t.id,schoolId:null,method:"none",matchIndex:null}); else out.push(placed);
  }
  const seats=[]; for(const s of schools){const r=remain.get(s.id)??0; for(let i=0;i<r;i++) seats.push(s.id);}
  seededShuffle(seats,seed);
  for(let i=0;i<out.length;i++){const a=out[i]; if(a.method==="none"&&a.schoolId===null){const seat=seats.pop(); if(seat) out[i]={...a,schoolId:seat,method:"random"};}}
  return out;
}

export default function App(){
  const [user,setUser]=useState(null);
  const [teachers,setTeachers]=useState([]);
  const [schools,setSchools]=useState([]);
  const [seed,setSeed]=useState(42);
  const [isAdmin,setIsAdmin]=useState(false);

  useEffect(()=>onAuthStateChanged(auth,setUser),[]);

  useEffect(()=>{
    const unsubTeachers=onSnapshot(collection(db,"teachers"),snap=>{
      const arr=[]; snap.forEach(d=>arr.push({id:d.id,...d.data()})); setTeachers(arr);
    });
    const unsubSchools=onSnapshot(collection(db,"schools"),snap=>{
      const arr=[]; snap.forEach(d=>arr.push({id:d.id,...d.data()})); setSchools(arr);
    });
    const unsubSeed=onSnapshot(doc(db,"settings","seed"),d=>{
      const v=d.data(); if(v && typeof v.seed==="number") setSeed(v.seed);
    });
    return ()=>{unsubTeachers();unsubSchools();unsubSeed();};
  },[]);

  useEffect(()=>{
    if(!user){setIsAdmin(false);return;}
    return onSnapshot(doc(db,"settings","roles"),d=>{
      const v=d.data()||{}; const admins=Array.isArray(v.admins)?v.admins:[]; setIsAdmin(admins.includes(user.uid));
    });
  },[user]);

  const myTeacher=useMemo(()=>user?teachers.find(t=>t.ownerUid===user.uid):null,[teachers,user]);
  const assignments=useMemo(()=>simulateAssignments(teachers,schools,seed),[teachers,schools,seed]);
  const schoolMap=useMemo(()=>new Map(schools.map(s=>[s.id,s])),[schools]);
  const assignmentMap=useMemo(()=>new Map(assignments.map(a=>[a.teacherId,a])),[assignments]);

  const provider=new GoogleAuthProvider();
  async function signInWithGoogle(){try{await signInWithPopup(auth,provider);}catch(e){alert(e?.message||e);}}

  async function addMyTeacher(name,rank){
    if(!user) return alert("Giriş yapın");
    if(teachers.find(t=>t.ownerUid===user.uid)) return alert("Zaten bir öğretmen kaydınız var.");
    const r=Number(rank);
    if(!name?.trim()) return alert("İsim gerekli");
    if(!r||r<=0) return alert("Geçerli bir sıra girin (1,2,3..)");
    await addDoc(collection(db,"teachers"),{name:name.trim(),rank:r,preferences:[],ownerUid:user.uid});
  }
  async function updateMyPrefs(prefs){
    if(!myTeacher) return;
    await updateDoc(doc(db,"teachers",myTeacher.id),{preferences:prefs.slice(0,40)});
  }
  async function deleteTeacher(id){
    if(!isAdmin) return alert("Sadece admin silebilir.");
    if(!confirm("Öğretmen kaydı silinsin mi?")) return;
    await deleteDoc(doc(db,"teachers",id));
  }
  async function setGlobalSeed(newSeed){
    if(!isAdmin) return alert("Seed sadece admin tarafından değiştirilebilir.");
    await setDoc(doc(db,"settings","seed"),{seed:Number(newSeed)||0});
  }

  return (
    <div style={{ padding:16, maxWidth:1000, margin:"0 auto", fontFamily:"system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial" }}>
      <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:12, marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>DKAB Tercih Robotu (Canlı)</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>Google ile giriş yapın; herkes yalnızca kendi öğretmen kaydını düzenler.</div>
        </div>
        {!user ? (
          <button onClick={signInWithGoogle} style={{ padding:"8px 12px", background:"#111827", color:"white", borderRadius:8 }}>Google ile Giriş</button>
        ) : (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:12, color:"#4b5563" }}>{user.displayName || user.email}</span>
            <button onClick={()=>signOut(auth)} style={{ padding:"6px 10px", background:"#e5e7eb", borderRadius:8 }}>Çıkış</button>
          </div>
        )}
      </header>

      <section style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <label>Seed:</label>
        <input type="number" value={seed} onChange={e=>setGlobalSeed(e.target.value)} disabled={!isAdmin}
          style={{ width:120, padding:"6px 8px", border:"1px solid #d1d5db", borderRadius:6 }} />
        <button onClick={()=>setGlobalSeed(Math.floor(Date.now()%100000))} disabled={!isAdmin}
          style={{ padding:"6px 10px", background:"#e5e7eb", borderRadius:8 }}>
          Rastgele Seed
        </button>
        {!isAdmin && <span style={{ fontSize:12, color:"#9ca3af" }}>Seed’i yalnızca admin değiştirebilir.</span>}
      </section>

      {!myTeacher ? <NewTeacherForm onCreate={addMyTeacher} /> : <PreferenceEditor teacher={myTeacher} schools={schools} onChange={updateMyPrefs} />}

      <section style={{ marginTop:24 }}>
        <h3 style={{ fontWeight:600, marginBottom:8 }}>Yerleştirme Sonuçları</h3>
        <div style={{ overflowX:"auto", border:"1px solid #e5e7eb", borderRadius:8 }}>
          <table style={{ width:"100%", fontSize:14 }}>
            <thead style={{ background:"#f3f4f6" }}>
              <tr>
                <th style={{ textAlign:"left", padding:8 }}>Sıra</th>
                <th style={{ textAlign:"left", padding:8 }}>Ad Soyad</th>
                <th style={{ textAlign:"left", padding:8 }}>Okul</th>
                <th style={{ textAlign:"left", padding:8 }}>İl</th>
                <th style={{ textAlign:"left", padding:8 }}>Yöntem</th>
                {isAdmin && <th style={{ textAlign:"right", padding:8 }}>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {[...teachers].sort((a,b)=>(a.rank-b.rank)||a.name.localeCompare(b.name,"tr")).map(t=>{
                const a=assignmentMap.get(t.id); const sch=a?.schoolId?schoolMap.get(a.schoolId):null;
                return (
                  <tr key={t.id} style={{ borderTop:"1px solid #e5e7eb" }}>
                    <td style={{ padding:8 }}>{t.rank}</td>
                    <td style={{ padding:8 }}>{t.name}</td>
                    <td style={{ padding:8 }}>{sch?.name || "—"}</td>
                    <td style={{ padding:8 }}>{sch?.province || "—"}</td>
                    <td style={{ padding:8 }}>
                      {a?.method==="preference" ? "Tercih" : a?.method==="random" ? "Rastgele" : "Boşta"}
                      {a?.matchIndex!=null ? ` • ${a.matchIndex+1}. tercih` : ""}
                    </td>
                    {isAdmin && (
                      <td style={{ padding:8, textAlign:"right" }}>
                        <button onClick={()=>deleteTeacher(t.id)} style={{ padding:"4px 8px", fontSize:12, background:"#fee2e2", color:"#991b1b", borderRadius:6 }}>Sil</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function NewTeacherForm({ onCreate }){
  const [name,setName]=useState("");
  const [rank,setRank]=useState("");
  return (
    <section style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:12 }}>
      <h3 style={{ fontWeight:600, marginBottom:8 }}>Kendi Kaydınızı Oluşturun</h3>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ad Soyad"
          style={{ padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6, flex:"1 1 220px" }} />
        <input value={rank} onChange={e=>setRank(e.target.value)} placeholder="Sıra (örn. 1)"
          style={{ padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6, width:140 }} />
        <button onClick={()=>onCreate(name, Number(rank))}
          style={{ padding:"8px 12px", background:"#4f46e5", color:"white", borderRadius:8 }}>Ekle</button>
      </div>
      <div style={{ fontSize:12, color:"#6b7280", marginTop:6 }}>Her kullanıcı yalnızca 1 öğretmen kaydı oluşturabilir.</div>
    </section>
  );
}

function PreferenceEditor({ teacher, schools, onChange }){
  const [prov,setProv]=useState(""); const [query,setQuery]=useState(""); const [sel,setSel]=useState("");
  const filteredSchools=useMemo(()=>{
    const q=query.trim().toLowerCase();
    return schools.filter(s =>
      (!prov || s.province===prov) &&
      (!q || String(s.name).toLowerCase().includes(q)) &&
      !(teacher.preferences||[]).includes(s.id)
    );
  },[schools,prov,query,teacher.preferences]);

  const add=()=>{ if(sel && !(teacher.preferences||[]).includes(sel)) onChange([...(teacher.preferences||[]), sel]); setSel(""); };
  const remove=sid=> onChange((teacher.preferences||[]).filter(p=>p!==sid));
  const up=idx=>{ const prefs=[...(teacher.preferences||[])]; if(idx<=0) return; [prefs[idx-1],prefs[idx]]=[prefs[idx],prefs[idx-1]]; onChange(prefs); };
  const down=idx=>{ const prefs=[...(teacher.preferences||[])]; if(idx>=prefs.length-1) return; [prefs[idx+1],prefs[idx]]=[prefs[idx],prefs[idx+1]]; onChange(prefs); };
  const clearAll=()=>{ if(confirm("Tüm tercihleri temizlemek istiyor musunuz?")) onChange([]); };

  return (
    <section style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:12 }}>
      <h3 style={{ fontWeight:600, marginBottom:8 }}>{teacher.name} — Sıra: {teacher.rank}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:8 }}>
        <select value={prov} onChange={e=>setProv(e.target.value)} style={{ padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6 }}>
          <option value="">İl seçin…</option>
          {PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Okul ara"
          style={{ padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6 }} />
        <select value={sel} onChange={e=>setSel(e.target.value)} style={{ padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6 }}>
          <option value="">Okul seçin…</option>
          {filteredSchools.map(s=><option key={s.id} value={s.id}>{s.name} ({s.province})</option>)}
        </select>
        <button onClick={add} style={{ padding:"8px 12px", background:"#4f46e5", color:"white", borderRadius:8 }}>Ekle</button>
      </div>

      <div style={{ marginTop:12, overflowX:"auto", border:"1px solid #e5e7eb", borderRadius:8 }}>
        <table style={{ width:"100%", fontSize:14 }}>
          <thead style={{ background:"#f3f4f6" }}>
            <tr>
              <th style={{ textAlign:"left", padding:8, width:40 }}>#</th>
              <th style={{ textAlign:"left", padding:8 }}>Okul</th>
              <th style={{ textAlign:"left", padding:8 }}>İl</th>
              <th style={{ textAlign:"right", padding:8 }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {(teacher.preferences||[]).map((sid,i)=>{
              const sc=schools.find(s=>s.id===sid);
              return (
                <tr key={sid} style={{ borderTop:"1px solid #e5e7eb" }}>
                  <td style={{ padding:8 }}>{i+1}</td>
                  <td style={{ padding:8 }}>{sc?.name||sid}</td>
                  <td style={{ padding:8 }}>{sc?.province||"—"}</td>
                  <td style={{ padding:8, textAlign:"right", whiteSpace:"nowrap" }}>
                    <button onClick={()=>up(i)} style={{ padding:"4px 8px", background:"#e5e7eb", borderRadius:6, marginRight:6 }}>Yukarı</button>
                    <button onClick={()=>down(i)} style={{ padding:"4px 8px", background:"#e5e7eb", borderRadius:6, marginRight:6 }}>Aşağı</button>
                    <button onClick={()=>remove(sid)} style={{ padding:"4px 8px", background:"#fee2e2", color:"#991b1b", borderRadius:6 }}>Kaldır</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize:12, color:"#6b7280", marginTop:6 }}>En fazla 40 tercih ekleyebilirsiniz.</div>
      <div style={{ marginTop:8 }}>
        <button onClick={clearAll} style={{ padding:"6px 10px", background:"#e5e7eb", borderRadius:8 }}>Tüm Tercihleri Temizle</button>
      </div>
    </section>
  );
}
