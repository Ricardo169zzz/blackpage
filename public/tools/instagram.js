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
  const list = loadGallery().filter((x) => !(x.url === entry.url && x.mediaUrl === entry.mediaUrl));
  list.unshift({
    url: entry.url,
    author: "Instagram",
    title: entry.title || entry.url,
    thumbnail: entry.thumbnail || null,
    mediaUrl: entry.mediaUrl,
    mediaType: "video",
    filename: entry.filename,
    downloadedAt: Date.now(),
  });
  localStorage.setItem(GALLERY_KEY, JSON.stringify(list.slice(0, MAX_GALLERY)));
}

function isIgUrl(val) {
  return /(instagram\.com|instagr\.am)/i.test(val);
}

export const instagramTool = {
  id: "instagram-dl",
  name: "Instagram Downloader",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">Instagram Reels &amp; Post Downloader</h2>
          <p class="stage-desc">Tempel link Reels, Video, atau Foto Instagram — preview otomatis &amp; unduh cepat.</p>
        </div>
        <span class="tag">REELS / POST</span>
      </div>

      <form id="igForm" class="input-row">
        <input
          id="igInput"
          class="brutal-input"
          type="url"
          placeholder="https://www.instagram.com/reel/..."
          autocomplete="off"
          required
        />
        <button type="button" id="igPaste" class="btn btn-cyan">Tempel</button>
        <button type="submit" id="igSubmit" class="btn btn-primary">Ambil Media</button>
      </form>

      <div id="igFeedback"></div>
      <div id="igResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml, prefs = { autoPaste: false, autoAnalyze: true, autoSaveGallery: true } }) {
    const form = root.querySelector("#igForm");
    const input = root.querySelector("#igInput");
    const pasteBtn = root.querySelector("#igPaste");
    const submitBtn = root.querySelector("#igSubmit");
    const feedback = root.querySelector("#igFeedback");
    const resultEl = root.querySelector("#igResult");

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

      const cardsHtml = (data.items || [])
        .map((item, idx) => {
          const isVideo = item.type === "mp4" || item.type === "video";
          const mediaSrc = makeProxyUrl(API_BASE, item.url);
          const previewHtml = isVideo
            ? `<video class="video-preview ig-preview" src="${escapeHtml(mediaSrc)}" controls autoplay muted playsinline loop preload="auto"></video>`
            : `<img class="thumb" src="${escapeHtml(mediaSrc)}" alt="Instagram Media ${idx + 1}" loading="lazy" />`;

          return `
            <article class="result-card">
              ${previewHtml}
              <div class="dl-list">
                <button
                  type="button"
                  class="btn btn-success"
                  data-ig-idx="${idx}"
                >
                  Unduh ${isVideo ? "Video (MP4)" : "Foto"} ${data.items.length > 1 ? `#${idx + 1}` : ""}
                </button>
              </div>
            </article>
          `;
        })
        .join("");

      resultEl.innerHTML = cardsHtml;
      resultEl.querySelectorAll("video.ig-preview").forEach((v) => v.play().catch(() => {}));
    }

    async function handleDownload(btn, idx) {
      const item = currentData?.items?.[idx];
      if (!item) return;

      const isVideo = item.type === "mp4" || item.type === "video";
      const ext = item.type || (isVideo ? "mp4" : "jpg");
      const filename = `instagram_${Date.now().toString().slice(-6)}_${idx + 1}.${ext}`;
      const origText = btn.textContent;

      btn.disabled = true;
      btn.textContent = "Menyiapkan...";

      try {
        const res = await downloadMediaFile({
          API_BASE,
          remoteUrl: item.url,
          mediaType: isVideo ? "video" : "image",
          filename,
          onProgress: (p) => {
            btn.textContent = typeof p.percent === "number" ? `${p.percent}%` : "Mengunduh...";
            feedbackEl.innerHTML = renderProgressHtml({ label: "Mengunduh media...", ...p });
          },
        });

        if (isVideo && prefs.autoSaveGallery !== false) {
          saveToGallery({
            url: currentData.url,
            title: `Instagram Reels / Video`,
            mediaUrl: item.url,
            filename,
          });
          setFeedback(
            "info",
            res.native
              ? `Tersimpan di ${res.path} & masuk ke Galeri!`
              : "Download dimulai & otomatis tersimpan di Galeri!"
          );
        } else {
          setFeedback("info", res.native ? `Tersimpan di ${res.path}!` : "Download dimulai!");
        }
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh media.");
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    }

    async function runFetch(targetUrl) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Memproses...";
      setFeedback("info", "Mengambil media Instagram...");
      resultEl.innerHTML = "";

      try {
        const res = await fetch(`${API_BASE}/api/instagram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: targetUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        renderResult(data);
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengambil media Instagram.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Ambil Media";
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
        if (prefs.autoAnalyze && isIgUrl(val)) {
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
          if (prefs.autoAnalyze && isIgUrl(val)) {
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
          if (isIgUrl(val)) {
            input.value = val;
            if (prefs.autoAnalyze) runFetch(val);
          }
        })
        .catch(() => {});
    }

    resultEl.addEventListener("click", (e) => {
      const dlBtn = e.target.closest("[data-ig-idx]");
      if (dlBtn && !dlBtn.disabled) {
        handleDownload(dlBtn, Number(dlBtn.dataset.igIdx));
      }
    });
  },
};
