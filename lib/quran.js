const QURAN_ENDPOINT = "https://api.nexadev.my.id/api/quran/";
const EQURAN_ENDPOINT = "https://equran.id/api/v2/surat/";

async function fetchFromEquran(sNum, aNum) {
  const res = await fetch(`${EQURAN_ENDPOINT}${sNum}`, {
    headers: { "User-Agent": "Blackpage/1.0", Accept: "application/json" },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`eQuran HTTP ${res.status}`);
  const raw = await res.json();
  const d = raw?.data;
  if (!d || !Array.isArray(d.ayat)) throw new Error("Data Al-Qur'an tidak valid");
  const filtered = aNum ? d.ayat.filter((x) => Number(x.nomorAyat) === aNum) : d.ayat;
  return {
    status: "success",
    source: "equran.id",
    surah: {
      nomor: d.nomor || sNum,
      nama: d.namaLatin || `Surah ${sNum}`,
      arti: d.arti || "",
      jumlahAyat: d.jumlahAyat || d.ayat.length,
    },
    count: filtered.length,
    data: filtered.map((x) => ({
      ayat: x.nomorAyat,
      arab: x.teksArab,
      latin: x.teksLatin,
      indonesia: x.teksIndonesia,
    })),
  };
}

async function fetchQuran({ surah, ayat } = {}) {
  const sNum = Number(surah);
  if (!Number.isInteger(sNum) || sNum < 1 || sNum > 114) {
    const err = new Error("Nomor surah harus antara 1 sampai 114");
    err.statusCode = 400;
    throw err;
  }

  let aNum = null;
  const params = new URLSearchParams({ surah: String(sNum) });
  if (ayat !== undefined && ayat !== null && String(ayat).trim() !== "") {
    aNum = Number(ayat);
    if (!Number.isInteger(aNum) || aNum < 1 || aNum > 300) {
      const err = new Error("Nomor ayat tidak valid");
      err.statusCode = 400;
      throw err;
    }
    params.set("ayat", String(aNum));
  }

  try {
    const res = await fetch(`${QURAN_ENDPOINT}?${params.toString()}`, {
      headers: { "User-Agent": "Blackpage/1.0", Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Provider Quran HTTP ${res.status}`);
    const raw = await res.json();
    if (!raw || raw.success !== true || !Array.isArray(raw.data) || !raw.data.length) {
      throw new Error(raw?.message || "Gagal mengambil data Al-Qur'an");
    }

    return {
      status: "success",
      source: raw.source || "quran.nu.or.id",
      surah: raw.surah || { nomor: sNum, nama: `Surah ${sNum}` },
      count: raw.count || raw.data.length,
      data: raw.data,
    };
  } catch {
    return fetchFromEquran(sNum, aNum);
  }
}

module.exports = { fetchQuran };
