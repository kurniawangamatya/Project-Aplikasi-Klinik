# Panduan Migrasi & Pembuatan Aplikasi Android (Capacitor)

Aplikasi **Gimu Andalan** telah berhasil diintegrasikan dengan **Capacitor** oleh Ionic, standar industri untuk membungkus kode web berbasis React dan Vite menjadi aplikasi Android Native yang ringan, bertenaga, dan berkinerja tinggi.

Dengan sistem ini, seluruh halaman web, dashboard, database lokal, dan sinkronisasi Firebase Anda akan berjalan sempurna di dalam webview Chromium native di dalam HP Android.

---

## ⚡ Apa Yang Telah Ditambahkan?

1. **Konfigurasi Capacitor (`capacitor.config.json`)**: Berfungsi untuk mengatur App ID (`com.gimu.andalan`), Nama Aplikasi (`Gimu Andalan`), dan folder sumber aset (`dist`).
2. **Koneksi Native Android (`/android/`)**: Folder proyek native Android lengkap bawaan Gradle, Java, dan AndroidManifest yang siap di-build, dijalankan, atau dibuka di Android Studio.
3. **Script Tambahan (`package.json`)**:
   - `npm run android:sync` – Melakukan build ulang aset React Anda dan mensinkronisasikannya langsung ke folder aset native Android.
   - `npm run android:open` – Membuka proyek Android Anda secara otomatis di Android Studio di PC Anda.
4. **Alur Otomatisasi GitHub Actions (`.github/workflows/android.yml`)**: Mengompilasi dan menghasilkan file `.apk` secara otomatis dan gratis setiap kali Anda mengunggah (push) kode Anda ke GitHub!

---

## 🚀 Opsi 1: Membuat APK Otomatis lewat GitHub (Sangat Direkomendasikan & Gratis)

Anda tidak perlu menginstal Android Studio atau membebani komputer Anda. GitHub menyediakan server gratis untuk mengompilasi APK Anda dalam waktu kurang dari 3 menit.

### Langkah-langkah:
1. Hubungkan folder proyek ini ke dalam repositori **GitHub** milik Anda.
2. Silakan lakukan `Git Push` semua file ini ke branch utama Anda (`main` atau `master`).
3. Buka halaman repositori Anda di web GitHub, lalu pilih tab **Actions**.
4. Anda akan melihat alur kerja bernama **"Build Android APK"** sedang berjalan.
5. Setelah proses selesai (berwarna hijau), klik pada detail proses tersebut.
6. Gulir ke bawah ke bagian **Artifacts**, dan Anda dapat langsung mengunduh file **`gimu-andalan-debug-apk`**.
7. Ekstrak file zip tersebut untuk mendapatkan file **`app-debug.apk`** yang bisa langsung dikirim dan diinstal ke HP Android Anda!

---

## 💻 Opsi 2: Menjalankan & Membuat APK secara Lokal di Komputer Anda

Jika Anda ingin melakukan debug, testing, atau ingin mengompilasi APK langsung dari PC Anda sendiri:

### Persyaratan Awal (Prerequisites):
1. **Node.js** (Versi 18 atau 20) terinstal di PC Anda.
2. **Java JDK 17** terinstal di PC Anda (pastikan variabel lingkungan `JAVA_HOME` sudah diatur).
3. **Android Studio** terinstal di PC Anda (lengkap dengan Android SDK & Emulator).

### Langkah Menjalankan Aplikasi di Emulator/HP Anda:
1. Jalankan perintah berikut di terminal/CMD untuk mengompilasi proyek React terbaru Anda dan memindahkannya ke Android:
   ```bash
   npm run android:sync
   ```
2. Buka proyek Android di Android Studio dengan perintah:
   ```bash
   npm run android:open
   ```
   *(Atau secara manual buka folder `/android` dari dalam software Android Studio).*
3. Tunggu proses **Gradle Sync** di Android Studio selesai (biasanya memerlukan waktu 1-2 menit pada pembukaan pertama kali).
4. Hubungkan HP Android Anda via USB Debugging, atau gunakan emulator Android Studio.
5. Klik tombol **Run (ikon Play berwarna hijau)** di bagian atas Android Studio untuk menginstal dan meluncurkan aplikasi langsung di HP Anda!

### Langkah Membuat File APK di Android Studio secara Lokal:
1. Buka Android Studio.
2. Pada menu atas, pilih **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
3. Studio akan mulai mengompilasi APK secara lokal.
4. Setelah selesai, ada notifikasi pop-up di pojok kanan bawah. Klik **"Locate"** untuk membuka folder tempat file `.apk` Anda berhasil dibuat!

---

## 🎨 Menyesuaikan Ikon & Splash Screen Aplikasi Anda

Untuk merancang ikon peluncur aplikasi custom dan screen splash pembuka Anda sendiri:

1. Buat gambar ikon berukuran minimal `1024x1024 px` (format PNG) bernamakan `icon.png`.
2. Buat gambar splash screen berukuran minimal `2732x2732 px` (format PNG) bernamakan `splash.png`.
3. Letakkan kedua file tersebut di dalam folder root proyek ini.
4. Jalankan perintah otomasi pembuatan ikon untuk seluruh ukuran perangkat Android:
   ```bash
   npx cordova-res android --skip-config --copy
   ```
   *(Alat ini secara otomatis akan memotong, melakukan scale, dan menempatkan ikon serta gambar splash Anda ke folder konfigurasi res Android yang tepat).*

---

Aplikasi ini sekarang memiliki portabilitas penuh, siap dijalankan baik sebagai website instan maupun sebagai aplikasi Android handal!
