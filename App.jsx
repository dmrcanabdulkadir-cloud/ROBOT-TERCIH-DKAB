import React, { useEffect, useMemo, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  addDoc,
  deleteDoc,
  updateDoc,
  writeBatch,
  setDoc
} from "firebase/firestore";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

// --- Firebase Config ---
// TODO: Fill these with your Firebase project's web app config (Firebase Console → Project settings → General → Your apps).
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Kullanıcı kendi öğretmen kaydını oluşturmalı → kayıt ownerUid ile işaretlenir
// Teachers: { name, rank, preferences, ownerUid }

// ==== Simülasyon fonksiyonu ====
function mulberry32(a) { return function () { let t = (a += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function seededShuffle(array, seed) { const rand = mulberry32(seed); for (let i = array.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [array[i], array[j]] = [array[j], array[i]]; } }
function simulateAssignments(teachers, schools, seed) {
  const remain = new Map(); schools.forEach((s) => remain.set(s.id, Number(s.quota) || 0));
  const sortedTeachers = [...teachers].sort((a, b) => (a.rank - b.rank) || a.name.localeCompare(b.name, "tr"));
  const out = [];
  for (const t of sortedTeachers) {
    let placed = null; const prefs = Array.isArray(t.preferences) ? t.preferences.slice(0, 40) : [];
    for (let i = 0; i < prefs.length; i++) { const sid = prefs[i]; const r = remain.get(sid) ?? 0; if (r > 0) { remain.set(sid, r - 1); placed = { teacherId: t.id, schoolId: sid, method: "preference", matchIndex: i }; break; } }
    if (!placed) out.push({ teacherId: t.id, schoolId: null, method: "none", matchIndex: null }); else out.push(placed);
  }
  const seats = []; for (const s of schools) { const r = remain.get(s.id) ?? 0; for (let i = 0; i < r; i++) seats.push(s.id); }
  if (seats.length) seededShuffle(seats, seed || 42);
  for (let i = 0; i < out.length; i++) { const a = out[i]; if (a.method === "none" && a.schoolId === null) { const seat = seats.pop(); if (seat) out[i] = { ...a, schoolId: seat, method: "random" }; } }
  return out;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [schools, setSchools] = useState([]);
  const [seed, setSeed] = useState(42);
  const [selectedTeacherId, setSelectedTeacherId] = useState(null);

  useEffect(() => { const unsub = onAuthStateChanged(auth, (u) => setUser(u)); return () => unsub(); }, []);

  useEffect(() => {
    const unsubTeachers = onSnapshot(collection(db, "teachers"), (snap) => {
      const arr = []; snap.forEach((d) => { const v = d.data(); arr.push({ id: d.id, ...v }); });
      setTeachers(arr);
    });
    const unsubSchools = onSnapshot(collection(db, "schools"), (snap) => {
      const arr = []; snap.forEach((d) => { const v = d.data(); arr.push({ id: d.id, ...v }); });
      setSchools(arr);
    });
    const unsubSeed = onSnapshot(doc(db, "settings", "seed"), (d) => { const v = d.data(); if (v) setSeed(v.seed); });
    return () => { unsubTeachers(); unsubSchools(); unsubSeed(); };
  }, []);

  const myTeacher = useMemo(() => user ? teachers.find(t => t.ownerUid === user.uid) : null, [teachers, user]);
  const assignments = useMemo(() => simulateAssignments(teachers, schools, seed), [teachers, schools, seed]);

  const provider = new GoogleAuthProvider();
  async function signInWithGoogle() { try { await signInWithPopup(auth, provider); } catch (e) { alert(e.message || e); } }

  const addMyTeacher = async (name, rank) => {
    if (!user) return alert("Giriş yapın");
    // tek kayıt kuralı (istemci tarafı)
    const existing = teachers.find(t => t.ownerUid === user.uid);
    if (existing) return alert("Zaten bir öğretmen kaydınız var. Onu düzenleyin.");
    const r = Number(rank);
    if (!name?.trim()) return alert("İsim gerekli");
    if (!r || r <= 0) return alert("Geçerli bir sıra girin");
    const ref = await addDoc(collection(db, "teachers"), { name: name.trim(), rank: r, preferences: [], ownerUid: user.uid });
    setSelectedTeacherId(ref.id);
  };
  const updatePrefs = async (prefs) => {
    if (!myTeacher) return;
    await updateDoc(doc(db, "teachers", myTeacher.id), { preferences: prefs });
  };

  return (
    <div className="p-4">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">DKAB Tercih Robotu (Canlı)</h1>
        {!user ? (
          <button onClick={signInWithGoogle} className="px-3 py-1 bg-gray-800 text-white rounded">Google ile Giriş</button>
        ) : (
          <div className="flex items-center gap-2">
            <span>{user.displayName || user.email}</span>
            <button onClick={() => signOut(auth)} className="px-3 py-1 bg-gray-200 rounded">Çıkış</button>
          </div>
        )}
      </header>

      {!myTeacher ? (
        <div>
          <h2>Kendi Kaydınızı Oluşturun</h2>
          <TeacherForm onSubmit={addMyTeacher} />
        </div>
      ) : (
        <div>
          <h2>{myTeacher.name} (Sıra {myTeacher.rank})</h2>
          <PreferenceEditor teacher={myTeacher} schools={schools} onChange={updatePrefs} />
        </div>
      )}

      <div className="mt-6">
        <h2 className="font-semibold mb-2">Yerleştirme Sonuçları</h2>
        <ul>
          {assignments.map(a => {
            const t = teachers.find(t => t.id === a.teacherId);
            const s = schools.find(s => s.id === a.schoolId);
            return <li key={a.teacherId}>{t?.name} → {s?.name || "—"} ({a.method})</li>;
          })}
        </ul>
      </div>
    </div>
  );
}

function TeacherForm({ onSubmit }) {
  const [name, setName] = useState("");
  const [rank, setRank] = useState("");
  return (
    <div className="flex gap-2">
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Ad Soyad" className="border px-2" />
      <input value={rank} onChange={e=>setRank(e.target.value)} placeholder="Sıra" className="border px-2 w-20" />
      <button onClick={()=> onSubmit(name, Number(rank))} className="px-3 py-1 bg-indigo-600 text-white rounded">Ekle</button>
    </div>
  );
}

function PreferenceEditor({ teacher, schools, onChange }) {
  const [sel, setSel] = useState("");
  const add = () => { if (sel && !teacher.preferences.includes(sel)) onChange([...teacher.preferences, sel]); setSel(""); };
  return (
    <div>
      <div className="flex gap-2">
        <select value={sel} onChange={e=>setSel(e.target.value)} className="border px-2">
          <option value="">Okul seç</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button onClick={add} className="px-3 py-1 bg-green-600 text-white rounded">Ekle</button>
      </div>
      <ul className="mt-2">
        {teacher.preferences.map((sid, i) => {
          const sc = schools.find(s=>s.id===sid);
          return <li key={sid}>{i+1}. {sc?.name}</li>;
        })}
      </ul>
    </div>
  );
}