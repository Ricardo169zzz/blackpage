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
    author: entry.author || "TikTok",
    title: entry.title || entry.url,
    thumbnail: entry.thumbnail || null,
    mediaUrl: entry.mediaUrl,
    mediaType: entry.mediaType,
    filename: entry.filename,
    downloadedAt: Date.now(),
  });
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, MAX_GALLERY)));
}

function buildFilename(data, isAudio) {
  const base = (data.author || "blackpage")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "blackpage";
  const stamp = Date.now().toString().slice(-6);
  return `${base}_${stamp}.${isAudio ? "mp3" : "mp4"}`;
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

export const tiktokTool = {
  id: "tiktok-dl",
  name: "TikTok Downloader",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">TikTok Video &amp; Audio Downloader</h2>
          <p class="stage-desc">Tempel link TikTok — preview otomatis diputar &amp; hasil download masuk ke Galeri.</p>
        </div>
        <span class="tag">NO WATERMARK</span>
      </div>

      <form id="ttForm" class="input-row">
        <input
          id="ttInput"
          class="brutal-input"
          type="url"
          placeholder="https://vt.tiktok.com/..."
          autocomplete="off"
          required
        />
        <button type="button" id="ttPaste" class="btn btn-cyan">Tempel</button>
        <button type="submit" id="ttSubmit" class="btn btn-primary">Ambil Video</button>
      </form>

      <div id="ttFeedback"></div>
      <div id="ttResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true } }) {
    const form = root.querySelector("#ttForm");
    const input = root.querySelector("#ttInput");
    const pasteBtn = root.querySelector("#ttPaste");
    const submitBtn = root.querySelector("#ttSubmit");
    const feedback = root.querySelector("#ttFeedback");
    const resultEl = root.querySelector("#ttResult");

    let currentData = null;

    function setFeedback(type, msg) {
      if (!msg) {
        feedback.innerHTML = "";
        return;
      }
      const cls = type === "error" ? "alert alert-error" : "alert alert-info";
      feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
    }

    function renderResult(data) {
      if (data.status !== "success" && (!data.downloads || !data.downloads.length)) {
        const reason =
          data.status === "invalid_link"
            ? "Link TikTok tidak valid atau tidak ditemukan."
            : data.status === "blocked"
              ? "Permintaan diblokir sementara oleh provider. Coba lagi sebentar."
              : data.message || `Status: ${data.status}`;
        setFeedback("error", reason);
        resultEl.innerHTML = "";
        return;
      }

      currentData = data;
      setFeedback("", "");

      const downloads = data.downloads || [];
      const previewItem =
        downloads.find((d) => d.type === "video_hd_no_watermark") ||
        downloads.find((d) => d.type === "video_no_watermark") ||
        downloads.find((d) => d.type !== "audio_mp3") ||
        null;

      const previewHtml = previewItem
        ? `<video
            id="ttPreviewVideo"
            class="video-preview"
            src="${escapeHtml(makeProxyUrl(API_BASE, previewItem.url))}"
            ${data.thumbnail ? `poster="${escapeHtml(data.thumbnail)}"` : ""}
            controls
            autoplay
            muted
            playsinline
            loop
            preload="auto"
          ></video>`
        : data.thumbnail
          ? `<img class="thumb" src="${escapeHtml(data.thumbnail)}" alt="Thumbnail" loading="lazy" />`
          : "";

      const statsHtml = data.stats
        ? `<div class="stats-row">${Object.entries(data.stats)
          .map(([k, v]) => `<span class="stat-chip">${escapeHtml(k)}: ${escapeHtml(v)}</span>`)
          .join("")}</div>`
        : "";

      const allButtons = [...downloads];
      if (data.music && !downloads.some((d) => d.url === data.music.url)) {
        allButtons.push({
          type: "audio_mp3",
          label: data.music.label || "Unduh MP3",
          url: data.music.url,
        });
      }

      const downloadsHtml = allButtons
        .map((dl, idx) => {
          const isAudio = dl.type === "audio_mp3";
          const cls = idx === 0 ? "btn btn-success" : isAudio ? "btn btn-cyan" : "btn";
          return `<button
            type="button"
            class="${cls}"
            data-dl-url="${escapeHtml(dl.url)}"
            data-dl-kind="${isAudio ? "audio" : "video"}"
          >${escapeHtml(dl.label)}</button>`;
        })
        .join("");

      const avatarSrc = data.avatar ? makeProxyUrl(API_BASE, data.avatar) : "";
      const authorRowHtml = `
        <div class="author-row">
          ${avatarSrc ? `<img class="author-avatar" src="${escapeHtml(avatarSrc)}" alt="${escapeHtml(data.author || "Avatar")}" loading="lazy" />` : `<span class="author-avatar author-fallback">TT</span>`}
          <div class="author-info">
            <h3>${escapeHtml(data.author || "Kreator TikTok")}</h3>
          </div>
        </div>
      `;

      const hasCaption = Boolean(data.title && data.title.trim());
      const captionHtml = hasCaption
        ? `
          <div class="caption-box">
            <div class="caption-head">
              <span class="caption-label">CAPTION</span>
              <div class="caption-actions">
                <button type="button" class="btn btn-sm" id="ttCopySel">Salin Pilihan</button>
                <button type="button" class="btn btn-sm btn-primary" id="ttCopyAll">Salin Semua</button>
              </div>
            </div>
            <p class="result-caption" id="ttCaptionText">${escapeHtml(data.title)}</p>
          </div>
        `
        : `<p class="result-caption">Tanpa caption</p>`;

      resultEl.innerHTML = `
        <article class="result-card">
          ${previewHtml}
          <div class="result-meta">
            ${authorRowHtml}
            ${captionHtml}
            ${statsHtml}
            <div class="dl-list">${downloadsHtml}</div>
          </div>
        </article>
      `;

      const videoEl = resultEl.querySelector("#ttPreviewVideo");
      if (videoEl) {
        videoEl.play().catch(() => { });
      }
    }

    async function handleDownload(btn) {
      if (!currentData) return;
      const remoteUrl = btn.dataset.dlUrl;
      const isAudio = btn.dataset.dlKind === "audio";
      const filename = buildFilename(currentData, isAudio);
      const origText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Menyiapkan...";

      try {
        // Jika berjalan di APK Capacitor Android, simpan ke Download/Blackpage/{video|audio}
        if (window.Capacitor?.isNativePlatform?.()) {
          const res = await fetch(makeProxyUrl(API_BASE, remoteUrl));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const savedPath = await saveOnAndroidCapacitor(blob, filename, isAudio);
          if (savedPath) {
            if (prefs.autoSaveGallery !== false) {
              saveToGallery({
                ...currentData,
                mediaUrl: remoteUrl,
                mediaType: isAudio ? "audio" : "video",
                filename,
              });
            }
            setFeedback("info", `Tersimpan di ${savedPath}!`);
            return;
          }
        }

        // Di Web: trigger download browser supaya user bebas pilih lokasi simpan
        const dlUrl = makeProxyUrl(API_BASE, remoteUrl, { download: true, filename });
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        if (prefs.autoSaveGallery !== false) {
          saveToGallery({
            ...currentData,
            mediaUrl: remoteUrl,
            mediaType: isAudio ? "audio" : "video",
            filename,
          });
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

    async function runFetch(targetUrl) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";
      setFeedback("info", "Mengambil data video...");
      resultEl.innerHTML = "";

      try {
        const res = await fetch(`${API_BASE}/api/tiktok`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || `HTTP ${res.status}`);
        }
        renderResult(data);
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengambil video.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Ambil Video";
      }
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (!val) return;
      runFetch(val);
    });

    input.addEventListener("paste", () => {
      setTimeout(() => {
        const val = input.value.trim();
        if (prefs.autoAnalyze && /tiktok\.com/i.test(val)) {
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
          if (prefs.autoAnalyze && /tiktok\.com/i.test(val)) {
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
          if (/tiktok\.com/i.test(val)) {
            input.value = val;
            if (prefs.autoAnalyze) runFetch(val);
          }
        })
        .catch(() => {});
    }

    resultEl.addEventListener("click", async (e) => {
      const copyAllBtn = e.target.closest("#ttCopyAll");
      if (copyAllBtn && currentData?.title) {
        try {
          await navigator.clipboard.writeText(currentData.title);
          copyAllBtn.textContent = "Tersalin!";
          setTimeout(() => (copyAllBtn.textContent = "Salin Semua"), 1400);
        } catch {
          setFeedback("error", "Gagal menyalin caption ke clipboard.");
        }
        return;
      }

      const copySelBtn = e.target.closest("#ttCopySel");
      if (copySelBtn) {
        const captionEl = resultEl.querySelector("#ttCaptionText");
        const sel = window.getSelection();
        const selected =
          sel && sel.rangeCount > 0 && captionEl && captionEl.contains(sel.anchorNode)
            ? sel.toString()
            : "";
        if (!selected.trim()) {
          setFeedback("info", "Blok/pilih dulu bagian teks caption yang mau disalin.");
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

      const btn = e.target.closest("[data-dl-url]");
      if (btn && !btn.disabled) {
        handleDownload(btn);
      }
    });
  },
};
