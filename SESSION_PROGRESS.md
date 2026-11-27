# Blackpage — Catatan Lengkap Progres Sesi (`v1.0.0` → `v1.5.0`)

Dokumen ini merangkum **seluruh perjalanan & progres pengembangan Blackpage** dari pesan pertama di awal sesi (`2026-11-25`) hingga rilis `v1.5.0` (`2026-11-28`), beserta aturan wajib sinkronisasi **GitHub + Vercel** setiap kali melakukan update.

---

## 1. Kronologi Lengkap Progres Dari Awal Sesi

### Fase 1 — Pondasi, Branding **Blackpage**, & `v1.0.0` (25 Nov 2026)
1. **Inisiasi Proyek & Stack Zero-Dependency**:
   - Membangun arsitektur backend Node.js murni (`server.js`, `lib/*`) + frontend vanilla ES modules (`public/*`) tanpa framework berat, dirancang khusus untuk layar mobile Android (`max-width: 440px`, locked viewport shell).
2. **Identitas & Desain Bauhaus / Manga Editorial**:
   - Menetapkan nama **Blackpage (`BP`)** dengan tema kertas (`#F2EDE2` / `#FAF7F0`), tinta (`#141414`), aksen merah (`#D93829`), border tegas, serta perbaikan scroll terkunci agar `.topbar` dan `.tool-nav` tidak ikut ter-scroll.
   - Rombak ulang UI mengikuti prinsip `/design-taste-frontend-v1`, penambahan animasi perpindahan halaman yang ringan/no-lag, serta halaman **Setting** (`UMUM`, `TAMPILAN & RASA`, `PENYIMPANAN & UNDUHAN`, `LANJUTAN`, `TENTANG & BANTUAN`), dwibahasa **ID/EN**, tema **Auto/Dark Manga**, dan dukungan tombol **Back hardware Android**.
3. **Downloader Media & Universal Link**:
   - Integrasi **TikTok** (video no-watermark, MP3, & caption dengan salin pilihan/semua), **YouTube** (video/MP3), **Spotify** (track & playlist), **Instagram**, **Facebook**, **CapCut**, **Pinterest** (dengan lightbox popup), **Brat** (stiker teks), dan **All-In-One (`AIO`)** dengan kotak **Tempel Link Otomatis** di Halaman Utama.
4. **Hosting Vercel, GitHub & Build APK (`v1.0.0`)**:
   - Menyiapkan `api/index.js` + `vercel.json` untuk hosting gratis di `https://blackpage-eta.vercel.app`.
   - Menyiapkan Capacitor Android + `.github/workflows/build-apk.yml` untuk build APK otomatis di GitHub Actions dan penyimpanan lokal `Download/Blackpage/`.

### Fase 2 — Progress Bar, Tools Baru, & `SCRAPER_COFLYN` (`v1.1.0` – `v1.3.0`)
1. **Progress Bar Real-Time & Floating Download Toast (`v1.1.0` – `v1.2.0`)**:
   - Progres unduhan real-time + antrean **Download Semua** (YouTube & Spotify Playlist).
   - Floating download toast kiri bawah yang berubah menjadi lingkaran progres SVG setelah 3 detik.
2. **Tools Tambahan & Logo Baru**:
   - Penambahan **WMP Quote (`wmp1`)**, **Text-to-Speech (`TTS Suara`)**, dan integrasi `SCRAPER_COFLYN`.
   - Pembuatan logo baru (`public/logo.png` & `public/icon.svg`).
3. **Fitur Spesial Baca Komik (`v1.3.0`)**:
   - Penambahan tombol spesial **BACA KOMIK** di Halaman Utama yang terhubung ke scraper zero-dependency `lib/comic.js` (`public/tools/comic.js`).

### Fase 3 — Komik Multi-Server, Auto-Scroll, Offline Gallery, & `v1.4.0` (26–27 Nov 2026)
1. **Baca Komik Multi-Server & Auto-Scroll**:
   - Dukungan `Auto (Semua Server)` + pilihan server (`Komikindo`, `Bacakomik`, `Kiryuu`, `Komiku`, `Manhwaindo`, `Komikcast`, `MangaDex` 2 bahasa ID/EN), paginasi 20 item, skeleton loading, dan reader 2-concurrent anti-`403`.
   - Fitur **Auto Scroll** (`Pelan`, `Sedang`, `Cepat`, `Kilat`), pop-up tips, dan tombol mengambang `← Kembali` saat scroll, plus perbaikan tombol Back Android di dalam halaman komik.
   - Pemasangan banner khusus **BACA KOMIK** untuk mode Terang & Gelap (`comic-banner-light.jpg` / `comic-banner-dark.jpg`) di bagian atas Halaman Utama.
2. **Tools Baru & Pemolesan Media**:
   - Penambahan **Nokia SMS** (`public/tools/nokia.js`) & **IQC Quote** (`public/tools/iqc.js`) + lightbox full foto pada tools Sticker, pengelompokan **Tools** menjadi kategori (`Sticker`, `MP3 & Audio`, `AI & Utility`) dengan animasi keluar-masuk.
   - Penambahan downloader **Douyin, Threads, Reddit, Pixiv, Bilibili, RedNote** + rate limiting anti-spam.
   - Dukungan putar offline video/MP3 dari penyimpanan lokal APK (`resolveOfflineMediaSrc` & `resolveOfflineThumbSrc`), **Slide Foto Carousel** (`< >`) untuk TikTok Foto & IG, pemutar audio/video **custom Bauhaus** (bukan bawaan browser), tombol `×` hapus link, dan intro splash **BLACKPAGE**.
3. **Redesign Logo (`/logo-design`) & Perbaikan Downloader**:
   - Membuat logo baru via skill `/logo-design`, meng-upgrade visual & animasi otomatis pada kartu **TEMPEL LINK OTOMATIS**.
   - Memperbaiki playback YouTube (multi-provider fallback + deteksi klaim hak cipta), Reddit, Twitter/X, dan SoundCloud.

### Fase 4 — Indikator `%`, Galeri 9:16, Tab `Music` ala Spotify, Setting Baru, & `v1.5.0` (27–28 Nov 2026)
1. **Indikator `%` No-Lag & Upgrade Download Toast**:
   - Indikator progres GPU `transform: scaleX(...)` (`15% → 100%`) dengan animasi ceklis & keluar halus, serta bar merah + ikon bug bergetar saat gagal.
   - Memperbaiki animasi morphing download toast kiri bawah menjadi lingkaran minimalis (`44px`) dengan cincin SVG halus.
2. **Tab `Galeri` Android (9:16 & Fullscreen Geser)**:
   - Grid **2 kolom rasio `9:16`** khusus Foto & Video (`SEMUA / FOTO / VIDEO`).
   - Klik item langsung masuk **Fullscreen Viewer** yang bisa **digeser kiri/kanan (swipe)**, memakai **pemutar video custom Blackpage**, serta tombol pill gelap transparan di bar atas.
3. **Tab `Music` Khusus (Terpisah dari Galeri)**:
   - Tata letak ala **Spotify** dengan Hero Player, seek bar, kontrol lengkap, fitur **Ganti Judul (`✎`)**, **10 logo cover SVG geometris** (`/logo-design`), dan sinkronisasi thumbnail offline (`resolveOfflineThumbSrc`) ke seluruh tampilan.
   - **Pop-up `CARI LAGU FAVORITMU` (Spotify)**: logo & judul Spotify di tengah, search bar, daftar **LAGU POPULER**, **loading skeleton**, tombol **Putar** & **Download** (ikon SVG), label `ONLINE` / `OFFLINE SIAP` dengan animasi keluar smooth.
   - **Floating Top Banner → Lingkaran Draggable**: muncul di atas agar tidak mengganggu baca komik, mengecil jadi lingkaran setelah 3 detik, bisa digeser bebas, mengembang kiri/kanan sesuai posisi lingkaran, dan memudar transparan setelah 3 detik idle.
   - **Android Background Service (`MusicService.java`)**: pemutaran musik di latar belakang dengan notifikasi media custom berlogo Blackpage (`ic_stat_blackpage.png`) + modal peringatan izin saat hendak keluar aplikasi.
4. **Navigasi Bawah & Rombak `Setting`**:
   - Navigasi bawah 5 tab (`Utama`, `Tools`, `Music`, `Galeri`, `Setting`) dengan ikon SVG minimalis.
   - **Auto-Update Pop-up** (`Update Sekarang / Update Now` + `Nanti / Later`) mengecek `/api/health` dan GitHub Releases.
   - **Tampilan**: switch **Mode Gelap** & **Gunakan Bawaan Sistem**, serta **Latar Belakang Bergerak** (grid bento 3 kolom berikon SVG: `Mati`, `Bintang` rasi, `Hujan` 60fps + slider **Kecerahan & Kecepatan hingga `200%`** yang otomatis abu-abu + peringatan merah saat latar mati).
   - **Penyimpanan**: pop-up **Lokasi Unduhan** (preset Video & Audio + pilih folder, Batal/Simpan), **Auto-Retry Download** + pop-up **Maks Percobaan Ulang** (`1/2/3/5`), **Hapus Cache** (`BERSIHKAN` merah), & **Hapus Semua Data** (`RESET`).
   - **Cadangkan & Pulihkan** (menggantikan `Lanjutan`): Ekspor/Impor `.json` + Tes Server.
   - **Tentang**: `VERSI` (`CEK` merah), `PLATFORM` (APK/Website + ajakan install), `TENTANG BLACKPAGE` (oleh *Ricardo*), `CARA PENGGUNAAN`, dan `KOMUNITAS` (GitHub).
5. **Kategori Baru `Islami` — Al-Qur'an Digital**:
   - Backend `/api/quran` ([lib/quran.js](file:///e:/TOOLS%20OP/lib/quran.js), [lib/router.js](file:///e:/TOOLS%20OP/lib/router.js)) + UI [public/tools/quran.js](file:///e:/TOOLS%20OP/public/tools/quran.js) dengan pencarian instan 114 surah, filter ayat, teks Arab (`RTL`), Latin, terjemahan Indonesia, dan salin ayat.
6. **Rilis `v1.5.0`, Perbaikan CI & `/api/health`**:
   - Perbaikan heredoc (`node << 'EOF'`) di [.github/workflows/build-apk.yml](file:///e:/TOOLS%20OP/.github/workflows/build-apk.yml) sehingga build APK `v1.5.0` sukses.
   - Perbaikan `/api/health` di [lib/router.js](file:///e:/TOOLS%20OP/lib/router.js) agar otomatis membaca `version` dari [package.json](file:///e:/TOOLS%20OP/package.json).

---

## 2. Aturan Wajib: Update, Push GitHub & Sinkronisasi Vercel

Setiap kali ada update baru pada **Blackpage** dan akan di-push ke GitHub, **WAJIB** mengikuti aturan berikut agar **GitHub, APK, dan Vercel selalu ikut diperbarui bersamaan**:

1. **Jangan Push Sebelum Diminta**: selama masih tahap coding/testing lokal, simpan perubahan atau tag secara lokal saja sampai user memberi perintah push.
2. **Sinkronkan Versi & Cache-Buster Sebelum Rilis**:
   - Samakan versi di [package.json](file:///e:/TOOLS%20OP/package.json) (`"version"`) dan `APP_VERSION` di [public/app.js](file:///e:/TOOLS%20OP/public/app.js).
   - Pastikan `/api/health` di [lib/router.js](file:///e:/TOOLS%20OP/lib/router.js) selalu membaca `package.json` secara dinamis (jangan di-hardcode).
   - Naikkan `?v=N` di [public/index.html](file:///e:/TOOLS%20OP/public/index.html) setiap kali mengubah `styles.css` atau `app.js`.
   - Catat perubahan di [CHANGELOG.md](file:///e:/TOOLS%20OP/CHANGELOG.md).
3. **Wajib Lolos Verifikasi Lokal**:
   - Jalankan `npm test` dan `node --check` pada file yang berubah sebelum push.
4. **Push ke GitHub & Otomatis Perbarui Vercel**:
   - Pastikan project **Vercel** (`blackpage-eta.vercel.app`) terhubung ke repo GitHub `Ricardo169zzz/blackpage` branch **`main`** (auto-deploy aktif).
   - Push `main` (`git push origin main`) agar **Vercel otomatis membangun & memperbarui server backend (`/api/*`) + web** ke versi terbaru.
   - Push tag rilis (`git tag vX.Y.Z && git push origin vX.Y.Z`) agar GitHub Actions (`build-apk.yml`) membangun APK dan menerbitkan GitHub Release.
5. **Verifikasi Pasca-Push (Vercel + GitHub Actions)**:
   - Cek `https://blackpage-eta.vercel.app/api/health` dan pastikan `"version"` sudah sama dengan versi terbaru (misal `"1.5.0"`). Jika belum berubah, klik **Redeploy** pada deployment `main` terbaru di dashboard Vercel.
   - Pastikan workflow **Build Blackpage APK** di GitHub Actions berstatus `success`.
