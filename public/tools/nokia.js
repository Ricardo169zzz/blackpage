import { makeProxyUrl, downloadMediaFile, openStickerLightbox } from "./download.js";

function getTodayDateStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function getNowTimeStr() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
}

export const nokiaTool = {
  id: "nokia-sms",
  name: "Nokia SMS",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">Nokia Retro SMS Generator</h2>
          <p class="stage-desc">Buat gambar layar SMS Nokia jadul dengan pesan custom.</p>
        </div>
        <span class="tag">PNG</span>
      </div>

      <form id="nokiaForm" class="input-row">
        <textarea
          id="nokiaText"
          class="brutal-input"
          rows="3"
          maxlength="200"
          placeholder="Isi pesan SMS (mis. kata-kata hari ini)..."
          required
          style="grid-column: 1 / -1; resize: vertical;"
        ></textarea>
        <input
          id="nokiaFrom"
          class="brutal-input"
          type="text"
          maxlength="30"
          placeholder="Dari (mis. nexa)"
          value="Blackpage"
        />
        <input
          id="nokiaTitle"
          class="brutal-input"
          type="text"
          maxlength="30"
          placeholder="Judul / Operator (mis. nexa)"
          value="Pesan Masuk"
        />
        <input
          id="nokiaDate"
          class="brutal-input"
          type="text"
          maxlength="12"
          placeholder="DD/MM/YYYY"
          value="${getTodayDateStr()}"
        />
        <input
          id="nokiaTime"
          class="brutal-input"
          type="text"
          maxlength="8"
          placeholder="HH:MM"
          value="${getNowTimeStr()}"
        />
        <button type="submit" id="nokiaSubmit" class="btn btn-primary" style="grid-column: 1 / -1;">Buat Gambar</button>
      </form>

      <div id="nokiaFeedback"></div>
      <div id="nokiaResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml }) {
    const form = root.querySelector("#nokiaForm");
    const textEl = root.querySelector("#nokiaText");
    const fromEl = root.querySelector("#nokiaFrom");
    const titleEl = root.querySelector("#nokiaTitle");
    const dateEl = root.querySelector("#nokiaDate");
    const timeEl = root.querySelector("#nokiaTime");
    const submitBtn = root.querySelector("#nokiaSubmit");
    const feedback = root.querySelector("#nokiaFeedback");
    const resultEl = root.querySelector("#nokiaResult");

    let currentUrl = "";
    let lastParams = null;

    function setFeedback(type, msg) {
      if (!msg) {
        feedback.innerHTML = "";
        return;
      }
      const cls = type === "error" ? "alert alert-error" : "alert alert-info";
      feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
    }

    function generate(paramsObj, attempt = 0) {
      lastParams = paramsObj;
      const qs = new URLSearchParams(paramsObj);
      if (attempt > 0) qs.set("_r", String(Date.now()));
      currentUrl = `https://api.nexadev.my.id/nokia?${qs.toString()}`;
      const previewSrc = makeProxyUrl(API_BASE, currentUrl);

      submitBtn.disabled = true;
      submitBtn.textContent = attempt > 0 ? "Mencoba ulang..." : "Membuat...";
      setFeedback("", "");

      resultEl.innerHTML = `
        <article class="result-card">
          <div class="brat-wrap is-loading" id="nokiaWrap">
            <div class="video-loader" style="color:var(--ink);">MEMUAT GAMBAR...</div>
            <img id="nokiaImg" class="thumb brat-img" src="${escapeHtml(previewSrc)}" alt="Nokia SMS" />
          </div>
          <div class="dl-list" id="nokiaDlWrap" hidden>
            <button type="button" class="btn btn-success" id="nokiaDlBtn">Unduh Gambar</button>
          </div>
        </article>
      `;

      const wrap = resultEl.querySelector("#nokiaWrap");
      const img = resultEl.querySelector("#nokiaImg");
      const dlWrap = resultEl.querySelector("#nokiaDlWrap");

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
            generate(paramsObj, attempt + 1);
            return;
          }
          resultEl.innerHTML = `
            <div class="alert alert-error">
              Server gambar gagal merespons sementara.
              <div style="margin-top:8px;">
                <button type="button" class="btn btn-sm" id="nokiaRetryBtn">Coba Lagi</button>
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
      const text = textEl.value.trim();
      if (!text) return;
      generate({
        text,
        from: fromEl.value.trim() || "Blackpage",
        date: dateEl.value.trim() || getTodayDateStr(),
        time: timeEl.value.trim() || getNowTimeStr(),
        title: titleEl.value.trim() || "Pesan Masuk",
      });
    });

    resultEl.addEventListener("click", async (e) => {
      const clickedImg = e.target.closest("#nokiaImg");
      if (clickedImg && !resultEl.querySelector("#nokiaWrap")?.classList.contains("is-loading")) {
        openStickerLightbox(clickedImg.src, "NOKIA SMS");
        return;
      }
      if (e.target.closest("#nokiaRetryBtn") && lastParams) {
        generate(lastParams, 1);
        return;
      }

      const dlBtn = e.target.closest("#nokiaDlBtn");
      if (!dlBtn || !currentUrl || dlBtn.disabled) return;

      const filename = `nokia_sms_${Date.now().toString().slice(-6)}.png`;
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
