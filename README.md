# Daily Life OS — GitHub Pages + Firebase (opsional)

## Deploy gratis
1. Buat repository GitHub baru, misalnya `daily-life-os`.
2. Upload **isi folder** ini ke root repository (bukan ZIP).
3. Buka Settings → Pages → Deploy from a branch → `main` → `/ (root)` → Save.
4. Buka URL GitHub Pages melalui Chrome Android, lalu menu ⋮ → **Tambahkan ke layar utama / Instal aplikasi**.
5. PWA ini bukan APK; aplikasi terpasang lewat browser.

## Sinkronisasi Firebase (opsional)
1. Firebase Console → buat project → pilih paket Spark (gratis).
2. Add app → Web, salin `firebaseConfig` ke `firebase-config.js` dengan format `window.FIREBASE_CONFIG = {apiKey: '...', authDomain:'...', projectId:'...', appId:'...'};`. Konfigurasi web Firebase bukan secret; **jangan** menaruh private key/admin SDK.
3. Authentication → Sign-in method → aktifkan Google.
4. Authentication → Settings → Authorized domains → tambahkan domain GitHub Pages Anda (contoh `username.github.io`).
5. Firestore Database → buat database → Rules → salin isi `firestore.rules` → Publish.
6. Commit perubahan, refresh aplikasi dan login Google.
7. Untuk menghindari konflik, gunakan satu perangkat saat mengedit; versi awal menggunakan penyimpanan dokumen tunggal (last write wins).

## Fitur
- Jadwal awal diambil dari `Jadwal_Harian_Terpadu_Almida_Store.xlsx` (122 kegiatan).
- Tujuh hari, checklist per tanggal, tambah/edit/hapus kegiatan, filter, pencarian, progress.
- Penyimpanan lokal offline; ekspor/impor cadangan JSON; login Google dan sinkronisasi Firebase opsional.
- Jam salat adalah blok perkiraan dari spreadsheet, **bukan waktu azan real-time**.
- Belum ada push notification, alarm latar belakang, sinkronisasi otomatis real-time, atau APK native.
- Pembaruan kode PWA mungkin memerlukan reload. Jangan membersihkan data situs sebelum mengekspor cadangan jika belum memakai Firebase.
