import { makeProxyUrl, downloadMediaFile, renderProgressHtml } from "./download.js";

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
  const list = loadGallery().filter((x) => !(x.url === entry.url && x.mediaType === "audio"));
  list.unshift({
    url: entry.url,
    author: entry.artist || "Spotify",
    title: `${entry.title} — ${entry.artist}`,
    thumbnail: entry.cover || null,
    mediaUrl: entry.mp3Url,
    mediaType: "audio",
    filename: entry.filename,
    downloadedAt: Date.now(),
  });
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, MAX_GALLERY)));
}

export const spotifyTool = {
  id: "spotify-dl",
  name: "Spotify Downloader",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">Spotify MP3 Downloader</h2>
          <p class="stage-desc">Cari judul lagu, tempel link lagu, atau link playlist Spotify.</p>
        </div>
        <span class="tag">MP3</span>
      </div>

      <div class="cat-bar" id="spModeBar">
        <button type="button" class="cat-pill active" data-sp-mode="single">LAGU</button>
        <button type="button" class="cat-pill" data-sp-mode="playlist">PLAYLIST</button>
      </div>

      <form id="spForm" class="input-row">
        <input
          id="spInput"
          class="brutal-input"
          type="text"
          placeholder="Judul lagu (mis. Karena Kamu) atau link Spotify..."
          autocomplete="off"
          required
        />
        <button type="button" id="spPaste" class="btn btn-cyan">Tempel</button>
        <button type="submit" id="spSubmit" class="btn btn-primary">Cari Lagu</button>
      </form>

      <div id="spFeedback"></div>
      <div id="spResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true, autoSaveGallery: true } }) {
    const form = root.querySelector("#spForm");
    const modeBar = root.querySelector("#spModeBar");
    const input = root.querySelector("#spInput");
    const pasteBtn = root.querySelector("#spPaste");
    const submitBtn = root.querySelector("#spSubmit");
    const feedback = root.querySelector("#spFeedback");
    const resultEl = root.querySelector("#spResult");

    let currentMode = "single";
    let currentData = null;

    function setMode(mode) {
      currentMode = mode;
      modeBar.querySelectorAll("[data-sp-mode]").forEach((b) => {
        b.classList.toggle("active", b.dataset.spMode === mode);
      });
      input.placeholder =
        mode === "playlist"
          ? "https://open.spotify.com/playlist/..."
          : "Judul lagu (mis. Karena Kamu) atau link Spotify...";
      submitBtn.textContent = mode === "playlist" ? "Ambil Playlist" : "Cari Lagu";
      setFeedback("", "");
      resultEl.innerHTML = "";
    }

    modeBar.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-sp-mode]");
      if (btn) setMode(btn.dataset.spMode);
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

      const audioSrc = makeProxyUrl(API_BASE, data.mp3Url);
      const coverSrc = data.cover ? makeProxyUrl(API_BASE, data.cover) : "";
      const chips = [
        data.album ? `ALBUM: ${data.album}` : null,
        data.duration ? `DURASI: ${data.duration}` : null,
        data.year ? `TAHUN: ${data.year}` : null,
      ]
        .filter(Boolean)
        .map((c) => `<span class="stat-chip">${escapeHtml(c)}</span>`)
        .join("");

      resultEl.innerHTML = `
        <article class="result-card">
          ${coverSrc ? `<img class="thumb" src="${escapeHtml(coverSrc)}" alt="Cover Album" loading="lazy" />` : ""}
          <audio id="spAudioPreview" class="audio-preview" src="${escapeHtml(audioSrc)}" controls autoplay preload="auto"></audio>

          <div class="result-meta">
            <div class="author-row">
              <span class="author-avatar author-fallback">SP</span>
              <div class="author-info">
                <h3>${escapeHtml(data.artist || "Spotify")}</h3>
              </div>
            </div>

            <div class="caption-box">
              <div class="caption-head">
                <span class="caption-label">JUDUL LAGU</span>
                <button type="button" class="btn btn-sm btn-primary" id="spCopyTitle">Salin Judul</button>
              </div>
              <p class="result-caption">${escapeHtml(data.title || "Spotify Track")}</p>
            </div>

            ${chips ? `<div class="stats-row">${chips}</div>` : ""}

            <div class="dl-list">
              <button type="button" class="btn btn-success" id="spDlBtn">Unduh MP3</button>
              ${data.spotifyUrl ? `<a class="btn" href="${escapeHtml(data.spotifyUrl)}" target="_blank" rel="noopener noreferrer">Buka di Spotify</a>` : ""}
            </div>
          </div>
        </article>
      `;

      const audioEl = resultEl.querySelector("#spAudioPreview");
      if (audioEl) audioEl.play().catch(() => {});
    }

    async function handleDownload(btn) {
      if (!currentData) return;
      const base = `${currentData.title || "spotify"}_${currentData.artist || ""}`
        .replace(/[^a-zA-Z0-9._-]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "spotify";
      const filename = `${base}.mp3`;
      const origText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Menyiapkan...";

      try {
        const res = await downloadMediaFile({
          API_BASE,
          remoteUrl: currentData.mp3Url,
          mediaType: "audio",
          filename,
          onProgress: (p) => {
            btn.textContent = typeof p.percent === "number" ? `${p.percent}%` : "Mengunduh...";
            feedbackEl.innerHTML = renderProgressHtml({ label: "Mengunduh MP3...", ...p });
          },
        });

        if (prefs.autoSaveGallery !== false) {
          saveToGallery({
            ...currentData,
            url: currentData.spotifyUrl || currentData.query,
            filename,
          });
          setFeedback(
            "info",
            res.native
              ? `Tersimpan di ${res.path} & masuk ke Galeri!`
              : "Download MP3 dimulai & otomatis tersimpan di Galeri!"
          );
        } else {
          setFeedback("info", res.native ? `Tersimpan di ${res.path}!` : "Download MP3 dimulai!");
        }
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh MP3.");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }

    let currentPlaylist = null;
    let queueAborted = false;

    function renderPlaylistResult(data) {
      setFeedback("", "");
      currentPlaylist = data;
      const plCover = data.cover ? makeProxyUrl(API_BASE, data.cover) : "";
      const tracksHtml = (data.tracks || [])
        .map((tr, i) => {
          const thumb = tr.cover ? makeProxyUrl(API_BASE, tr.cover) : "";
          return `
            <div class="gallery-row-card">
              ${thumb ? `<img class="gallery-thumb" src="${escapeHtml(thumb)}" alt="Cover" loading="lazy" />` : `<span class="gallery-thumb gallery-thumb-fallback">MP3</span>`}
              <div class="gallery-row-body">
                <div class="gallery-row-top">
                  ${tr.duration ? `<span class="tag">${escapeHtml(tr.duration)}</span>` : ""}
                  <strong class="gallery-author">${escapeHtml(tr.artists || "Spotify")}</strong>
                </div>
                <p class="gallery-row-title">${escapeHtml(tr.title)}</p>
              </div>
              <button type="button" class="btn btn-sm btn-primary" data-sp-idx="${i}" data-sp-track="${escapeHtml(tr.title)}">Ambil</button>
            </div>
          `;
        })
        .join("");

      resultEl.innerHTML = `
        <div class="result-card">
          <div class="author-row" style="margin-bottom:4px;">
            ${plCover ? `<img class="author-avatar" src="${escapeHtml(plCover)}" alt="Playlist Cover" />` : `<span class="author-avatar author-fallback">PL</span>`}
            <div class="author-info">
              <h3>${escapeHtml(data.title || "Spotify Playlist")}</h3>
            </div>
            <div class="pl-head-actions">
              <span class="tag">${(data.tracks || []).length} LAGU</span>
              <button type="button" class="btn btn-sm btn-success" id="spPlDownloadAll">Download Semua</button>
            </div>
          </div>
          <div id="spPlQueueStatus"></div>
          <div class="gallery-list">${tracksHtml}</div>
        </div>
      `;
    }

    async function runPlaylistQueue(btn) {
      const tracks = currentPlaylist?.tracks || [];
      if (!tracks.length) return;
      if (btn.dataset.running === "1") {
        queueAborted = true;
        btn.textContent = "Membatalkan...";
        return;
      }

      queueAborted = false;
      btn.dataset.running = "1";
      btn.textContent = "Batal";
      const statusEl = resultEl.querySelector("#spPlQueueStatus");
      let okCount = 0;
      let failCount = 0;

      for (let i = 0; i < tracks.length; i++) {
        if (queueAborted) break;
        const tr = tracks[i];
        const rowBtn = resultEl.querySelector(`[data-sp-idx="${i}"]`);
        if (rowBtn) {
          rowBtn.disabled = true;
          rowBtn.textContent = "...";
        }
        const label = `Antrean ${i + 1}/${tracks.length}: ${tr.title || "Lagu"}`;
        if (statusEl) statusEl.innerHTML = renderProgressHtml({ label, percent: null });

        try {
          const res = await fetch(`${API_BASE}/api/spotify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: tr.title }),
          });
          const data = await res.json();
          if (!res.ok || !data.mp3Url) throw new Error(data.message || `HTTP ${res.status}`);

          const base = `${data.title || "spotify"}_${data.artist || ""}`
            .replace(/[^a-zA-Z0-9._-]+/g, "_")
            .replace(/^_+|_+$/g, "")
            .slice(0, 60) || "spotify";
          const filename = `${base}.mp3`;

          await downloadMediaFile({
            API_BASE,
            remoteUrl: data.mp3Url,
            mediaType: "audio",
            filename,
            onProgress: (p) => {
              if (statusEl) statusEl.innerHTML = renderProgressHtml({ label, ...p });
            },
          });

          if (prefs.autoSaveGallery !== false) {
            saveToGallery({
              ...data,
              url: data.spotifyUrl || data.query,
              filename,
            });
          }
          okCount++;
          if (rowBtn) rowBtn.textContent = "✓";
        } catch {
          failCount++;
          if (rowBtn) {
            rowBtn.textContent = "Gagal";
            rowBtn.disabled = false;
          }
        }
      }

      delete btn.dataset.running;
      btn.textContent = "Download Semua";
      if (statusEl) {
        statusEl.innerHTML = `<div class="alert alert-info">${
          queueAborted
            ? `Antrean dihentikan. Berhasil: ${okCount}, Gagal: ${failCount}.`
            : `Antrean selesai! Berhasil: ${okCount}/${tracks.length}${failCount ? `, Gagal: ${failCount}` : ""}.`
        }</div>`;
      }
    }

    async function runFetch(query) {
      const isPlaylist = currentMode === "playlist" || /open\.spotify\.com\/playlist\//i.test(query);
      if (isPlaylist && currentMode !== "playlist") setMode("playlist");

      submitBtn.disabled = true;
      submitBtn.textContent = "Mencari...";
      setFeedback("info", isPlaylist ? "Mengambil daftar lagu playlist..." : "Mencari lagu di Spotify...");
      resultEl.innerHTML = "";

      try {
        if (isPlaylist) {
          const res = await fetch(`${API_BASE}/api/spotify/playlist`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: query }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
          renderPlaylistResult(data);
        } else {
          const res = await fetch(`${API_BASE}/api/spotify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ q: query }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
          renderResult(data);
        }
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengambil data Spotify.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = currentMode === "playlist" ? "Ambil Playlist" : "Cari Lagu";
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
        if (prefs.autoAnalyze && /open\.spotify\.com/i.test(val)) {
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
          if (prefs.autoAnalyze && /open\.spotify\.com/i.test(val)) {
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
          if (/open\.spotify\.com/i.test(val)) {
            input.value = val;
            if (prefs.autoAnalyze) runFetch(val);
          }
        })
        .catch(() => {});
    }

    resultEl.addEventListener("click", async (e) => {
      const plAllBtn = e.target.closest("#spPlDownloadAll");
      if (plAllBtn) {
        runPlaylistQueue(plAllBtn);
        return;
      }

      const trBtn = e.target.closest("[data-sp-track]");
      if (trBtn) {
        setMode("single");
        input.value = trBtn.dataset.spTrack;
        runFetch(trBtn.dataset.spTrack);
        return;
      }

      const copyBtn = e.target.closest("#spCopyTitle");
      if (copyBtn && currentData?.title) {
        try {
          await navigator.clipboard.writeText(`${currentData.title} - ${currentData.artist}`);
          copyBtn.textContent = "Tersalin!";
          setTimeout(() => (copyBtn.textContent = "Salin Judul"), 1400);
        } catch {
          setFeedback("error", "Gagal menyalin judul.");
        }
        return;
      }

      const dlBtn = e.target.closest("#spDlBtn");
      if (dlBtn && !dlBtn.disabled) {
        handleDownload(dlBtn);
      }
    });
  },
};
