# DKAB Tercih Robotu (Önizleme)
Bu proje Vite + React ile hazırlandı. Firebase Firestore + Auth kullanır.

## Kurulum
```bash
npm install
npm run dev
```
`src/App.jsx` içindeki `firebaseConfig` alanına kendi Firebase Web App bilgilerinizi girin.

## Firestore
Koleksiyonlar:
- `teachers` (fields: name, rank, preferences[], ownerUid)
- `schools` (fields: name, province, quota)
- `settings/seed` (doc: { seed: 42 })

## Giriş
Sağ üstte Google ile giriş butonu vardır.
