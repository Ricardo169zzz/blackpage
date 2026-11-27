const SURAHS = [
  [1,"Al-Fatihah","Pembuka",7],[2,"Al-Baqarah","Sapi Betina",286],[3,"Ali 'Imran","Keluarga Imran",200],[4,"An-Nisa'","Wanita",176],
  [5,"Al-Ma'idah","Hidangan",120],[6,"Al-An'am","Binatang Ternak",165],[7,"Al-A'raf","Tempat Tertinggi",206],[8,"Al-Anfal","Rampasan Perang",75],
  [9,"At-Taubah","Pengampunan",129],[10,"Yunus","Yunus",109],[11,"Hud","Hud",123],[12,"Yusuf","Yusuf",111],
  [13,"Ar-Ra'd","Guruh",43],[14,"Ibrahim","Ibrahim",52],[15,"Al-Hijr","Hijr",99],[16,"An-Nahl","Lebah",128],
  [17,"Al-Isra'","Memperjalankan Malam Hari",111],[18,"Al-Kahf","Gua",110],[19,"Maryam","Maryam",98],[20,"Taha","Taha",135],
  [21,"Al-Anbiya'","Nabi-Nabi",112],[22,"Al-Hajj","Haji",78],[23,"Al-Mu'minun","Orang-Orang Mukmin",118],[24,"An-Nur","Cahaya",64],
  [25,"Al-Furqan","Pembeda",77],[26,"Asy-Syu'ara'","Penyair",227],[27,"An-Naml","Semut",93],[28,"Al-Qasas","Kisah-Kisah",88],
  [29,"Al-'Ankabut","Laba-Laba",69],[30,"Ar-Rum","Romawi",60],[31,"Luqman","Luqman",34],[32,"As-Sajdah","Sajdah",30],
  [33,"Al-Ahzab","Golongan Bersekutu",73],[34,"Saba'","Saba'",54],[35,"Fatir","Pencipta",45],[36,"Yasin","Yasin",83],
  [37,"As-Saffat","Barisan-Barisan",182],[38,"Sad","Sad",88],[39,"Az-Zumar","Rombongan",75],[40,"Gafir","Yang Mengampuni",85],
  [41,"Fussilat","Yang Dijelaskan",54],[42,"Asy-Syura","Musyawarah",53],[43,"Az-Zukhruf","Perhiasan",89],[44,"Ad-Dukhan","Kabut",59],
  [45,"Al-Jasiyah","Berlutut",37],[46,"Al-Ahqaf","Bukit Pasir",35],[47,"Muhammad","Muhammad",38],[48,"Al-Fath","Kemenangan",29],
  [49,"Al-Hujurat","Kamar-Kamar",18],[50,"Qaf","Qaf",45],[51,"Az-Zariyat","Angin yang Menerbangkan",60],[52,"At-Tur","Bukit",49],
  [53,"An-Najm","Bintang",62],[54,"Al-Qamar","Bulan",55],[55,"Ar-Rahman","Yang Maha Pemurah",78],[56,"Al-Waqi'ah","Hari Kiamat",96],
  [57,"Al-Hadid","Besi",29],[58,"Al-Mujadalah","Gugatan",22],[59,"Al-Hasyr","Pengusiran",24],[60,"Al-Mumtahanah","Wanita yang Diuji",13],
  [61,"As-Saff","Barisan",14],[62,"Al-Jumu'ah","Jumat",11],[63,"Al-Munafiqun","Orang-Orang Munafik",11],[64,"At-Tagabun","Hari Dinampakkan Kesalahan",18],
  [65,"At-Talaq","Talak",12],[66,"At-Tahrim","Pengharaman",12],[67,"Al-Mulk","Kerajaan",30],[68,"Al-Qalam","Pena",52],
  [69,"Al-Haqqah","Hari Kiamat",52],[70,"Al-Ma'arij","Tempat Naik",44],[71,"Nuh","Nuh",28],[72,"Al-Jinn","Jin",28],
  [73,"Al-Muzzammil","Orang yang Berselimut",20],[74,"Al-Muddassir","Orang yang Berkemul",56],[75,"Al-Qiyamah","Hari Kiamat",40],[76,"Al-Insan","Manusia",31],
  [77,"Al-Mursalat","Malaikat yang Diutus",50],[78,"An-Naba'","Berita Besar",40],[79,"An-Nazi'at","Malaikat Pencabut",46],[80,"'Abasa","Ia Bermuka Masam",42],
  [81,"At-Takwir","Menggulung",29],[82,"Al-Infitar","Terbelah",19],[83,"Al-Mutaffifin","Orang-Orang Curang",36],[84,"Al-Insyiqaq","Terbelah",25],
  [85,"Al-Buruj","Gugusan Bintang",22],[86,"At-Tariq","Yang Datang Malam",17],[87,"Al-A'la","Yang Paling Tinggi",19],[88,"Al-Gasyiyah","Hari Pembalasan",26],
  [89,"Al-Fajr","Fajar",30],[90,"Al-Balad","Negeri",20],[91,"Asy-Syams","Matahari",15],[92,"Al-Lail","Malam",21],
  [93,"Ad-Duha","Waktu Duha",11],[94,"Asy-Syarh","Melapangkan",8],[95,"At-Tin","Buah Tin",8],[96,"Al-'Alaq","Segumpal Darah",19],
  [97,"Al-Qadr","Kemuliaan",5],[98,"Al-Bayyinah","Bukti Nyata",8],[99,"Az-Zalzalah","Kegoncangan",8],[100,"Al-'Adiyat","Kuda Perang",11],
  [101,"Al-Qari'ah","Hari Kiamat",11],[102,"At-Takasur","Bermegah-Megahan",8],[103,"Al-'Asr","Masa",3],[104,"Al-Humazah","Pengumpat",9],
  [105,"Al-Fil","Gajah",5],[106,"Quraisy","Suku Quraisy",4],[107,"Al-Ma'un","Barang Berguna",7],[108,"Al-Kausar","Nikmat Berlimpah",3],
  [109,"Al-Kafirun","Orang-Orang Kafir",6],[110,"An-Nasr","Pertolongan",3],[111,"Al-Lahab","Gejolak Api",5],[112,"Al-Ikhlas","Ikhlas",4],
  [113,"Al-Falaq","Waktu Subuh",5],[114,"An-Nas","Manusia",6]
];

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeQuery(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export const quranTool = {
  id: "islami-quran",
  name: "Al-Qur'an Digital",
  desc: "Cari surah atau baca ayat lengkap dengan arab, latin, dan terjemahan Indonesia.",
  render() {
    return `
      <div class="bp-quran-wrap">
        <div class="bp-quran-controls">
          <input id="quranSearchInput" class="brutal-input" type="search" placeholder="Cari nama surah / nomor (misal: Yasin, Al-Kahf, 112)..." />
          <input id="quranAyatInput" class="brutal-input bp-quran-ayat-in" type="number" min="1" max="286" placeholder="Ayat" />
        </div>
        <div id="quranStatus"></div>
        <div id="quranContent"></div>
      </div>
    `;
  },
  mount(root, { API_BASE }) {
    const searchInput = root.querySelector("#quranSearchInput");
    const ayatInput = root.querySelector("#quranAyatInput");
    const statusEl = root.querySelector("#quranStatus");
    const contentEl = root.querySelector("#quranContent");

    function renderSurahList(q = "") {
      const nq = normalizeQuery(q);
      const list = !nq
        ? SURAHS
        : SURAHS.filter(
            ([num, name, meaning]) =>
              String(num) === nq ||
              normalizeQuery(name).includes(nq) ||
              normalizeQuery(meaning).includes(nq)
          );

      statusEl.innerHTML = "";
      if (!list.length) {
        contentEl.innerHTML = `<div class="alert alert-info">Surah "${escapeHtml(q)}" tidak ditemukan.</div>`;
        return;
      }

      contentEl.innerHTML = `
        <div class="bp-quran-list">
          ${list
            .map(
              ([num, name, meaning, count]) => `
              <button type="button" class="bp-quran-surah-row" data-surah-num="${num}">
                <span class="bp-quran-num">${num}</span>
                <div class="bp-quran-surah-meta">
                  <strong>${escapeHtml(name)}</strong>
                  <span>${escapeHtml(meaning)} • ${count} Ayat</span>
                </div>
                <span class="tool-arrow" aria-hidden="true">→</span>
              </button>
            `
            )
            .join("")}
        </div>
      `;
    }

    async function loadSurah(num, ayatVal = "") {
      statusEl.innerHTML = "";
      contentEl.innerHTML = `
        <div class="bp-sp-skeleton" style="flex-direction:column;gap:10px;">
          <div class="bp-skel-box bp-skel-line"></div>
          <div class="bp-skel-box bp-skel-line short"></div>
          <div class="bp-skel-box bp-skel-line"></div>
        </div>
      `;

      try {
        const res = await fetch(`${API_BASE}/api/quran`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ surah: num, ayat: ayatVal || undefined }),
        });
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.data)) {
          throw new Error(data?.message || "Gagal memuat surah.");
        }

        const s = data.surah || {};
        contentEl.innerHTML = `
          <div class="bp-quran-reader-head">
            <button type="button" class="btn btn-sm" id="quranBackListBtn">← Daftar Surah</button>
            <div class="bp-quran-reader-title">
              <strong>${escapeHtml(s.nama || `Surah ${num}`)}</strong>
              <span>${escapeHtml(s.arti || "")} ${s.jumlahAyat ? `• ${s.jumlahAyat} Ayat` : ""}</span>
            </div>
          </div>
          <div class="bp-quran-ayat-list">
            ${data.data
              .map(
                (a) => `
                <article class="bp-quran-ayat-card">
                  <div class="bp-quran-ayat-top">
                    <span class="tag">AYAT ${a.ayat}</span>
                    <button type="button" class="btn btn-sm" data-copy-ayat="${a.ayat}">Salin</button>
                  </div>
                  <p class="bp-quran-arab" dir="rtl">${escapeHtml(a.arab)}</p>
                  ${a.latin ? `<p class="bp-quran-latin">${escapeHtml(a.latin)}</p>` : ""}
                  <p class="bp-quran-indo">${escapeHtml(a.indonesia)}</p>
                </article>
              `
              )
              .join("")}
          </div>
        `;

        contentEl.querySelector("#quranBackListBtn")?.addEventListener("click", () => {
          renderSurahList(searchInput.value);
        });

        contentEl.querySelectorAll("[data-copy-ayat]").forEach((btn) => {
          btn.addEventListener("click", async () => {
            const ayatObj = data.data.find((x) => String(x.ayat) === btn.dataset.copyAyat);
            if (!ayatObj) return;
            const txt = `${s.nama || `Surah ${num}`} (${num}:${ayatObj.ayat})\n${ayatObj.arab}\n${ayatObj.latin || ""}\n"${ayatObj.indonesia}"`;
            try {
              await navigator.clipboard.writeText(txt);
              btn.textContent = "Tersalin ✓";
              setTimeout(() => (btn.textContent = "Salin"), 1200);
            } catch {}
          });
        });
      } catch (err) {
        contentEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal memuat surah.")}</div>`;
      }
    }

    searchInput.addEventListener("input", () => {
      renderSurahList(searchInput.value);
    });

    contentEl.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-surah-num]");
      if (!btn) return;
      loadSurah(Number(btn.dataset.surahNum), ayatInput.value.trim());
    });

    renderSurahList("");
  },
};
