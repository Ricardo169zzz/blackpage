# Changelog — Blackpage

Semua perubahan penting pada proyek **Blackpage** dicatat di file ini.

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
