const GALLERY_KEY = "tools_op_tiktok_history_v1";
const MAX_GALLERY = 30;

function loadGallery() {
  try {
    const raw = localStorage.getItem(GALLERY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToGallery(entry) {
  const list = loadGallery().filter((x) => !(x.url === entry.url && x.mediaType === entry.mediaType));
  list.unshift({
    url: entry.url,
    author: entry.channel || "YouTube",
    title: entry.title || entry.url,
    thumbnail: entry.thumbnail || null,
    mediaUrl: entry.downloadUrl,
    mediaType: entry.type === "audio" ? "audio" : "video",
    filename: entry.filename,
    downloadedAt: Date.now(),
  });
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, MAX_GALLERY)));
}

function makeProxyUrl(API_BASE, remoteUrl, { download = false, filename = "" } = {}) {
  const params = new URLSearchParams({ url: remoteUrl });
  if (download) params.set("download", "1");
  if (filename) params.set("filename", filename);
  return `${API_BASE}/api/media?${params.toString()}`;
}

async function saveOnAndroidCapacitor(blob, filename, isAudio) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  if (!cap?.isNativePlatform?.() || !fs) return false;

  const subDir = isAudio ? "audio" : "video";
  const targetPath = `Download/Blackpage/${subDir}/${filename}`;

  const base64 = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const res = String(reader.result || "");
      resolve(res.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  await fs.writeFile({
    path: targetPath,
    data: base64,
    directory: "EXTERNAL_STORAGE",
    recursive: true,
  });
  return targetPath;
}

function isYtUrl(val) {
  return /(youtube\.com|youtu\.be)/i.test(val);
}

export const youtubeTool = {
  id: "youtube-dl",
  name: "YouTube Downloader",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">YouTube Video &amp; Audio Downloader</h2>
          <p class="stage-desc">Tempel link YouTube / Shorts / Playlist — pilih kualitas &amp; simpan ke Galeri.</p>
        </div>
        <span class="tag">MP4 / MP3</span>
      </div>

      <div class="cat-bar" id="ytModeBar">
        <button type="button" class="cat-pill active" data-yt-mode="single">VIDEO / MP3</button>
        <button type="button" class="cat-pill" data-yt-mode="playlist" disabled title="Sedang dinonaktifkan sementara">PLAYLIST (SOON)</button>
      </div>

      <form id="ytForm" class="input-row">
        <input
          id="ytInput"
          class="brutal-input"
          type="url"
          placeholder="https://youtu.be/... atau youtube.com/watch?v=..."
          autocomplete="off"
          required
        />
        <select id="ytFormat" class="brutal-input" aria-label="Pilih Format & Kualitas">
          <option value="video:720p" selected>Video 720p (MP4)</option>
          <option value="video:1080p">Video 1080p (MP4)</option>
          <option value="video:480p">Video 480p (MP4)</option>
          <option value="video:360p">Video 360p (MP4)</option>
          <option value="audio:720p">Audio (MP3)</option>
        </select>
        <button type="button" id="ytPaste" class="btn btn-cyan">Tempel</button>
        <button type="submit" id="ytSubmit" class="btn btn-primary">Ambil Video</button>
      </form>

      <div id="ytFeedback"></div>
      <div id="ytResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true, autoSaveGallery: true } }) {
    const form = root.querySelector("#ytForm");
    const modeBar = root.querySelector("#ytModeBar");
    const input = root.querySelector("#ytInput");
    const formatSel = root.querySelector("#ytFormat");
    const pasteBtn = root.querySelector("#ytPaste");
    const submitBtn = root.querySelector("#ytSubmit");
    const feedback = root.querySelector("#ytFeedback");
    const resultEl = root.querySelector("#ytResult");

    let currentMode = "single";
    let currentData = null;

    function setMode(mode) {
      currentMode = mode;
      modeBar.querySelectorAll("[data-yt-mode]").forEach((b) => {
        b.classList.toggle("active", b.dataset.ytMode === mode);
      });
      input.placeholder =
        mode === "playlist"
          ? "https://youtube.com/playlist?list=..."
          : "https://youtu.be/... atau youtube.com/watch?v=...";
      submitBtn.textContent = mode === "playlist" ? "Ambil Playlist" : "Ambil Video";
      setFeedback("", "");
      resultEl.innerHTML = "";
    }

    modeBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-yt-mode]");
      if (btn) setMode(btn.dataset.ytMode);
    });

    function setFeedback(type, msg) {
      if (!msg) {
        feedback.innerHTML = "";
        return;
      }
      const cls = type === "error" ? "alert alert-error" : "alert alert-info";
      feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
    }

    function renderResult(data) {
      currentData = data;
      setFeedback("", "");

      const isAudio = data.type === "audio";
      const mediaProxy = makeProxyUrl(API_BASE, data.downloadUrl);
      const previewHtml = isAudio
        ? `${data.thumbnail ? `<img class="thumb" src="${escapeHtml(data.thumbnail)}" alt="Thumbnail" loading="lazy" />` : ""}
           <audio class="audio-preview" src="${escapeHtml(mediaProxy)}" controls autoplay preload="auto"></audio>`
        : `<video
            id="ytPreviewVideo"
            class="video-preview"
            src="${escapeHtml(mediaProxy)}"
            ${data.thumbnail ? `poster="${escapeHtml(data.thumbnail)}"` : ""}
            controls
            autoplay
            muted
            playsinline
            preload="auto"
          ></video>`;

      const chips = [
        data.quality ? `QUALITY: ${data.quality}` : null,
        data.size ? `SIZE: ${data.size}` : null,
        data.duration ? `DURASI: ${data.duration}` : null,
        data.views ? `VIEWS: ${data.views}` : null,
      ]
        .filter(Boolean)
        .map((c) => `<span class="stat-chip">${escapeHtml(c)}</span>`)
        .join("");

      resultEl.innerHTML = `
        <article class="result-card">
          ${previewHtml}
          <div class="result-meta">
            <div class="author-row">
              <span class="author-avatar author-fallback">YT</span>
              <div class="author-info">
                <h3>${escapeHtml(data.channel || "YouTube")}</h3>
              </div>
            </div>

            <div class="caption-box">
              <div class="caption-head">
                <span class="caption-label">JUDUL VIDEO</span>
                <div class="caption-actions">
                  <button type="button" class="btn btn-sm" id="ytCopySel">Salin Pilihan</button>
                  <button type="button" class="btn btn-sm btn-primary" id="ytCopyAll">Salin Semua</button>
                </div>
              </div>
              <p class="result-caption" id="ytCaptionText">${escapeHtml(data.title || "YouTube Video")}</p>
            </div>

            ${chips ? `<div class="stats-row">${chips}</div>` : ""}

            <div class="dl-list">
              <button type="button" class="btn btn-success" id="ytDlBtn">
                Unduh ${isAudio ? "MP3" : `Video (${escapeHtml(data.quality || "720p")})`}
              </button>
            </div>
          </div>
        </article>
      `;

      const videoEl = resultEl.querySelector("#ytPreviewVideo");
      if (videoEl) videoEl.play().catch(() => {});
    }

    async function handleDownload(btn) {
      if (!currentData) return;
      const isAudio = currentData.type === "audio";
      const ext = currentData.extension || (isAudio ? "mp3" : "mp4");
      const base = (currentData.title || "youtube")
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "youtube";
      const filename = currentData.filename || `${base}.${ext}`;
      const origText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Menyiapkan...";

      try {
        if (window.Capacitor?.isNativePlatform?.()) {
          const res = await fetch(makeProxyUrl(API_BASE, currentData.downloadUrl));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const savedPath = await saveOnAndroidCapacitor(blob, filename, isAudio);
          if (savedPath) {
            if (prefs.autoSaveGallery !== false) {
              saveToGallery({ ...currentData, filename });
            }
            setFeedback("info", `Tersimpan di ${savedPath}!`);
            return;
          }
        }

        const dlUrl = makeProxyUrl(API_BASE, currentData.downloadUrl, { download: true, filename });
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        if (prefs.autoSaveGallery !== false) {
          saveToGallery({ ...currentData, filename });
          setFeedback("info", "Download dimulai & otomatis tersimpan di Galeri!");
        } else {
          setFeedback("info", "Download dimulai!");
        }
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh file.");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }

    function renderPlaylistResult(data) {
      setFeedback("", "");
      const itemsHtml = (data.items || [])
        .map(
          (item) => `
          <div class="gallery-row-card">
            ${item.thumbnail ? `<img class="gallery-thumb" src="${escapeHtml(item.thumbnail)}" alt="Thumb" loading="lazy" />` : `<span class="gallery-thumb gallery-thumb-fallback">YT</span>`}
            <div class="gallery-row-body">
              <div class="gallery-row-top">
                ${item.duration ? `<span class="tag">${escapeHtml(item.duration)}</span>` : ""}
                <strong class="gallery-author">${escapeHtml(item.channel || "YouTube")}</strong>
              </div>
              <p class="gallery-row-title">${escapeHtml(item.title)}</p>
            </div>
            <button type="button" class="btn btn-sm btn-primary" data-pl-url="${escapeHtml(item.url)}">Ambil</button>
          </div>
        `
        )
        .join("");

      resultEl.innerHTML = `
        <div class="result-card">
          <div class="stage-head" style="margin-bottom:4px;">
            <h3 style="margin:0;font-size:0.9rem;">${escapeHtml(data.title || "Playlist")}</h3>
            <span class="tag">${(data.items || []).length} VIDEO</span>
          </div>
          <div class="gallery-list">${itemsHtml}</div>
        </div>
      `;
    }

    async function runFetch(targetUrl) {
      const [type, quality] = formatSel.value.split(":");
      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";
      setFeedback("info", "Mengambil data video YouTube...");
      resultEl.innerHTML = "";

      try {
        const res = await fetch(`${API_BASE}/api/youtube`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl, type, quality }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        renderResult(data);
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengambil data YouTube.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Ambil Video";
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) runFetch(val);
    });

    input.addEventListener("paste", () => {
      setTimeout(() => {
        const val = input.value.trim();
        if (prefs.autoAnalyze && isYtUrl(val)) {
          runFetch(val);
        }
      }, 20);
    });

    pasteBtn.addEventListener("click", async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          const val = text.trim();
          input.value = val;
          if (prefs.autoAnalyze && isYtUrl(val)) {
            runFetch(val);
          } else {
            input.focus();
          }
        }
      } catch {
        setFeedback("error", "Izin clipboard ditolak browser. Tempel manual dengan Ctrl+V.");
      }
    });

    if (prefs.autoPaste && !input.value.trim() && navigator.clipboard?.readText) {
      navigator.clipboard
        .readText()
        .then((text) => {
          const val = (text || "").trim();
          if (isYtUrl(val)) {
            input.value = val;
            if (prefs.autoAnalyze) runFetch(val);
          }
        })
        .catch(() => {});
    }

    resultEl.addEventListener("click", async (e) => {
      const plBtn = e.target.closest("[data-pl-url]");
      if (plBtn) {
        setMode("single");
        input.value = plBtn.dataset.plUrl;
        runFetch(plBtn.dataset.plUrl);
        return;
      }

      const copyAllBtn = e.target.closest("#ytCopyAll");
      if (copyAllBtn && currentData?.title) {
        try {
          await navigator.clipboard.writeText(currentData.title);
          copyAllBtn.textContent = "Tersalin!";
          setTimeout(() => (copyAllBtn.textContent = "Salin Semua"), 1400);
        } catch {
          setFeedback("error", "Gagal menyalin judul.");
        }
        return;
      }

      const copySelBtn = e.target.closest("#ytCopySel");
      if (copySelBtn) {
        const capEl = resultEl.querySelector("#ytCaptionText");
        const sel = window.getSelection();
        const selected =
          sel && sel.rangeCount > 0 && capEl && capEl.contains(sel.anchorNode) ? sel.toString() : "";
        if (!selected.trim()) {
          setFeedback("info", "Blok/pilih dulu bagian teks yang mau disalin.");
          return;
        }
        try {
          await navigator.clipboard.writeText(selected);
          copySelBtn.textContent = "Tersalin!";
          setTimeout(() => (copySelBtn.textContent = "Salin Pilihan"), 1400);
        } catch {
          setFeedback("error", "Gagal menyalin teks pilihan.");
        }
        return;
      }

      const dlBtn = e.target.closest("#ytDlBtn");
      if (dlBtn && !dlBtn.disabled) {
        handleDownload(dlBtn);
      }
    });
  },
};
