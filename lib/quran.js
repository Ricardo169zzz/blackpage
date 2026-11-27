const QURAN_ENDPOINT = "https://api.nexadev.my.id/api/quran/";

async function fetchQuran({ surah, ayat } = {}) {
  const sNum = Number(surah);
  if (!Number.isInteger(sNum) || sNum < 1 || sNum > 114) {
    const err = new Error("Nomor surah harus antara 1 sampai 114");
    err.statusCode = 400;
    throw err;
  }

  const params = new URLSearchParams({ surah: String(sNum) });
  if (ayat !== undefined && ayat !== null && String(ayat).trim() !== "") {
    const aNum = Number(ayat);
    if (!Number.isInteger(aNum) || aNum < 1 || aNum > 300) {
      const err = new Error("Nomor ayat tidak valid");
      err.statusCode = 400;
      throw err;
    }
    params.set("ayat", String(aNum));
  }

  const res = await fetch(`${QURAN_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": "Blackpage/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Provider Quran HTTP ${res.status}`);
  const raw = await res.json();
  if (!raw || raw.success !== true || !Array.isArray(raw.data)) {
    throw new Error(raw?.message || "Gagal mengambil data Al-Qur'an");
  }

  return {
    status: "success",
    source: raw.source || "quran.nu.or.id",
    surah: raw.surah || { nomor: sNum, nama: `Surah ${sNum}` },
    count: raw.count || raw.data.length,
    data: raw.data,
  };
}

module.exports = { fetchQuran };
