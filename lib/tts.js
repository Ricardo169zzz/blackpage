const ALLOWED_LANGS = new Set(["id", "en", "ja", "ko", "ar", "es", "fr"]);

function splitTextChunks(text, maxLen = 180) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length <= maxLen) {
      current = (current + " " + word).trim();
    } else {
      if (current) chunks.push(current);
      current = word.length > maxLen ? word.slice(0, maxLen) : word;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

async function synthesizeSpeech(text, lang = "id") {
  const cleanText = String(text || "").trim().slice(0, 1000);
  if (!cleanText) {
    throw new Error("Teks tidak boleh kosong.");
  }
  const tl = ALLOWED_LANGS.has(lang) ? lang : "id";
  const parts = splitTextChunks(cleanText, 180);
  const buffers = [];

  for (const part of parts) {
    const url =
      `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob` +
      `&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(part)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(`Server TTS merespons HTTP ${res.status}`);
    }
    const ab = await res.arrayBuffer();
    buffers.push(Buffer.from(ab));
  }

  return Buffer.concat(buffers);
}

module.exports = { synthesizeSpeech, ALLOWED_LANGS };
