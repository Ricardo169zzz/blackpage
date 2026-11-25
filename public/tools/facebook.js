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
  const list = loadGallery().filter((x) => !(x.url === entry.url && x.mediaUrl === entry.mediaUrl));
  list.unshift({
    url: entry.url,
    author: "Facebook",
    title: entry.title || entry.url,
    thumbnail: null,
    mediaUrl: entry.mediaUrl,
    mediaType: "video",
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

async function saveOnAndroidCapacitor(blob, filename) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;
  if (!cap?.isNativePlatform?.() || !fs) return false;

  const targetPath = `Download/Blackpage/video/${filename}`;
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

function isFbUrl(val) {
  return /(facebook\.com|fb\.watch)/i.test(val);
}

export const facebookTool = {
  id: "facebook-dl",
  name: "Facebook Downloader",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">Facebook Video &amp; Reels Downloader</h2>
          <p class="stage-desc">Tempel link Facebook Watch, Reels, atau Share — preview &amp; unduh HD / SD.</p>
        </div>
        <span class="tag">HD / SD</span>
      </div>

      <form id="fbForm" class="input-row">
        <input
          id="fbInput"
          class="brutal-input"
          type="url"
          placeholder="https://www.facebook.com/share/r/..."
          autocomplete="off"
          required
        />
        <button type="button" id="fbPaste" class="btn btn-cyan">Tempel</button>
        <button type="submit" id="fbSubmit" class="btn btn-primary">Ambil Video</button>
      </form>

      <div id="fbFeedback"></div>
      <div id="fbResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true, autoSaveGallery: true } }) {
    const form = root.querySelector("#fbForm");
    const input = root.querySelector("#fbInput");
    const pasteBtn = root.querySelector("#fbPaste");
    const submitBtn = root.querySelector("#fbSubmit");
    const feedback = root.querySelector("#fbFeedback");
    const resultEl = root.querySelector("#fbResult");

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
      currentData = data;
      setFeedback("", "");

      const downloads = data.downloads || [];
      const preview = downloads.find((d) => /hd/i.test(d.quality)) || downloads[0];
      const previewHtml = preview
        ? `<video id="fbPreviewVideo" class="video-preview" src="${escapeHtml(makeProxyUrl(API_BASE, preview.url))}" controls autoplay muted playsinline loop preload="auto"></video>`
        : "";

      const buttonsHtml = downloads
        .map(
          (dl, idx) => `
          <button
            type="button"
            class="${idx === 0 ? "btn btn-success" : "btn"}"
            data-fb-idx="${idx}"
          >
            Unduh Video (${escapeHtml(dl.quality || "MP4")})
          </button>
        `
        )
        .join("");

      resultEl.innerHTML = `
        <article class="result-card">
          ${previewHtml}
          <div class="result-meta">
            <div class="author-row">
              <span class="author-avatar author-fallback">FB</span>
              <div class="author-info">
                <h3>Facebook Video</h3>
              </div>
            </div>
            <div class="dl-list">${buttonsHtml}</div>
          </div>
        </article>
      `;

      const videoEl = resultEl.querySelector("#fbPreviewVideo");
      if (videoEl) videoEl.play().catch(() => {});
    }

    async function handleDownload(btn, idx) {
      const dl = currentData?.downloads?.[idx];
      if (!dl) return;

      const q = (dl.quality || "mp4").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const filename = `facebook_${q}_${Date.now().toString().slice(-6)}.mp4`;
      const origText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Menyiapkan...";

      try {
        if (window.Capacitor?.isNativePlatform?.()) {
          const res = await fetch(makeProxyUrl(API_BASE, dl.url));
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const blob = await res.blob();
          const savedPath = await saveOnAndroidCapacitor(blob, filename);
          if (savedPath) {
            if (prefs.autoSaveGallery !== false) {
              saveToGallery({
                url: currentData.url,
                title: `Facebook Video (${dl.quality || "MP4"})`,
                mediaUrl: dl.url,
                filename,
              });
            }
            setFeedback("info", `Tersimpan di ${savedPath}!`);
            return;
          }
        }

        const dlUrl = makeProxyUrl(API_BASE, dl.url, { download: true, filename });
        const a = document.createElement("a");
        a.href = dlUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();

        if (prefs.autoSaveGallery !== false) {
          saveToGallery({
            url: currentData.url,
            title: `Facebook Video (${dl.quality || "MP4"})`,
            mediaUrl: dl.url,
            filename,
          });
          setFeedback("info", "Download dimulai & otomatis tersimpan di Galeri!");
        } else {
          setFeedback("info", "Download dimulai!");
        }
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh video.");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }

    async function runFetch(targetUrl) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";
      setFeedback("info", "Mengambil video Facebook...");
      resultEl.innerHTML = "";

      try {
        const res = await fetch(`${API_BASE}/api/facebook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        renderResult(data);
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengambil video Facebook.");
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
        if (prefs.autoAnalyze && isFbUrl(val)) {
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
          if (prefs.autoAnalyze && isFbUrl(val)) {
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
          if (isFbUrl(val)) {
            input.value = val;
            if (prefs.autoAnalyze) runFetch(val);
          }
        })
        .catch(() => {});
    }

    resultEl.addEventListener("click", (e) => {
      const dlBtn = e.target.closest("[data-fb-idx]");
      if (dlBtn && !dlBtn.disabled) {
        handleDownload(dlBtn, Number(dlBtn.dataset.fbIdx));
      }
    });
  },
};
