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
  getDoc,
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

/* ======================= Firebase Config ======================= */
/* Kendi config’ini Firebase Console → Project settings → Your apps → Config’tan AYNI şekilde kopyala */
const firebaseConfig = {
  apiKey: "AIzaSyAkCu5wdApEe5UVnd3xYu83_v2vcphACHY",
  authDomain: "robot-tercih-dkab.firebaseapp.com",
  projectId: "robot-tercih-dkab",
  storageBucket: "robot-tercih-dkab.appspot.com", // appspot.com olmalı
  messagingSenderId: "762577378078",
  appId: "1:762577378078:web:b0b6f07dfd977aff02870f",
  measurementId: "G-C8W1PM0GCP",
};
/* =============================================================== */

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

/* --------------------- Yardımcılar --------------------- */
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

/* ==================== Ana Uygulama ==================== */
export default function App(){
  const [user, setUser] = useState(null);        // auth user
  const [userDoc, setUserDoc] = useState(null);  // Firestore users/{uid}
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const snap = await getDoc(doc(db, "users", u.uid));
        setUserDoc(snap.exists() ? snap.data() : null);
      } else {
        setUserDoc(null);
      }
      setLoadingUser(false);
    });
  }, []);

  if (loadingUser) return <Centered>Yükleniyor…</Centered>;
  if (!user) return <AuthScreen />;                 // Giriş yapılmadı: Giriş/Kayıt ekranı
  if (!userDoc) return <RegisterProfile uid={user.uid} onDone={() => {
    // Kayıt tamamlanınca users/{uid} oluşur, yeniden okuyalım
    getDoc(doc(db, "users", user.uid)).then(snap => setUserDoc(snap.data() || null));
  }} />;

  // Kullanıcı profili var → Tercih Robotu
  return <TercihRobotu currentUser={user} />;
}

/* ------------------- Giriş/Kayıt Ekranı ------------------- */
function AuthScreen(){
  const [tab, setTab] = useState("login"); // 'login' | 'register'
  return (
    <div style={cardWrap}>
      <div style={{display:"flex", gap:8, marginBottom:12}}>
        <button onClick={()=>setTab("login")}   style={tab==="login"?btnPrimary:btnGhost}>Giriş Yap</button>
        <button onClick={()=>setTab("register")} style={tab==="register"?btnPrimary:btnGhost}>Kayıt Ol</button>
      </div>
      {tab==="login" ? <LoginForm/> : <EmailRegister/>}
    </div>
  );
}

function LoginForm(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);

  const handleLogin = async () => {
    try{
      setBusy(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
    }catch(e){ alert(e?.message||e); } finally{ setBusy(false); }
  };

  return (
    <div>
      <h3 style={h3}>Giriş Yap</h3>
      <Input label="E-posta" value={email} onChange={setEmail} />
      <Input label="Şifre" type="password" value={password} onChange={setPassword} />
      <button disabled={busy} onClick={handleLogin} style={btnPrimary}>Giriş</button>
    </div>
  );
}

function EmailRegister(){
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);

  const handleRegister = async () => {
    if (!email.trim() || !password) return alert("E-posta ve şifre gerekli.");
    try{
      setBusy(true);
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      // Kayıt sonrası App kullanıcıyı yakalayacak ve RegisterProfile ekranına geçecek
    }catch(e){ alert(e?.message||e); } finally{ setBusy(false); }
  };

  return (
    <div>
      <h3 style={h3}>Kayıt Ol (Hesap Oluştur)</h3>
      <Input label="E-posta" value={email} onChange={setEmail} />
      <Input label="Şifre" type="password" value={password} onChange={setPassword} />
      <button disabled={busy} onClick={handleRegister} style={btnPrimary}>Hesap Oluştur</button>
      <p style={{fontSize:12, color:"#6b7280", marginTop:8}}>
        Hesabı oluşturduktan sonra kimlik bilgilerinizi doldurmanız istenecek.
      </p>
    </div>
  );
}

/* ------- İlk girişte profil tamamlama (users/{uid}) ------- */
function RegisterProfile({ uid, onDone }){
  const [form, setForm] = useState({
    name:"", phone:"", birthDate:"", tc:"",
    basariPuani:"", atamaPuani:""
  });
  const [busy,setBusy]=useState(false);

  const change = (k,v)=> setForm(s=>({...s, [k]:v}));

  const save = async () => {
    if (!form.name.trim() || !form.tc.trim()) return alert("Ad Soyad ve TC zorunludur.");
    try{
      setBusy(true);
      await setDoc(doc(db,"users",uid),{
        name: form.name.trim(),
        phone: form.phone.trim(),
        birthDate: form.birthDate || null,
        tc: form.tc.trim(),
        basariPuani: form.basariPuani ? parseFloat(form.basariPuani) : null,
        atamaPuani: form.atamaPuani ? parseFloat(form.atamaPuani) : null,
        createdAt: Date.now()
      });
      onDone?.();
    }catch(e){ alert(e?.message||e); } finally{ setBusy(false); }
  };

  return (
    <div style={cardWrap}>
      <h3 style={h3}>Profil Bilgileri</h3>
      <Input label="Ad Soyad" value={form.name} onChange={v=>change("name",v)} />
      <Input label="Telefon" value={form.phone} onChange={v=>change("phone",v)} />
      <Input label="Doğum Tarihi" type="date" value={form.birthDate} onChange={v=>change("birthDate",v)} />
      <Input label="TC" value={form.tc} onChange={v=>change("tc",v)} />
      <Input label="Başarı Puanı" value={form.basariPuani} onChange={v=>change("basariPuani",v)} />
      <Input label="Atama Puanı (küsuratlı)" value={form.atamaPuani} onChange={v=>change("atamaPuani",v)} />
      <div style={{display:"flex", gap:8, marginTop:8}}>
        <button disabled={busy} onClick={save} style={btnPrimary}>Kaydet ve Devam Et</button>
        <button onClick={()=>signOut(auth)} style={btnGhost}>Vazgeç (Çıkış)</button>
      </div>
    </div>
  );
}

/* ===================== Tercih Robotu ===================== */
function TercihRobotu({ currentUser }){
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [seed, setSeed] = useState(42);
  const [isAdmin, setIsAdmin] = useState(false);

  // canlı veriler
  useEffect(()=>{
    const u1=onSnapshot(collection(db,"teachers"),snap=>{
      const arr=[]; snap.forEach(d=>arr.push({id:d.id, ...d.data()})); setTeachers(arr);
    });
    const u2=onSnapshot(collection(db,"schools"),snap=>{
      const arr=[]; snap.forEach(d=>arr.push({id:d.id, ...d.data()})); setSchools(arr);
    });
    const u3=onSnapshot(doc(db,"settings","seed"),d=>{
      const v=d.data(); if(v && typeof v.seed==="number") setSeed(v.seed);
    });
    const u4=onSnapshot(doc(db,"settings","roles"),d=>{
      const v=d.data()||{}; const admins=Array.isArray(v.admins)?v.admins:[]; setIsAdmin(admins.includes(currentUser.uid));
    });
    return ()=>{u1();u2();u3();u4();};
  },[currentUser.uid]);

  const myTeacher = useMemo(()=> teachers.find(t=>t.ownerUid===currentUser.uid) || null, [teachers, currentUser.uid]);
  const assignments = useMemo(()=> simulateAssignments(teachers, schools, seed), [teachers, schools, seed]);
  const schoolMap = useMemo(()=> new Map(schools.map(s=>[s.id,s])), [schools]);
  const assignmentMap = useMemo(()=> new Map(assignments.map(a=>[a.teacherId,a])), [assignments]);

  async function addMyTeacher(name, rank){
    if (teachers.find(t=>t.ownerUid===currentUser.uid)) return alert("Zaten bir öğretmen kaydınız var.");
    const r = Number(rank);
    if (!name?.trim()) return alert("İsim gerekli");
    if (!r || r<=0) return alert("Geçerli bir sıra girin");
    await addDoc(collection(db,"teachers"),{ name:name.trim(), rank:r, preferences:[], ownerUid: currentUser.uid });
  }
  async function updateMyPrefs(prefs){
    if (!myTeacher) return;
    await updateDoc(doc(db,"teachers",myTeacher.id),{ preferences: prefs.slice(0,40) });
  }
  async function deleteTeacher(id){
    if (!isAdmin) return alert("Sadece admin silebilir.");
    if (!confirm("Öğretmen kaydı silinsin mi?")) return;
    await deleteDoc(doc(db,"teachers",id));
  }
  async function setGlobalSeed(newSeed){
    if (!isAdmin) return alert("Seed sadece admin tarafından değiştirilebilir.");
    await setDoc(doc(db,"settings","seed"),{ seed: Number(newSeed)||0 });
  }

  return (
    <div style={{ padding:16, maxWidth:1000, margin:"0 auto" }}>
      <header style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:700 }}>DKAB Tercih Robotu</div>
          <div style={{ fontSize:12, color:"#6b7280" }}>{currentUser.email}</div>
        </div>
        <button onClick={()=>signOut(auth)} style={btnGhost}>Çıkış</button>
      </header>

      <section style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
        <label>Seed:</label>
        <input type="number" value={seed} onChange={e=>setGlobalSeed(e.target.value)} disabled={!isAdmin}
          style={{ width:120, padding:"6px 8px", border:"1px solid #d1d5db", borderRadius:6 }} />
        <button onClick={()=>setGlobalSeed(Math.floor(Date.now()%100000))} disabled={!isAdmin} style={btnGhost}>
          Rastgele Seed
        </button>
        {!isAdmin && <span style={{ fontSize:12, color:"#9ca3af" }}>Seed’i yalnızca admin değiştirebilir.</span>}
      </section>

      {!myTeacher ? <NewTeacherForm onCreate={addMyTeacher}/> : <PreferenceEditor teacher={myTeacher} schools={schools} onChange={updateMyPrefs} />}

      <section style={{ marginTop:24 }}>
        <h3 style={h3}>Yerleştirme Sonuçları</h3>
        <div style={{ overflowX:"auto", border:"1px solid #e5e7eb", borderRadius:8 }}>
          <table style={{ width:"100%", fontSize:14 }}>
            <thead style={{ background:"#f3f4f6" }}>
              <tr>
                <th style={th}>Sıra</th><th style={th}>Ad Soyad</th><th style={th}>Okul</th><th style={th}>İl</th><th style={th}>Yöntem</th>{isAdmin && <th style={{...th, textAlign:"right"}}>İşlem</th>}
              </tr>
            </thead>
            <tbody>
              {[...teachers].sort((a,b)=>(a.rank-b.rank)||a.name.localeCompare(b.name,"tr")).map(t=>{
                const a=assignmentMap.get(t.id); const sch=a?.schoolId?schoolMap.get(a.schoolId):null;
                return (
                  <tr key={t.id} style={{ borderTop:"1px solid #e5e7eb" }}>
                    <td style={td}>{t.rank}</td>
                    <td style={td}>{t.name}</td>
                    <td style={td}>{sch?.name || "—"}</td>
                    <td style={td}>{sch?.province || "—"}</td>
                    <td style={td}>{a?.method==="preference" ? "Tercih" : a?.method==="random" ? "Rastgele" : "Boşta"}{a?.matchIndex!=null ? ` • ${a.matchIndex+1}. tercih` : ""}</td>
                    {isAdmin && (
                      <td style={{...td, textAlign:"right"}}>
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

/* -------------------- Alt Bileşenler -------------------- */
function NewTeacherForm({ onCreate }){
  const [name,setName]=useState("");
  const [rank,setRank]=useState("");
  return (
    <section style={{ border:"1px solid #e5e7eb", borderRadius:8, padding:12 }}>
      <h3 style={h3}>Kendi Kaydınızı Oluşturun</h3>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        <Input label="Ad Soyad" value={name} onChange={setName} />
        <Input label="Sıra (örn. 1)" value={rank} onChange={setRank} />
        <button onClick={()=>onCreate(name, Number(rank))} style={btnPrimary}>Ekle</button>
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
      <h3 style={h3}>{teacher.name} — Sıra: {teacher.rank}</h3>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr auto", gap:8 }}>
        <select value={prov} onChange={e=>setProv(e.target.value)} style={inputStyle}>
          <option value="">İl seçin…</option>
          {PROVINCES.map(p=><option key={p} value={p}>{p}</option>)}
        </select>
        <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Okul ara" style={inputStyle}/>
        <select value={sel} onChange={e=>setSel(e.target.value)} style={inputStyle}>
          <option value="">Okul seçin…</option>
          {filteredSchools.map(s=><option key={s.id} value={s.id}>{s.name} ({s.province})</option>)}
        </select>
        <button onClick={add} style={btnPrimary}>Ekle</button>
      </div>

      <div style={{ marginTop:12, overflowX:"auto", border:"1px solid #e5e7eb", borderRadius:8 }}>
        <table style={{ width:"100%", fontSize:14 }}>
          <thead style={{ background:"#f3f4f6" }}>
            <tr><th style={th}>#</th><th style={th}>Okul</th><th style={th}>İl</th><th style={{...th, textAlign:"right"}}>İşlem</th></tr>
          </thead>
          <tbody>
            {(teacher.preferences||[]).map((sid,i)=>{
              const sc=schools.find(s=>s.id===sid);
              return (
                <tr key={sid} style={{ borderTop:"1px solid #e5e7eb" }}>
                  <td style={td}>{i+1}</td>
                  <td style={td}>{sc?.name||sid}</td>
                  <td style={td}>{sc?.province||"—"}</td>
                  <td style={{...td, textAlign:"right", whiteSpace:"nowrap"}}>
                    <button onClick={()=>up(i)} style={btnGhost}>Yukarı</button>
                    <button onClick={()=>down(i)} style={btnGhost}>Aşağı</button>
                    <button onClick={()=>remove(sid)} style={{ padding:"4px 8px", background:"#fee2e2", color:"#991b1b", borderRadius:6, marginLeft:6 }}>Kaldır</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ fontSize:12, color:"#6b7280", marginTop:6 }}>En fazla 40 tercih ekleyebilirsiniz.</div>
      <div style={{ marginTop:8 }}>
        <button onClick={clearAll} style={btnGhost}>Tüm Tercihleri Temizle</button>
      </div>
    </section>
  );
}

/* -------------------- UI yardımcıları -------------------- */
function Centered({children}){ return <div style={{minHeight:"60vh",display:"grid",placeItems:"center"}}>{children}</div>; }
const h3 = { fontWeight:600, marginBottom:8 };
const inputStyle = { padding:"8px 10px", border:"1px solid #d1d5db", borderRadius:6 };
const th = { textAlign:"left", padding:8 };
const td = { padding:8 };
const cardWrap = { maxWidth:420, margin:"32px auto", padding:16, border:"1px solid #e5e7eb", borderRadius:12 };
const btnPrimary = { padding:"8px 12px", background:"#4f46e5", color:"white", borderRadius:8, border:"none", cursor:"pointer" };
const btnGhost = { padding:"6px 10px", background:"#e5e7eb", borderRadius:8, border:"none", cursor:"pointer" };

function Input({label, type="text", value, onChange}) {
  return (
    <div style={{marginBottom:8}}>
      <div style={{fontSize:12, color:"#6b7280", marginBottom:4}}>{label}</div>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} style={inputStyle} />
    </div>
  );
}
