# Blackpage — Project Rules

## 1. UI & Layout Invariants (Android-First Bauhaus)
- **App Name & Style**: **Blackpage** (`BP`), **Bauhaus** aesthetic (`#F2EDE2` paper, `#FAF7F0` surface, `#141414` ink, `#D93829` red, `#1D569E` blue, `#F2B705` yellow, `2.5px` borders, `0px` panel radius, circular badges/pills).
- **Locked Viewport Shell**: Never let `.topbar` or `.tool-nav` scroll with page content. Keep `.app-shell` pinned with `position: fixed; inset: 0; height: 100%; max-width: 440px; overflow: hidden;`, set `touch-action: none; overscroll-behavior: none;` on `html, body, .topbar, .tool-nav`, and allow scrolling **only** inside `.workspace` (`flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain; touch-action: pan-y;`).
- **Symmetry & Wrapping**: Keep horizontal margins symmetrical (`10px 12px`) without background grid lines that create uneven edges at `360px`. Use `flex-wrap: wrap` on category pills (`.cat-bar`) and `white-space: nowrap; flex-shrink: 0;` on `.tag` badges so nothing clips horizontally.
- **Navigation & Android Back Button**:
  - **Utama**: Search bar at top -> wrapping category pills -> vertical rectangular tool cards (clicking opens the tool's page with a `← Halaman Utama` back button).
  - **Galeri**: `ALL` / `VIDEO` / `MP3` filters + cover/title list -> clicking opens detail page with player & selectable caption copy.
  - **Setting**: 5 sections (`UMUM`, `TAMPILAN & RASA`, `PENYIMPANAN & UNDUHAN`, `LANJUTAN`, `TENTANG & BANTUAN`).
  - **Bottom Dock**: Floating 3-tab bar (`Utama`, `Galeri`, `Setting`).
  - **Hardware Back Support**: Keep `history.pushState` / `popstate` + Capacitor `App.addListener("backButton")` synced with internal routes so pressing Android Back navigates back inside the app instead of exiting.
- **Theme (Auto System + Dark Manga)**: Default to `auto` following Android `prefers-color-scheme: dark` (`[data-theme="dark"]` `#121214` / `#1B1B1F` / `#F2EFE9` + `#E0483E` accent) with manual override in **TAMPILAN & RASA**.

## 2. Performance, Cache & Media Proxy
- **Zero-Lag Stack**: Keep zero-dependency Node.js (`server.js`) + vanilla ES modules (`public/app.js`, `public/tools/*.js`).
- **Dev Cache-Busting**: Serve `.html`, `.css`, and `.js` with `Cache-Control: no-store` in `server.js`, and bump the query version (`?v=N`) in `public/index.html` when modifying `styles.css` or `app.js`.
- **Media Proxy (`/api/media`)**: Stream external video/audio/avatar URLs through `/api/media` with `Range` support, SSRF blocking for local/private hosts, and `video/mp4` / `audio/mpeg` `Content-Type` fallback when upstream returns `application/octet-stream`.
- **APK vs Web Downloads**: When running inside Capacitor Android (`window.Capacitor?.isNativePlatform?.()`), save videos to `Download/Blackpage/video` and MP3s to `Download/Blackpage/audio`. On Web, trigger standard browser download (`Content-Disposition: attachment`) so users choose their own save location.
- **APK Build Checklist (YouTube & Large Files)**:
  1. Deploy `server.js` to an `https://` host and configure `API_BASE` (APK only bundles `public/`, not Node.js).
  2. Use Capacitor `Filesystem.downloadFile()` (direct stream to disk) instead of `fetch().blob()` + `base64` for large files (like YouTube videos) to prevent Android WebView OOM crashes.
  3. Ensure `AndroidManifest.xml` has `INTERNET` + storage permissions and uses `https://` (or `usesCleartextTraffic` only for local dev).
