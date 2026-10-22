# CatatKu 📱💰

> **Catatan Rapi, Finansial Pasti.**  
> Aplikasi pencatat keuangan multi-buku kas pribadi, organisasi, dan bisnis yang dirancang modern, cepat, serta **100% Offline-First & Privat**.

---

## 🌟 Tentang Aplikasi

**CatatKu** adalah aplikasi manajemen finansial berbasis React Native & Expo yang membantu pengguna mengelola arus kas, melacak pengeluaran & pemasukan, memantau hutang-piutang, serta merencanakan target tabungan dan anggaran belanja secara mandiri tanpa ketergantungan koneksi internet atau server pihak ketiga. Seluruh data disimpan aman di penyimpanan lokal perangkat menggunakan SQLite.

---

## ✨ Fitur Utama

- 📚 **Multi-Buku Catatan (Cashbook)**: Buat dan kelola banyak buku kas terpisah untuk Keuangan Pribadi, Usaha/Bisnis, atau Organisasi/Komunitas.
- ⚡ **Hero Card & Aksi Cepat**: Pantau saldo catatan aktif seketika dan akses pintasan menu favorit yang dapat dikustomisasi sesuka hati.
- 💳 **Dompet & Multi-Akun**: Kelola berbagai rekening bank, dompet digital (e-wallet), dan uang tunai beserta pencatatan transfer antar-rekening.
- 🤝 **Hutang & Piutang**: Lacak kewajiban hutang dan hak piutang lengkap dengan tanggal jatuh tempo, riwayat cicilan, serta notifikasi pengingat.
- 📄 **Manajemen Tagihan (Bills)**: Catat tagihan rutin berkala agar pembayaran tidak pernah terlewat.
- 🎯 **Target Menabung & Budgeting**: Pasang target tabungan impian dengan persentase progres dan tetapkan batas pengeluaran kategori bulanan.
- 🧮 **Kalkulator Kasir Cepat**: Alat hitung transaksi kasir sederhana untuk menghitung total belanjaan dan nominal kembalian pelanggan.
- 🔄 **Transaksi Rutin Terjadwal**: Otomasi pencatatan pemasukan atau pengeluaran berkala secara otomatis saat jatuh tempo.
- 📊 **Laporan Finansial & Ekspor**: Grafik tren arus kas, persentase pengeluaran per kategori, serta ekspor laporan ke format PDF & CSV/Excel.
- 🔒 **Privasi & Keamanan Lokal**: Dilengkapi fitur kunci keamanan PIN dan autentikasi biometrik (Fingerprint / Face ID).
- 🌓 **Tema Gelap & Terang (Dark/Light Mode)**: Antarmuka adaptif yang nyaman di mata kapan saja.
- 💾 **Backup & Restore**: Cadangkan dan pulihkan seluruh basis data secara mandiri tanpa server cloud.

---

## 🛠️ Arsitektur & Teknologi

- **Framework**: [React Native](https://reactnative.dev/) dengan [Expo SDK 58](https://expo.dev/)
- **Routing**: [Expo Router v5](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Database**: [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) (Lokal SQLite, Offline-first)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Styling**: React Native StyleSheet dengan sistem tema dinamis
- **Vector Icons & UI**: Custom SVG Icons (`react-native-svg`)
- **Reporting**: `expo-print` & `expo-sharing` untuk PDF dan dokumen

---

## 🚀 Cara Menjalankan Proyek

### Prasyarat
- [Node.js](https://nodejs.org/) (versi LTS yang direkomendasikan)
- Android Studio / Android SDK (jika build APK lokal)

### Instalasi & Dev Server

1. **Clone repositori**:
   ```bash
   git clone https://github.com/danzone4u/CatatKu.git
   cd CatatKu
   ```

2. **Instal dependensi**:
   ```bash
   npm install
   ```

3. **Jalankan server pengembangan**:
   ```bash
   npx expo start
   ```

4. **Kompilasi APK Android (Rilis Lokal)**:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   *File APK rilis akan tersedia di `android/app/build/outputs/apk/release/app-release.apk`.*

---

## 📄 Lisensi

Didistribusikan di bawah lisensi MIT. Lihat file `LICENSE` untuk informasi lebih lanjut.

---

© 2026 **CatatKu**. Kelola Keuangan Mandiri & Privat.
