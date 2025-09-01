import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";

// Firebase ayarlarını kendi projenin bilgileriyle doldur
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    return onAuthStateChanged(auth, setUser);
  }, []);

  const provider = new GoogleAuthProvider();
  const signIn = () => signInWithPopup(auth, provider);

  return (
    <div style={{ padding: 24 }}>
      <h1>DKAB Tercih Robotu</h1>
      {!user ? (
        <button onClick={signIn}>Google ile Giriş</button>
      ) : (
        <div>
          <p>{user.displayName || user.email} olarak giriş yaptınız.</p>
          <button onClick={() => signOut(auth)}>Çıkış</button>
        </div>
      )}
    </div>
  );
}
