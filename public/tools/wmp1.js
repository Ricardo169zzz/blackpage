import { makeProxyUrl, downloadMediaFile } from "./download.js";

export const wmp1Tool = {
  id: "wmp1-quote",
  name: "WMP1 Quote Maker",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">WMP1 Quote &amp; Teks Gambar</h2>
          <p class="stage-desc">Buat gambar teks estetik — pisahkan baris dengan Enter atau tanda <code>|</code>.</p>
        </div>
        <span class="tag">JPG</span>
      </div>

      <form id="wmpForm" class="input-row">
        <textarea
          id="wmpInput"
          class="brutal-input"
          rows="3"
          maxlength="240"
          placeholder="Contoh:&#10;ngapain cemburu&#10;kan&#10;cuman sebatas&#10;teman"
          required
          style="grid-column: 1 / -1; resize: vertical;"
        ></textarea>
        <button type="submit" id="wmpSubmit" class="btn btn-primary" style="grid-column: 1 / -1;">Buat Gambar</button>
      </form>

      <div id="wmpFeedback"></div>
      <div id="wmpResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml }) {
    const form = root.querySelector("#wmpForm");
    const input = root.querySelector("#wmpInput");
    const submitBtn = root.querySelector("#wmpSubmit");
    const feedback = root.querySelector("#wmpFeedback");
    const resultEl = root.querySelector("#wmpResult");

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

    function normalizeLines(raw) {
      return raw
        .split(/\r?\n|\|/)
        .map((s) => s.trim())
        .filter(Boolean)
        .join("|");
    }

    function generate(rawText, attempt = 0) {
      const normalized = normalizeLines(rawText);
      if (!normalized) return;
      currentText = normalized;
      const cacheBust = attempt > 0 ? `&_r=${Date.now()}` : "";
      currentUrl = `https://api.nexadev.my.id/wmp1?text=${encodeURIComponent(normalized)}${cacheBust}`;
      const previewSrc = makeProxyUrl(API_BASE, currentUrl);

      submitBtn.disabled = true;
      submitBtn.textContent = attempt > 0 ? "Mencoba ulang..." : "Membuat...";
      setFeedback("", "");

      resultEl.innerHTML = `
        <article class="result-card">
          <div class="brat-wrap is-loading" id="wmpWrap">
            <div class="video-loader" style="color:var(--ink);">MEMUAT GAMBAR...</div>
            <img id="wmpImg" class="thumb brat-img" src="${escapeHtml(previewSrc)}" alt="WMP1 Quote" />
          </div>
          <div class="dl-list" id="wmpDlWrap" hidden>
            <button type="button" class="btn btn-success" id="wmpDlBtn">Unduh Gambar (JPG)</button>
          </div>
        </article>
      `;

      const wrap = resultEl.querySelector("#wmpWrap");
      const img = resultEl.querySelector("#wmpImg");
      const dlWrap = resultEl.querySelector("#wmpDlWrap");

      img.addEventListener("load", () => {
        wrap.classList.remove("is-loading");
        dlWrap.hidden = false;
        setFeedback("", "");
        submitBtn.disabled = false;
        submitBtn.textContent = "Buat Gambar";
      }, { once: true });

      img.addEventListener("error", () => {
        if (attempt < 1) {
          generate(rawText, attempt + 1);
          return;
        }
        resultEl.innerHTML = `
          <div class="alert alert-error">
            Server gambar gagal merespons sementara.
            <div style="margin-top:8px;">
              <button type="button" class="btn btn-sm" id="wmpRetryBtn">Coba Lagi</button>
            </div>
          </div>
        `;
        submitBtn.disabled = false;
        submitBtn.textContent = "Buat Gambar";
      }, { once: true });
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = input.value.trim();
      if (val) generate(val);
    });

    resultEl.addEventListener("click", async (e) => {
      if (e.target.closest("#wmpRetryBtn") && currentText) {
        generate(currentText, 1);
        return;
      }

      const dlBtn = e.target.closest("#wmpDlBtn");
      if (!dlBtn || !currentUrl || dlBtn.disabled) return;

      const slug = currentText.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "quote";
      const filename = `wmp1_${slug}_${Date.now().toString().slice(-5)}.jpg`;
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
