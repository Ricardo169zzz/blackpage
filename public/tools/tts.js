import { downloadMediaFile, renderProgressHtml } from "./download.js";

export const ttsTool = {
  id: "tts-voice",
  name: "Text to Speech",
  badge: "READY",
  disabled: false,

  render() {
    return `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">Text to Speech (MP3)</h2>
          <p class="stage-desc">Ubah teks menjadi suara MP3 — bisa langsung diputar &amp; diunduh.</p>
        </div>
        <span class="tag">MP3</span>
      </div>

      <form id="ttsForm" class="input-row">
        <textarea
          id="ttsInput"
          class="brutal-input"
          rows="4"
          maxlength="1000"
          placeholder="Ketik teks yang ingin diubah menjadi suara..."
          required
          style="grid-column: 1 / -1; resize: vertical;"
        ></textarea>
        <select id="ttsLang" class="brutal-input" aria-label="Bahasa Suara" style="grid-column: 1 / -1;">
          <option value="id">Bahasa Indonesia (ID)</option>
          <option value="en">English (EN)</option>
          <option value="ja">Jepang (JA)</option>
          <option value="ko">Korea (KO)</option>
          <option value="ar">Arab (AR)</option>
        </select>
        <button type="submit" id="ttsSubmit" class="btn btn-primary" style="grid-column: 1 / -1;">Buat Suara</button>
      </form>

      <div id="ttsFeedback"></div>
      <div id="ttsResult"></div>
    `;
  },

  init(root, { API_BASE, escapeHtml }) {
    const form = root.querySelector("#ttsForm");
    const input = root.querySelector("#ttsInput");
    const langSel = root.querySelector("#ttsLang");
    const submitBtn = root.querySelector("#ttsSubmit");
    const feedback = root.querySelector("#ttsFeedback");
    const resultEl = root.querySelector("#ttsResult");

    let currentAudioUrl = "";
    let currentText = "";

    function setFeedback(type, msg) {
      if (!msg) {
        feedback.innerHTML = "";
        return;
      }
      const cls = type === "error" ? "alert alert-error" : "alert alert-info";
      feedback.innerHTML = `<div class="${cls}">${escapeHtml(msg)}</div>`;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;

      const lang = langSel.value || "id";
      currentText = text;
      const params = new URLSearchParams({ text, lang });
      currentAudioUrl = `${API_BASE}/api/tts?${params.toString()}`;

      submitBtn.disabled = true;
      submitBtn.textContent = "Membuat suara...";
      setFeedback("info", "Menghasilkan audio MP3...");
      resultEl.innerHTML = "";

      try {
        const res = await fetch(currentAudioUrl);
        if (!res.ok) {
          let msg = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            if (j.message) msg = j.message;
          } catch {}
          throw new Error(msg);
        }
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);

        setFeedback("", "");
        resultEl.innerHTML = `
          <article class="result-card">
            <audio controls autoplay src="${escapeHtml(objUrl)}" style="width:100%;"></audio>
            <div class="dl-list">
              <button type="button" class="btn btn-success" id="ttsDlBtn">Unduh MP3</button>
            </div>
          </article>
        `;
      } catch (err) {
        setFeedback("error", err.message || "Gagal membuat suara.");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "Buat Suara";
      }
    });

    resultEl.addEventListener("click", async (e) => {
      const dlBtn = e.target.closest("#ttsDlBtn");
      if (!dlBtn || !currentAudioUrl || dlBtn.disabled) return;

      const slug = currentText.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 30) || "tts";
      const filename = `tts_${slug}_${Date.now().toString().slice(-5)}.mp3`;
      const origText = dlBtn.textContent;
      dlBtn.disabled = true;
      dlBtn.textContent = "Menyiapkan...";

      try {
        const res = await downloadMediaFile({
          API_BASE,
          remoteUrl: currentAudioUrl,
          mediaType: "audio",
          filename,
          onProgress: (p) => {
            dlBtn.textContent = typeof p.percent === "number" ? `${p.percent}%` : "Mengunduh...";
            feedback.innerHTML = renderProgressHtml({ label: "Mengunduh MP3...", ...p });
          },
        });
        setFeedback("info", res.native ? `Tersimpan di ${res.path}!` : "Download MP3 dimulai!");
      } catch (err) {
        setFeedback("error", err.message || "Gagal mengunduh MP3.");
      } finally {
        dlBtn.disabled = false;
        dlBtn.textContent = origText;
      }
    });
  },
};
