import { makeProxyUrl, downloadMediaFile, openStickerLightbox } from "./download.js";

export const iqcTool = {
  id: "iqc-quote",
  name: "IQC Quote",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">IQC iPhone Quote Generator</h2>
          <p class="stage-desc">Buat gambar chat/quote ala layar iPhone dengan cepat.</p>
        </div>
        <span class="tag">PNG</span>
      </div>

      <form id="iqcForm" class="input-row">
        <textarea
          id="iqcInput"
          class="brutal-input"
          rows="3"
          maxlength="200"
          placeholder="Ketik teks quote (mis. Tetap tenang, semua ada waktunya.)..."
          required
          style="grid-column: 1 / -1; resize: vertical;"
        ></textarea>
        <button type="submit" id="iqcSubmit" class="btn btn-primary" style="grid-column: 1 / -1;">Buat Gambar</button>
      </form>

      <div id="iqcFeedback"></div>
      <div id="iqcResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml }) {
    const form = root.querySelector("#iqcForm");
    const input = root.querySelector("#iqcInput");
    const submitBtn = root.querySelector("#iqcSubmit");
    const feedback = root.querySelector("#iqcFeedback");
    const resultEl = root.querySelector("#iqcResult");

    let currentUrl = "";
    let currentText = "";

    function setFeedback(type, msg) {
      if (!msg) {
        feedback.innerHTML = "";
        return;
      }
      const cls = type === "error" ? "alert alert-error" : "alert alert-info";
      feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
    }

    function generate(text, attempt = 0) {
      currentText = text;
      const cacheBust = attempt > 0 ? `&_r=${Date.now()}` : "";
      currentUrl = `https://api.nexadev.my.id/api/canvas/iqc?text=${encodeURIComponent(text)}${cacheBust}`;
      const previewSrc = makeProxyUrl(API_BASE, currentUrl);

      submitBtn.disabled = true;
      submitBtn.textContent = attempt > 0 ? "Mencoba ulang..." : "Membuat...";
      setFeedback("", "");

      resultEl.innerHTML = `
        <article class="result-card">
          <div class="brat-wrap is-loading" id="iqcWrap">
            <div class="video-loader" style="color:var(--ink);">MEMUAT GAMBAR...</div>
            <img id="iqcImg" class="thumb brat-img" src="${escapeHtml(previewSrc)}" alt="IQC Quote" />
          </div>
          <div class="dl-list" id="iqcDlWrap" hidden>
            <button type="button" class="btn btn-success" id="iqcDlBtn">Unduh Gambar</button>
          </div>
        </article>
      `;

      const wrap = resultEl.querySelector("#iqcWrap");
      const img = resultEl.querySelector("#iqcImg");
      const dlWrap = resultEl.querySelector("#iqcDlWrap");

      img.addEventListener(
        "load",
        () => {
          wrap.classList.remove("is-loading");
          dlWrap.hidden = false;
          setFeedback("", "");
          submitBtn.disabled = false;
          submitBtn.textContent = "Buat Gambar";
        },
        { once: true }
      );

      img.addEventListener(
        "error",
        () => {
          if (attempt < 1) {
            generate(text, attempt + 1);
            return;
          }
          resultEl.innerHTML = `
            <div class="alert alert-error">
              Server gambar gagal merespons sementara.
              <div style="margin-top:8px;">
                <button type="button" class="btn btn-sm" id="iqcRetryBtn">Coba Lagi</button>
              </div>
            </div>
          `;
          submitBtn.disabled = false;
          submitBtn.textContent = "Buat Gambar";
        },
        { once: true }
      );
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) generate(val);
    });

    resultEl.addEventListener("click", async (e) => {
      const clickedImg = e.target.closest("#iqcImg");
      if (clickedImg && !resultEl.querySelector("#iqcWrap")?.classList.contains("is-loading")) {
        openStickerLightbox(clickedImg.src, "IQC QUOTE");
        return;
      }
      if (e.target.closest("#iqcRetryBtn") && currentText) {
        generate(currentText, 1);
        return;
      }

      const dlBtn = e.target.closest("#iqcDlBtn");
      if (!dlBtn || !currentUrl || dlBtn.disabled) return;

      const slug =
        currentText
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 30) || "iqc";
      const filename = `iqc_${slug}_${Date.now().toString().slice(-5)}.png`;
      const origText = dlBtn.textContent;
      dlBtn.disabled = true;
      dlBtn.textContent = "Menyiapkan...";

      try {
        const res = await downloadMediaFile({
          API_BASE,
          remoteUrl: currentUrl,
          mediaType: "image",
          filename,
        });
        setFeedback("info", res.native ? `Tersimpan di ${res.path}!` : "Download gambar dimulai!");
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh gambar.");
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = origText;
      }
    });
  },
};
