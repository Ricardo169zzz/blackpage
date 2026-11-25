import { makeProxyUrl, downloadMediaFile } from "./download.js";

export const bratTool = {
  id: "brat-sticker",
  name: "Brat Sticker",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">Brat Sticker WA Generator</h2>
          <p class="stage-desc">Ketik teks apa saja untuk membuat gambar stiker WhatsApp.</p>
        </div>
        <span class="tag">PNG</span>
      </div>

      <div class="alert alert-info" style="margin-top:0;margin-bottom:12px;">
        Info: Server stiker terkadang mengalami Bad Gateway sementara. Jika gagal, cukup klik <strong>Coba Lagi</strong>.
      </div>

      <form id="bratForm" class="input-row">
        <input
          id="bratInput"
          class="brutal-input"
          type="text"
          maxlength="180"
          placeholder="Ketik teks stiker (mis. halo nexa)..."
          autocomplete="off"
          required
        />
        <button type="submit" id="bratSubmit" class="btn btn-primary" style="grid-column: 1 / -1;">Buat Stiker</button>
      </form>

      <div id="bratFeedback"></div>
      <div id="bratResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml }) {
    const form = root.querySelector("#bratForm");
    const input = root.querySelector("#bratInput");
    const submitBtn = root.querySelector("#bratSubmit");
    const feedback = root.querySelector("#bratFeedback");
    const resultEl = root.querySelector("#bratResult");

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
      currentUrl = `https://api.nexadev.my.id/api/canvas/brat/?text=${encodeURIComponent(text)}${cacheBust}`;
      const previewSrc = makeProxyUrl(API_BASE, currentUrl);

      submitBtn.disabled = true;
      submitBtn.textContent = attempt > 0 ? "Mencoba ulang..." : "Membuat...";
      setFeedback("", "");

      resultEl.innerHTML = `
        <article class="result-card">
          <div class="brat-wrap is-loading" id="bratWrap">
            <div class="video-loader" style="color:var(--ink);">MEMUAT STIKER...</div>
            <img id="bratImg" class="thumb brat-img" src="${escapeHtml(previewSrc)}" alt="Brat Sticker" />
          </div>
          <div class="dl-list" id="bratDlWrap" hidden>
            <button type="button" class="btn btn-success" id="bratDlBtn">Unduh Stiker (PNG)</button>
          </div>
        </article>
      `;

      const wrap = resultEl.querySelector("#bratWrap");
      const img = resultEl.querySelector("#bratImg");
      const dlWrap = resultEl.querySelector("#bratDlWrap");

      img.addEventListener("load", () => {
        wrap.classList.remove("is-loading");
        dlWrap.hidden = false;
        setFeedback("", "");
        submitBtn.disabled = false;
        submitBtn.textContent = "Buat Stiker";
      }, { once: true });

      img.addEventListener("error", () => {
        if (attempt < 1) {
          generate(text, attempt + 1);
          return;
        }
        resultEl.innerHTML = `
          <div class="alert alert-error">
            Server stiker gagal merespons (Bad Gateway). Biasanya percobaan berikutnya langsung berhasil.
            <div style="margin-top:8px;">
              <button type="button" class="btn btn-sm" id="bratRetryBtn">Coba Lagi</button>
            </div>
          </div>
        `;
        submitBtn.disabled = false;
        submitBtn.textContent = "Buat Stiker";
      }, { once: true });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) generate(val);
    });

    resultEl.addEventListener("click", async (e) => {
      if (e.target.closest("#bratRetryBtn") && currentText) {
        generate(currentText, 1);
        return;
      }

      const dlBtn = e.target.closest("#bratDlBtn");
      if (!dlBtn || !currentUrl || dlBtn.disabled) return;

      const slug = currentText.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "sticker";
      const filename = `brat_${slug}_${Date.now().toString().slice(-5)}.png`;
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
        setFeedback("info", res.native ? `Tersimpan di ${res.path}!` : "Download stiker dimulai!");
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh stiker.");
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = origText;
      }
    });
  },
};
