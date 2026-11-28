// Blackpage Manga-Style Onboarding (6-step first-install) & 3-Style Entrance Animations

export const INTRO_STYLES = [
  { id: "bauhaus", num: "01", short: "Bauhaus", name: "Bauhaus Grid" },
  { id: "curtain", num: "02", short: "Manga", name: "Manga Ink" },
  { id: "pulse", num: "03", short: "Monogram", name: "Monogram" },
];

export function getBauhausLogoSvg(size = 76) {
  return `
    <svg class="bp-bh-mark" width="${size}" height="${size}" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="2" y="2" width="76" height="76" stroke="currentColor" stroke-width="3"/>
      <path d="M40 2H78V40C57.0132 40 40 22.9868 40 2Z" fill="var(--bp-red, #D93829)"/>
      <rect x="2" y="42" width="22" height="36" fill="var(--bp-blue, #1D569E)"/>
      <rect x="58" y="58" width="20" height="20" fill="var(--bp-yellow, #F2B705)"/>
      <path d="M16 16H34C38.4183 16 42 19.5817 42 24C42 27.1 40.2 29.7 37.6 31C40.8 32.1 43 35.1 43 38.6C43 43.2 39.2 46.8 34.6 46.8H16V16ZM23 22V28.4H32.5C34.2 28.4 35.4 27.1 35.4 25.2C35.4 23.3 34.2 22 32.5 22H23ZM23 34V40.8H33.2C35 40.8 36.2 39.4 36.2 37.4C36.2 35.4 35 34 33.2 34H23Z" fill="currentColor"/>
      <line x1="40" y1="2" x2="40" y2="78" stroke="currentColor" stroke-width="2.5"/>
      <line x1="2" y1="40" x2="78" y2="40" stroke="currentColor" stroke-width="2.5"/>
    </svg>
  `;
}

export function renderSplashMarkup(style = "bauhaus") {
  const safeStyle = INTRO_STYLES.some((s) => s.id === style) ? style : "bauhaus";

  if (safeStyle === "curtain") {
    return `
      <div class="bp-splash bp-splash--curtain">
        <div class="bps-curtain-slash" aria-hidden="true"></div>
        <div class="bps-curtain-content">
          <div class="bps-curtain-tag">ブラックページ</div>
          <div class="bps-curtain-title-mask">
            <div class="bps-curtain-title">BLACKPAGE</div>
          </div>
          <div class="bps-curtain-rule"></div>
        </div>
      </div>
    `;
  }

  if (safeStyle === "pulse") {
    return `
      <div class="bp-splash bp-splash--pulse">
        <div class="bps-pulse-frame">
          ${getBauhausLogoSvg(74)}
        </div>
        <div class="bps-pulse-wordmark">BLACKPAGE</div>
      </div>
    `;
  }

  return `
    <div class="bp-splash bp-splash--bauhaus">
      <div class="bps-bh-grid" aria-hidden="true">
        <span class="bps-bh-line bps-bh-v1"></span>
        <span class="bps-bh-line bps-bh-h1"></span>
        <span class="bps-bh-block bps-bh-red"></span>
        <span class="bps-bh-block bps-bh-blue"></span>
        <span class="bps-bh-block bps-bh-yellow"></span>
      </div>
      <div class="bps-bh-core">
        <div class="bps-bh-logo">${getBauhausLogoSvg(74)}</div>
        <div class="bps-bh-meta">
          <div class="bps-bh-title-mask">
            <div class="bps-bh-title">BLACKPAGE</div>
          </div>
          <div class="bps-bh-sub">BAUHAUS EDITION</div>
        </div>
      </div>
    </div>
  `;
}

export function mountOnboarding(container, {
  initialStep = 1,
  prefs = {},
  githubUser = "Ricardo169zzz",
  githubRepo = "Ricardo169zzz/blackpage",
  appVersion = "1.5.1",
  onSavePrefs = () => {},
  onToggleTheme = null,
  getThemeLabel = () => "TEMA",
  onScanFolder = null,
  onScanWebFiles = null,
  onSyncFolder = null,
  onFinish = () => {},
} = {}) {
  let step = Math.max(1, Math.min(6, initialStep));
  let selectedStyle = INTRO_STYLES.some((s) => s.id === prefs.introStyle)
    ? prefs.introStyle
    : "bauhaus";
  let scanState = {
    loading: false,
    scanningDir: "",
    data: null,
    syncedMsg: "",
    customOpen: false,
    customInput: "Download/Blackpage",
  };

  const TOTAL = 6;

  async function runAutoScan(folderPath = "Download/Blackpage", autoSync = true) {
    if (!onScanFolder) return;
    scanState.loading = true;
    scanState.scanningDir = folderPath;
    scanState.syncedMsg = "";
    scanState.customInput = folderPath;
    if (step === 6) render();
    try {
      const res = await onScanFolder(folderPath, (prog) => {
        scanState.scanningDir = prog?.scanningDir || folderPath;
        const dirEl = container.querySelector("#bpoScanDirText");
        if (dirEl) dirEl.textContent = `MEMINDAI: ${scanState.scanningDir}`;
      });
      scanState.data = res;
      if (autoSync && res?.totalCount > 0 && onSyncFolder) {
        const synced = await onSyncFolder(res);
        const parts = [];
        if (synced?.backupRestored) parts.push("backup JSON dipulihkan");
        if (synced?.addedCount) parts.push(`${synced.addedCount} file ditambahkan`);
        scanState.syncedMsg = parts.length
          ? `✓ Tersinkron otomatis (${parts.join(" & ")})`
          : "✓ Folder sudah tersinkron otomatis.";
      }
    } catch (err) {
      scanState.data = {
        platform: "android",
        folder: folderPath,
        totalCount: 0,
        counts: { video: 0, audio: 0, thumb: 0, image: 0, backup: 0 },
        entries: [],
        error: err?.message || "Gagal memindai folder.",
      };
    }
    scanState.loading = false;
    if (step === 6) render();
  }

  function renderStepBody(currentStep) {
    switch (currentStep) {
      case 1:
        return `
          <div class="bpo-step bpo-step--1">
            <div class="bpo-manga-head bpo-wipe" style="--st:0">
              <span class="bpo-ch-badge">第壱話 // CH.01</span>
              <span class="bpo-mono-tag">EDISI v${appVersion}</span>
            </div>

            <div class="bpo-step-body">
              <div class="bpo-cover-stage">
                <div class="bpo-crop-frame bpo-pop" style="--st:1">
                  <span class="bpo-crop bpo-crop--tl" aria-hidden="true"></span>
                  <span class="bpo-crop bpo-crop--tr" aria-hidden="true"></span>
                  <span class="bpo-crop bpo-crop--bl" aria-hidden="true"></span>
                  <span class="bpo-crop bpo-crop--br" aria-hidden="true"></span>
                  <div class="bpo-cover-inner">
                    <div class="bpo-logo-box">
                      ${getBauhausLogoSvg(96)}
                    </div>
                    <div class="bpo-cover-vert" aria-hidden="true">ブラックページ</div>
                  </div>
                </div>
              </div>

              <div class="bpo-title-block">
                <div class="bpo-line-mask"><h1 class="bpo-h1 bpo-slice" style="--st:2">BLACKPAGE</h1></div>
                <div class="bpo-rule bpo-rule-draw" style="--st:3"></div>
                <div class="bpo-foot-caption bpo-wipe" style="--st:4">
                  <p>Komposisi Bauhaus berpadu dengan ritme panel manga yang tegas.</p>
                  <span class="bpo-seal"><img src="./logo.png?v=107" alt="Blackpage" /></span>
                </div>
              </div>
            </div>
          </div>
        `;

      case 2:
        return `
          <div class="bpo-step bpo-step--2">
            <div class="bpo-manga-head bpo-wipe" style="--st:0">
              <span class="bpo-ch-badge">第弐話 // CH.02</span>
              <span class="bpo-mono-tag">SELAMAT DATANG</span>
            </div>

            <div class="bpo-step-body">
              <div class="bpo-hero-wrap">
                <h2 class="bpo-display">
                  <span class="bpo-line-mask"><span class="bpo-slice" style="--st:1">Satu halaman,</span></span>
                  <span class="bpo-line-mask"><span class="bpo-slice" style="--st:2">semua alat</span></span>
                  <span class="bpo-line-mask"><span class="bpo-slice" style="--st:3">harianmu.</span></span>
                </h2>
                <p class="bpo-lead bpo-wipe" style="--st:4">
                  Dibuat ringkas agar langsung ke inti — tanpa menu membingungkan atau animasi yang bikin berat.
                </p>
              </div>

              <div class="bpo-bottom-block">
                <div class="bpo-rule bpo-rule-draw" style="--st:5"></div>
                <ul class="bpo-clean-list">
                  <li class="bpo-wipe" style="--st:6">
                    <strong>Cepat &amp; Ringan</strong>
                    <span>Dibuka instan dan responsif di layar HP.</span>
                  </li>
                  <li class="bpo-wipe" style="--st:7">
                    <strong>Tema Kertas &amp; Dark Manga</strong>
                    <span>Adaptif untuk siang hari maupun malam.</span>
                  </li>
                  <li class="bpo-wipe" style="--st:8">
                    <strong>Terstruktur Rapi</strong>
                    <span>Galeri, musik, anime, dan komik punya ruang masing-masing.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        `;

      case 3:
        return `
          <div class="bpo-step bpo-step--3">
            <div class="bpo-manga-head bpo-wipe" style="--st:0">
              <span class="bpo-ch-badge">目次 // TENTANG</span>
              <span class="bpo-mono-tag">DAFTAR ISI</span>
            </div>

            <div class="bpo-step-body">
              <div class="bpo-line-mask">
                <h2 class="bpo-h2 bpo-slice" style="--st:1">Semua fitur utama dalam satu atap.</h2>
              </div>

              <div class="bpo-mokuji">
                <div class="bpo-mokuji-row bpo-wipe" style="--st:2">
                  <span class="bpo-m-num">01</span>
                  <span class="bpo-m-title">Media &amp; Unduhan</span>
                  <span class="bpo-m-dots"></span>
                  <span class="bpo-m-tag">TT / YT / IG</span>
                </div>
                <div class="bpo-mokuji-row bpo-wipe" style="--st:3">
                  <span class="bpo-m-num">02</span>
                  <span class="bpo-m-title">Nonton Anime</span>
                  <span class="bpo-m-dots"></span>
                  <span class="bpo-m-tag">STREAM + DL</span>
                </div>
                <div class="bpo-mokuji-row bpo-wipe" style="--st:4">
                  <span class="bpo-m-num">03</span>
                  <span class="bpo-m-title">Baca Komik</span>
                  <span class="bpo-m-dots"></span>
                  <span class="bpo-m-tag">MANGA / MANHWA</span>
                </div>
                <div class="bpo-mokuji-row bpo-wipe" style="--st:5">
                  <span class="bpo-m-num">04</span>
                  <span class="bpo-m-title">Pemutar Musik</span>
                  <span class="bpo-m-dots"></span>
                  <span class="bpo-m-tag">AUDIO LOKAL</span>
                </div>
                <div class="bpo-mokuji-row bpo-wipe" style="--st:6">
                  <span class="bpo-m-num">05</span>
                  <span class="bpo-m-title">Al-Qur'an &amp; Alat</span>
                  <span class="bpo-m-dots"></span>
                  <span class="bpo-m-tag">UTILITAS</span>
                </div>
              </div>

              <div class="bpo-bottom-block">
                <div class="bpo-rule bpo-rule-draw" style="--st:7"></div>
                <p class="bpo-lead bpo-wipe" style="--st:8">
                  Ringan, bebas iklan, dan tersinkronisasi antara Web dan APK Android.
                </p>
              </div>
            </div>
          </div>
        `;

      case 4:
        return `
          <div class="bpo-step bpo-step--4">
            <div class="bpo-manga-head bpo-wipe" style="--st:0">
              <span class="bpo-ch-badge">奥付 // CREATOR</span>
              <span class="bpo-mono-tag">OPEN SOURCE</span>
            </div>

            <div class="bpo-step-body">
              <div class="bpo-dossier bpo-wipe" style="--st:1">
                <div class="bpo-dossier-banner">
                  <span class="bpo-dossier-kanji">開発者 // ARCHITECT</span>
                  <span class="bpo-dossier-stamp">VERIFIED</span>
                </div>

                <div class="bpo-dossier-body">
                  <div class="bpo-dossier-avatar-frame">
                    <img
                      class="bpo-dev-avatar"
                      src="https://github.com/${githubUser}.png?size=240"
                      alt="${githubUser}"
                      onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"
                    />
                    <div class="bpo-dev-fallback" style="display:none">R</div>
                    <span class="bpo-hanko" aria-hidden="true">公認</span>
                  </div>

                  <div class="bpo-dossier-id">
                    <div class="bpo-dev-handle">@${githubUser}</div>
                    <div class="bpo-dev-role">Lead Creator &amp; Maintainer</div>
                    <div class="bpo-dev-repo">${githubRepo}</div>
                  </div>
                </div>

                <div class="bpo-dossier-quote">
                  <span class="bpo-quote-bar"></span>
                  <p>Built for speed, clarity, and daily utility without noise.</p>
                </div>

                <div class="bpo-dossier-stats">
                  <div class="bpo-dstat">
                    <span>PROJECT</span>
                    <strong>Blackpage</strong>
                  </div>
                  <div class="bpo-dstat">
                    <span>ENGINE</span>
                    <strong>Node + ES6</strong>
                  </div>
                  <div class="bpo-dstat">
                    <span>TARGET</span>
                    <strong>Web &amp; APK</strong>
                  </div>
                </div>
              </div>

              <a
                class="bpo-gh-bar bpo-wipe"
                style="--st:2"
                href="https://github.com/${githubUser}"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>KUNJUNGI GITHUB.COM/${githubUser.toUpperCase()}</span>
                <span>↗</span>
              </a>
            </div>
          </div>
        `;

      case 5:
        return `
          <div class="bpo-step bpo-step--5">
            <div class="bpo-manga-head bpo-wipe" style="--st:0">
              <span class="bpo-ch-badge">第伍話 // INTRO</span>
              <span class="bpo-mono-tag">PILIH GAYA</span>
            </div>

            <div class="bpo-step-body">
              <div class="bpo-line-mask">
                <h2 class="bpo-h2 bpo-slice" style="--st:1">Animasi saat masuk aplikasi.</h2>
              </div>

              <div class="bpo-cards-916 bpo-wipe" style="--st:2">
                ${INTRO_STYLES.map((item) => `
                  <div
                    class="bpo-card-916 ${selectedStyle === item.id ? "is-selected" : ""}"
                    data-intro-style="${item.id}"
                    role="button"
                    tabindex="0"
                    aria-label="Preview ${item.name}"
                  >
                    <span class="bpo-card-num">${item.num}</span>
                    <div class="bpo-card-stage" data-preview-for="${item.id}">
                      ${renderSplashMarkup(item.id)}
                    </div>
                  </div>
                `).join("")}
              </div>

              <div class="bpo-style-btns bpo-wipe" style="--st:3">
                ${INTRO_STYLES.map((item) => `
                  <button
                    type="button"
                    class="bpo-style-btn ${selectedStyle === item.id ? "is-selected" : ""}"
                    data-intro-style="${item.id}"
                  >
                    <span>${item.num}</span>
                    <strong>${item.short}</strong>
                  </button>
                `).join("")}
              </div>
            </div>
          </div>
        `;

      case 6: {
        const chosen = INTRO_STYLES.find((s) => s.id === selectedStyle) || INTRO_STYLES[0];
        const scan = scanState.data;
        const hasPrevData = Boolean(scan && scan.totalCount > 0);
        const isAndroid = scan?.platform === "android";
        const c = scan?.counts || { video: 0, audio: 0, thumb: 0, image: 0, backup: 0 };

        const previewRows = hasPrevData
          ? scan.entries.slice(0, 6).map((item) => {
            const icon =
              item.kind === "backup" ? "JSON" :
              item.kind === "audio" ? "MP3" :
              item.kind === "video" ? "MP4" :
              item.kind === "thumb" ? "THM" : "IMG";
            return `
              <div class="bpo-sync-item">
                <span class="bpo-sync-kind">${icon}</span>
                <span class="bpo-sync-name">${item.name}</span>
              </div>
            `;
          }).join("")
          : "";

        const countsStrip = hasPrevData
          ? `
            <div class="bpo-scan-counts">
              <span>VID ${c.video || 0}</span>
              <span>AUD ${c.audio || 0}</span>
              <span>THM ${c.thumb || 0}</span>
              <span>IMG ${c.image || 0}</span>
              <span>JSON ${c.backup || 0}</span>
            </div>
          `
          : "";

        const syncHtml = scanState.loading
          ? `
            <div class="bpo-sync-box bpo-wipe" style="--st:3">
              <div class="bpo-sync-title">Memindai penyimpanan perangkat...</div>
              <div class="bpo-sync-folder" id="bpoScanDirText">MEMINDAI: ${scanState.scanningDir || "Download/Blackpage"}</div>
              <div class="bpo-scan-bar"><span class="bpo-scan-bar-fill"></span></div>
            </div>
          `
          : hasPrevData
            ? `
              <div class="bpo-sync-box bpo-wipe" style="--st:3">
                <div class="bpo-sync-title">Di perangkat ini sudah ada data aplikasi versi sebelumnya, ingin sinkronkan?</div>
                <div class="bpo-sync-folder">📁 ${scan.folder} (${scan.totalCount} file)</div>
                ${countsStrip}
                <div class="bpo-sync-list">
                  ${previewRows}
                  ${scan.totalCount > 6 ? `<div class="bpo-sync-more">+${scan.totalCount - 6} file lainnya</div>` : ""}
                </div>
                ${scanState.syncedMsg ? `<div class="bpo-sync-done">${scanState.syncedMsg}</div>` : ""}
                <div class="bpo-sync-actions">
                  ${!scanState.syncedMsg ? `<button type="button" class="bpo-sync-btn is-primary" id="bpoSyncNowBtn">SINKRONKAN</button>` : ""}
                  <button type="button" class="bpo-sync-btn" id="bpoPickFolderBtn">PILIH FOLDER</button>
                </div>
              </div>
            `
            : `
              <div class="bpo-sync-box bpo-wipe" style="--st:3">
                <div class="bpo-sync-title">Tidak ada data sebelumnya? Pilih folder milikmu</div>
                ${scan?.error ? `<div class="bpo-sync-err">${scan.error}</div>` : ""}
                ${scanState.syncedMsg ? `<div class="bpo-sync-done">${scanState.syncedMsg}</div>` : ""}
                <div class="bpo-sync-actions">
                  <button type="button" class="bpo-sync-btn is-primary" id="bpoPickFolderBtn">PILIH FOLDER</button>
                  <button type="button" class="bpo-sync-btn" id="bpoPickFilesBtn">PILIH FILE</button>
                  ${isAndroid ? `<button type="button" class="bpo-sync-btn" id="bpoRescanDefaultBtn">PINDAI ULANG</button>` : ""}
                </div>
              </div>
            `;

        const customFolderHtml = scanState.customOpen && isAndroid
          ? `
            <div class="bpo-custom-folder">
              <input type="text" class="bpo-folder-input" id="bpoCustomFolderInput" value="${scanState.customInput || scan?.folder || "Download/Blackpage"}" placeholder="Contoh: Download/Blackpage" />
              <button type="button" class="bpo-sync-btn is-primary" id="bpoScanCustomBtn">PINDAI</button>
            </div>
          `
          : "";

        return `
          <div class="bpo-step bpo-step--6">
            <div class="bpo-manga-head bpo-wipe" style="--st:0">
              <span class="bpo-ch-badge">最終話 // SIAP</span>
              <span class="bpo-mono-tag">${chosen.short.toUpperCase()} • ${getThemeLabel()}</span>
            </div>

            <div class="bpo-step-body">
              <h2 class="bpo-display">
                <span class="bpo-line-mask"><span class="bpo-slice" style="--st:1">Semua siap.</span></span>
                <span class="bpo-line-mask"><span class="bpo-slice" style="--st:2">Mulai sekarang.</span></span>
              </h2>

              ${syncHtml}
              ${customFolderHtml}
              <input type="file" id="bpoWebFolderInput" webkitdirectory directory multiple hidden />
              <input type="file" id="bpoMultiFileInput" multiple accept=".json,.mp3,.m4a,.wav,.mp4,.mkv,.jpg,.jpeg,.png,.webp,audio/*,video/*,image/*" hidden />

              <button type="button" class="bpo-enter-btn bpo-wipe" style="--st:4" id="bpoEnterBtn">
                <span>MASUK KE BLACKPAGE</span>
                <span>→</span>
              </button>
            </div>
          </div>
        `;
      }

      default:
        return "";
    }
  }

  function selectStyle(styleId) {
    selectedStyle = styleId;
    onSavePrefs({ introStyle: selectedStyle });
    container.querySelectorAll("[data-intro-style]").forEach((el) => {
      el.classList.toggle("is-selected", el.dataset.introStyle === selectedStyle);
    });
    const stage = container.querySelector(`[data-preview-for="${selectedStyle}"]`);
    if (stage) {
      stage.innerHTML = "";
      void stage.offsetWidth;
      stage.innerHTML = renderSplashMarkup(selectedStyle);
    }
  }

  function render() {
    container.innerHTML = `
      <div class="bpo-shell">
        <header class="bpo-top">
          <div class="bpo-step-indicator">
            <span class="bpo-step-count">HAL. 0${step} / 0${TOTAL}</span>
            <div class="bpo-progress-bars" aria-hidden="true">
              ${Array.from({ length: TOTAL }, (_, idx) => `
                <span class="bpo-pbar ${idx + 1 <= step ? "is-done" : ""}"></span>
              `).join("")}
            </div>
          </div>
          <div class="bpo-top-actions">
            ${onToggleTheme ? `<button type="button" class="bpo-top-btn" id="bpoThemeBtn">${getThemeLabel()}</button>` : ""}
          </div>
        </header>

        <main class="bpo-main">
          ${renderStepBody(step)}
        </main>

        <footer class="bpo-foot">
          ${step > 1
            ? `<button type="button" class="bpo-nav-btn" id="bpoPrevBtn">← KEMBALI</button>`
            : `<span class="bpo-foot-hint">BLACKPAGE // 2026</span>`}
          ${step < TOTAL
            ? `<button type="button" class="bpo-nav-btn is-primary" id="bpoNextBtn">LANJUT →</button>`
            : `<span></span>`}
        </footer>
      </div>
    `;

    container.querySelector("#bpoPrevBtn")?.addEventListener("click", () => {
      if (step > 1) {
        step -= 1;
        render();
      }
    });

    container.querySelector("#bpoNextBtn")?.addEventListener("click", () => {
      if (step < TOTAL) {
        step += 1;
        render();
        if (step === 6 && !scanState.data && !scanState.loading) {
          runAutoScan("Download/Blackpage");
        }
      }
    });

    container.querySelector("#bpoThemeBtn")?.addEventListener("click", () => {
      if (onToggleTheme) {
        onToggleTheme();
        const btn = container.querySelector("#bpoThemeBtn");
        if (btn) btn.textContent = getThemeLabel();
        if (step === 6) render();
      }
    });

    container.querySelectorAll("[data-intro-style]").forEach((el) => {
      el.addEventListener("click", () => selectStyle(el.dataset.introStyle));
    });

    container.querySelector("#bpoSyncNowBtn")?.addEventListener("click", async () => {
      if (!onSyncFolder || !scanState.data) return;
      const res = await onSyncFolder(scanState.data);
      const parts = [];
      if (res?.backupRestored) parts.push("backup JSON dipulihkan");
      if (res?.addedCount) parts.push(`${res.addedCount} file ditambahkan`);
      scanState.syncedMsg = parts.length
        ? `✓ Tersinkron: ${parts.join(" & ")}.`
        : "✓ Folder sudah tersinkron dengan aplikasi.";
      render();
    });

    container.querySelector("#bpoPickFolderBtn")?.addEventListener("click", () => {
      if (scanState.data?.platform === "android") {
        scanState.customOpen = !scanState.customOpen;
        render();
      } else {
        container.querySelector("#bpoWebFolderInput")?.click();
      }
    });

    container.querySelector("#bpoPickFilesBtn")?.addEventListener("click", () => {
      container.querySelector("#bpoMultiFileInput")?.click();
    });

    container.querySelector("#bpoMultiFileInput")?.addEventListener("change", async (e) => {
      const files = e.target?.files;
      if (!files?.length || !onScanWebFiles) return;
      const webRes = onScanWebFiles(files);
      scanState.data = webRes;
      scanState.syncedMsg = "";
      if (webRes?.totalCount > 0 && onSyncFolder) {
        const synced = await onSyncFolder(webRes);
        const parts = [];
        if (synced?.backupRestored) parts.push("backup JSON dipulihkan");
        if (synced?.addedCount) parts.push(`${synced.addedCount} file ditambahkan`);
        scanState.syncedMsg = parts.length
          ? `✓ Tersinkron otomatis (${parts.join(" & ")})`
          : "✓ File lokal tersinkron otomatis.";
      }
      render();
    });

    container.querySelector("#bpoRescanDefaultBtn")?.addEventListener("click", () => {
      runAutoScan(scanState.customInput || "Download/Blackpage", true);
    });

    container.querySelector("#bpoScanCustomBtn")?.addEventListener("click", () => {
      const val = container.querySelector("#bpoCustomFolderInput")?.value?.trim();
      if (val) runAutoScan(val, true);
    });

    container.querySelector("#bpoWebFolderInput")?.addEventListener("change", async (e) => {
      const files = e.target?.files;
      if (!files?.length || !onScanWebFiles) return;
      const webRes = onScanWebFiles(files);
      scanState.data = webRes;
      scanState.syncedMsg = "";
      if (webRes?.totalCount > 0 && onSyncFolder) {
        const synced = await onSyncFolder(webRes);
        const parts = [];
        if (synced?.backupRestored) parts.push("backup JSON dipulihkan");
        if (synced?.addedCount) parts.push(`${synced.addedCount} file ditambahkan`);
        scanState.syncedMsg = parts.length
          ? `✓ Tersinkron otomatis (${parts.join(" & ")})`
          : "✓ Folder sudah tersinkron otomatis.";
      }
      render();
    });

    container.querySelector("#bpoEnterBtn")?.addEventListener("click", () => {
      onSavePrefs({ introStyle: selectedStyle, onboardingDone: true });
      onFinish(selectedStyle);
    });
  }

  render();
}
