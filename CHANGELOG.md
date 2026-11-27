# Changelog — Blackpage

Semua perubahan penting pada proyek **Blackpage** dicatat di file ini.

## [1.5.0] — 2026-11-28

### Fitur Baru
- **Tab Music Khusus (Terpisah dari Galeri) & Pemutar Offline ala Spotify**:
  - Tab **Music** terpisah di navigasi bawah, dilengkapi Hero Player, seek bar, kontrol `ACAK / PREV / PLAY-PAUSE / NEXT / ULANG`, antrean lagu, fitur **Ganti Judul (`✎`)**, serta **10 logo cover SVG geometris** fallback ([public/tools/music-covers.js](file:///e:/TOOLS%20OP/public/tools/music-covers.js)).
  - Pop-up **CARI LAGU FAVORITMU (Spotify)** dengan daftar lagu populer, loading skeleton shimmer, serta tombol **Putar** dan **Download** (ikon SVG), lengkap dengan status `ONLINE` / `OFFLINE SIAP` dan animasi keluar smooth saat unduhan selesai `100%`.
  - Sinkronisasi cover offline (`resolveOfflineThumbSrc`) untuk Hero Player, Antrean Lagu, Banner Mini-Player, dan Lingkaran Floating di APK Android.
- **Background Playback & Banner Notifikasi Custom Android**:
  - Penambahan Android `MusicService` (`mediaPlayback` Foreground Service) dengan ikon notifikasi monokrom `ic_stat_blackpage.png` dari `logo.png` dan kontrol media di [.github/workflows/build-apk.yml](file:///e:/TOOLS%20OP/.github/workflows/build-apk.yml).
  - Peringatan izin Background & Notifikasi saat user hendak keluar aplikasi ketika lagu sedang diputar.
- **Floating Music Banner → Lingkaran Draggable & Galeri Android**:
  - Banner mini-player di bagian atas yang mengecil otomatis menjadi lingkaran `40px` yang dapat digeser bebas setelah 3 detik (dan memudar transparan setelah 3 detik idle), serta mengembang ke kiri/kanan sesuai posisi lingkaran.
  - Tab **Galeri** fokus ke Foto & Video dengan grid 3 kolom ala Android (`SEMUA / FOTO / VIDEO`).
- **Navigasi Bawah Minimalis & Indikator Proses**:
  - Dock navigasi bawah 5 tab (`Utama`, `Tools`, `Music`, `Galeri`, `Setting`) dengan ikon SVG minimalis.
  - Indikator progres `%` GPU-composited (`15% → 100%`) dengan animasi ceklis & keluar smooth (atau bar merah + ikon bug jika gagal), serta perbaikan animasi morphing download toast kiri bawah.

## [1.4.0] — 2026-11-26

### Fitur Baru
- **Baca Komik Multi-Server & Auto-Scroll**:
  - Mendukung `Auto (Semua Server)` + pemilih server (`Komikindo`, `Bacakomik`, `Kiryuu`, `Komiku`, `Manhwaindo`, `Komikcast`, `MangaDex`), paginasi 20 komik (`← Prev` / `Next →`), search chapter + paginasi 20 chapter, loading skeleton, dan reader throttled 2-concurrent agar bebas `403`.
  - Fitur **Auto Scroll** (`Pelan`, `Sedang`, `Cepat`, `Kilat`) berbasis `requestAnimationFrame`, pop-up tips dengan checkbox *Jangan ingatkan lagi*, pill kontrol kiri bawah saat membaca, dan tombol **← Kembali** mengambang smooth di kanan bawah saat scroll.
- **Animasi Intro Minimalis & Sinkronisasi Tema Bar Android**: Overlay intro `logo.png` + `BLACKPAGE` saat masuk aplikasi, serta sinkronisasi warna Navigation Bar (tombol Back) & Status Bar Android via `MainActivity.java` bridge.
- **Logo Baru & Tools Sticker Baru**: Pemasangan `public/logo.png` untuk web & ikon APK, penambahan **Nokia SMS** ([public/tools/nokia.js](file:///e:/TOOLS%20OP/public/tools/nokia.js)) dan **IQC Quote** ([public/tools/iqc.js](file:///e:/TOOLS%20OP/public/tools/iqc.js)), serta lightbox foto full dengan bingkai galeri Bauhaus pada semua tools Sticker.

## [1.3.0] — 2026-11-26

### Fitur Baru
- **Baca Komik (Komiku ID)**: Tombol spesial **BACA KOMIK** di bagian paling bawah Halaman Utama, terhubung ke scraper zero-dependency [lib/comic.js](file:///e:/TOOLS%20OP/lib/comic.js) (adaptasi dari `SCRAPER_COFLYN/lib/comic/komiku`), lengkap dengan pencarian komik, detail & daftar chapter (sort Terlama/Terbaru), dan pembaca vertikal lengkap dengan tombol Prev/Next Chapter ([public/tools/comic.js](file:///e:/TOOLS%20OP/public/tools/comic.js)).

## [1.2.0] — 2026-11-26

### Fitur Baru
- **Floating Download Toast -> Lingkaran Kiri Bawah**: Setiap unduhan menampilkan toast persegi panjang selama 3 detik di atas navigasi bawah, lalu otomatis mengecil menjadi tombol lingkaran di kiri bawah dengan cincin progres SVG dan persentase (bisa diklik untuk melebarkan kembali).
- **WMP Quote (`wmp1`)**: Tool generator gambar teks estetik (`JPG`) bareng **Brat** di kategori **Sticker**, mendukung pemisahan baris dengan Enter atau `|`.
- **Text to Speech (`TTS Suara`)**: Tool pembuat suara MP3 di kategori **Utility** berbasis endpoint `/api/tts` ([lib/tts.js](file:///e:/TOOLS%20OP/lib/tts.js)) tanpa dependency eksternal (mendukung `ID`, `EN`, `JA`, `KO`, `AR`), lengkap dengan pemutar audio & unduh MP3.
- **Logo Bauhaus Baru**: Pembaruan ikon vektor minimalis [public/icon.svg](file:///e:/TOOLS%20OP/public/icon.svg) untuk web, **Setting -> Tentang & Bantuan**, dan adaptive icon Android APK.

## [1.1.0] — 2026-11-26

### Fitur Baru
- **Real-Time Download Progress Bar**: Indikator persentase/ukuran unduhan secara langsung (`renderProgressHtml` + `.dl-progress-bar`) di seluruh downloader dan tombol **Unduh Lagi** Galeri, mendukung `Filesystem.addListener("progress")` di APK Android maupun streaming `ReadableStream` di Web.
- **Antrean Playlist (`Download Semua`)**: Tombol **Download Semua** (lengkap dengan tombol **Batal**, status item `✓` / `Gagal`, dan progres antrean `N/Total`) pada **YouTube Playlist** dan **Spotify Playlist**.
- **Notifikasi Update APK Otomatis**: Pengecekan versi terbaru ke GitHub Releases/tags di **Setting -> Tentang & Bantuan** (`Cek Update`) serta pengecekan otomatis di background saat opsi `autoUpdate` aktif.

## [1.0.0] — 2026-11-26 (Stable Baseline)

Versi stabil pertama yang siap dipakai harian di Web maupun Android APK.

### Fitur & UI
- **Desain Bauhaus Editorial**: Tema terang kertas (`#F2EDE2` / `#FAF7F0` / `#141414` / `#D93829`) dan **Dark Manga** (`auto` mengikuti sistem Android atau manual di **Setting -> Tampilan & Rasa**).
- **Locked Mobile Shell**: Viewport terkunci `440px` dengan area scroll khusus di `.workspace`, mendukung tombol Back hardware Android melalui `history.pushState` / `popstate` dan Capacitor `App` listener.
- **Logo & Ikon Aplikasi**: Ikon vektor Bauhaus [public/icon.svg](public/icon.svg) untuk favicon web serta adaptive launcher icon & splash screen Android APK via `@capacitor/assets`.
- **Downloader & Tools**:
  - TikTok Video (No Watermark) & MP3
  - YouTube Video, MP3 & Playlist
  - Spotify Track MP3 & Playlist
  - Instagram, Facebook, CapCut, Pinterest, Universal AIO, dan Brat Generator
- **Galeri & Pengaturan**: Riwayat unduhan lokal (`VIDEO` / `MP3` / `ALL`) lengkap dengan pemutar media, salin caption, serta 5 kategori pengaturan.

### Backend, Hosting & Android APK
- **Zero-Dependency Node.js API**: Router API terisolasi di [lib/router.js](lib/router.js) dengan media proxy `/api/media` (mendukung `Range`, proteksi SSRF, dan `Content-Type` fallback).
- **Vercel Serverless Ready**: Konfigurasi [vercel.json](vercel.json) memisahkan static serving `public/` dan serverless handler [api/index.js](api/index.js) untuk hosting gratis di `https://blackpage-eta.vercel.app`.
- **Android Native Storage**: Seluruh tool dan tombol **Unduh Lagi** di Galeri memakai `downloadMediaFile()` di [public/tools/download.js](public/tools/download.js) dengan Capacitor `Filesystem` (`mkdir` + `downloadFile`) ke folder `Download/Blackpage/{audio,video,image}` tanpa melempar ke Chrome.
- **CI Build APK**: Workflow [.github/workflows/build-apk.yml](.github/workflows/build-apk.yml) otomatis memasang plugin Capacitor ke `package.json`, men-generate ikon Android, menyuntikkan `API_BASE`, dan membangun `Blackpage-debug-apk`.
