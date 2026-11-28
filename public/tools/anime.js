import { downloadMediaFile, cacheOfflineThumb, resolveOfflineThumbSrc, renderProgressHtml } from "./download.js";

const ANIME_HISTORY_KEY = "tools_op_anime_history_v1";
const ANIME_DOWNLOADS_KEY = "tools_op_anime_downloads_v1";

function loadHistory() {
  try {
    const raw = localStorage.getItem(ANIME_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entry) {
  const list = loadHistory().filter((x) => x.url !== entry.url);
  list.unshift({ ...entry, watchedAt: Date.now() });
  try {
    localStorage.setItem(ANIME_HISTORY_KEY, JSON.stringify(list.slice(0, 24)));
  } catch {}
}

function loadAnimeDownloads() {
  try {
    const raw = localStorage.getItem(ANIME_DOWNLOADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAnimeDownload(entry) {
  const list = loadAnimeDownloads().filter((x) => x.episodeUrl !== entry.episodeUrl);
  list.unshift({ ...entry, downloadedAt: Date.now() });
  try {
    localStorage.setItem(ANIME_DOWNLOADS_KEY, JSON.stringify(list.slice(0, 60)));
  } catch {}
}

function removeAnimeDownload(episodeUrl) {
  const list = loadAnimeDownloads().filter((x) => x.episodeUrl !== episodeUrl);
  try {
    localStorage.setItem(ANIME_DOWNLOADS_KEY, JSON.stringify(list));
  } catch {}
}

export function mountAnimeApp(stageEl, { API_BASE, escapeHtml, upgradeVideoPlayer, onRouteChange, onExit }) {
  let view = "ongoing"; // "ongoing" | "search" | "history" | "detail" | "watch"
  let ongoingPage = 1;
  let lastQuery = "";
  let currentAnime = null;
  let epPage = 1;

  stageEl.classList.add("bp-anime-stage");

  const setView = (nextView) => {
    view = nextView;
    onRouteChange?.(view);
  };

  function hydratePosters(container) {
    if (!container) return;
    const imgs = [...container.querySelectorAll("img.bp-anime-poster[data-src]")];
    let idx = 0;
    const pump = () => {
      if (idx >= imgs.length || !container.isConnected) return;
      const img = imgs[idx++];
      const src = img.dataset.src;
      img.removeAttribute("data-src");
      if (!src) return pump();
      const onLoad = () => {
        img.classList.add("is-loaded");
        pump();
      };
      img.addEventListener("load", onLoad, { once: true });
      img.addEventListener("error", pump, { once: true });
      img.src = src;
      if (img.complete && img.naturalWidth > 0) {
        img.classList.add("is-loaded");
      }
    };
    pump();
    pump();
  }

  function renderCardsHtml(items, emptyText) {
    if (!items.length) {
      return `<div class="alert alert-info">${escapeHtml(emptyText)}</div>`;
    }
    return `
      <div class="bp-anime-grid">
        ${items
          .map(
            (it, idx) => `
            <button type="button" class="bp-anime-card" style="--i:${Math.min(idx, 12)}" data-anime-url="${escapeHtml(it.url)}" data-anime-title="${escapeHtml(it.title)}" data-anime-thumb="${escapeHtml(it.thumbnail || "")}">
              <div class="bp-anime-poster-wrap">
                ${it.thumbnail
                  ? `<img class="bp-anime-poster" data-src="${escapeHtml(`${API_BASE}/api/media?${new URLSearchParams({ url: it.thumbnail }).toString()}`)}" alt="${escapeHtml(it.title)}" decoding="async" />`
                  : `<span class="bp-anime-poster-fallback">ANIME</span>`}
                ${it.episode ? `<span class="bp-anime-ep-badge">${escapeHtml(it.episode)}</span>` : ""}
              </div>
              <div class="bp-anime-card-body">
                <strong class="bp-anime-title">${escapeHtml(it.title)}</strong>
                ${it.day ? `<span class="bp-anime-sub">${escapeHtml(it.day)}</span>` : ""}
              </div>
            </button>
          `
          )
          .join("")}
      </div>
    `;
  }

  async function showOngoing(page = 1) {
    setView("ongoing");
    ongoingPage = Math.max(1, page);
    stageEl.innerHTML = `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">ANIME ONGOING</h2>
          <p class="stage-desc">Streaming anime sub Indo terbaru.</p>
        </div>
        <span class="tag">HAL ${ongoingPage}</span>
      </div>
      <div id="animeGridHost">
        <div class="bp-sp-skeleton" style="flex-direction:column;gap:10px;">
          <div class="bp-skel-box bp-skel-line"></div>
          <div class="bp-skel-box bp-skel-line short"></div>
          <div class="bp-skel-box bp-skel-line"></div>
        </div>
      </div>
    `;

    const host = stageEl.querySelector("#animeGridHost");
    try {
      const res = await fetch(`${API_BASE}/api/anime/ongoing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: ongoingPage }),
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.items)) {
        throw new Error(data?.message || "Gagal memuat anime ongoing.");
      }
      host.innerHTML = `
        ${renderCardsHtml(data.items, "Belum ada anime ongoing.")}
        <div class="bp-quran-pager">
          <button type="button" class="btn btn-sm bp-quran-page-btn" id="animePrevPageBtn" ${ongoingPage <= 1 ? "disabled" : ""}>&lt;</button>
          <span class="tag">${ongoingPage}</span>
          <button type="button" class="btn btn-sm bp-quran-page-btn" id="animeNextPageBtn" ${data.items.length < 10 ? "disabled" : ""}>&gt;</button>
        </div>
      `;
      hydratePosters(host);
      host.querySelector("#animePrevPageBtn")?.addEventListener("click", () => showOngoing(ongoingPage - 1));
      host.querySelector("#animeNextPageBtn")?.addEventListener("click", () => showOngoing(ongoingPage + 1));
    } catch (err) {
      host.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal terhubung ke server anime.")}</div>`;
    }
  }

  const ANIME_CATEGORIES = [
    { id: "populer", label: "Populer" },
    { id: "top", label: "Terbaik Sepanjang Masa" },
    { id: "action", label: "Action" },
    { id: "fantasy", label: "Fantasy" },
    { id: "romance", label: "Romance" },
  ];

  async function showCategoryFull(catId, page = 1) {
    setView("search");
    const cat = ANIME_CATEGORIES.find((c) => c.id === catId) || ANIME_CATEGORIES[0];
    stageEl.innerHTML = `
      <div class="tool-topbar">
        <button type="button" class="btn btn-sm" id="animeCatBackBtn">← Kembali ke Cari</button>
        <span class="tag">${escapeHtml(cat.label.toUpperCase())}</span>
      </div>
      <div class="stage-head">
        <div>
          <h2 class="stage-title">${escapeHtml(cat.label)}</h2>
          <p class="stage-desc">Halaman ${page}</p>
        </div>
      </div>
      <div id="animeCatFullHost">
        <div class="bp-sp-skeleton" style="flex-direction:column;gap:10px;"><div class="bp-skel-box bp-skel-line"></div><div class="bp-skel-box bp-skel-line short"></div></div>
      </div>
    `;
    stageEl.querySelector("#animeCatBackBtn")?.addEventListener("click", () => showSearch(""));

    const host = stageEl.querySelector("#animeCatFullHost");
    try {
      const res = await fetch(`${API_BASE}/api/anime/category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat.id, page }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat kategori.");
      host.innerHTML = `
        ${renderCardsHtml(data.items || [], "Tidak ada anime di kategori ini.")}
        <div class="bp-quran-pager">
          <button type="button" class="btn btn-sm bp-quran-page-btn" id="catPrevBtn" ${page <= 1 ? "disabled" : ""}>&lt;</button>
          <span class="tag">${page}</span>
          <button type="button" class="btn btn-sm bp-quran-page-btn" id="catNextBtn" ${(data.items || []).length < 10 ? "disabled" : ""}>&gt;</button>
        </div>
      `;
      hydratePosters(host);
      host.querySelector("#catPrevBtn")?.addEventListener("click", () => showCategoryFull(cat.id, page - 1));
      host.querySelector("#catNextBtn")?.addEventListener("click", () => showCategoryFull(cat.id, page + 1));
    } catch (err) {
      host.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal memuat kategori.")}</div>`;
    }
  }

  function showSearch(prefill = lastQuery) {
    setView("search");
    stageEl.innerHTML = `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">CARI ANIME</h2>
          <p class="stage-desc">Cari judul atau jelajahi kategori anime.</p>
        </div>
      </div>
      <form class="bp-sp-search-row" id="animeSearchForm" style="margin-bottom:12px;">
        <input type="search" class="brutal-input" id="animeSearchInput" value="${escapeHtml(prefill)}" placeholder="Ketik judul anime (misal: Frieren, One Piece)..." />
        <button type="submit" class="btn btn-primary">CARI</button>
      </form>
      <div id="animeSearchResults"></div>
      <div id="animeCatsHost">
        ${ANIME_CATEGORIES.map(
          (cat, catIdx) => `
          <div class="bp-anime-cat-sec" style="--cat-i:${catIdx}" data-cat-sec="${cat.id}">
            <div class="bp-anime-cat-head">
              <strong>${escapeHtml(cat.label)}</strong>
              <button type="button" class="btn btn-sm bp-anime-cat-more" data-cat-more="${cat.id}" aria-label="Lihat semua ${escapeHtml(cat.label)}">&gt;</button>
            </div>
            <div class="bp-anime-hscroll" data-cat-row="${cat.id}">
              <div class="bp-sp-skeleton" style="width:100%;height:110px;"></div>
            </div>
          </div>
        `
        ).join("")}
      </div>
    `;

    const form = stageEl.querySelector("#animeSearchForm");
    const input = stageEl.querySelector("#animeSearchInput");
    const resEl = stageEl.querySelector("#animeSearchResults");
    const catsHost = stageEl.querySelector("#animeCatsHost");

    const loadCategories = async () => {
      for (const cat of ANIME_CATEGORIES) {
        const rowEl = stageEl.querySelector(`[data-cat-row="${cat.id}"]`);
        if (!rowEl || !rowEl.isConnected) return;
        try {
          const res = await fetch(`${API_BASE}/api/anime/category`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category: cat.id, page: 1 }),
          });
          const data = await res.json();
          const list = (data.items || []).slice(0, 10);
          if (!rowEl.isConnected) return;
          rowEl.innerHTML = list
            .map(
              (it, idx) => `
              <button type="button" class="bp-anime-card bp-anime-hcard" style="--i:${Math.min(idx, 8)}" data-anime-url="${escapeHtml(it.url)}" data-anime-title="${escapeHtml(it.title)}" data-anime-thumb="${escapeHtml(it.thumbnail || "")}">
                <div class="bp-anime-poster-wrap">
                  ${it.thumbnail
                    ? `<img class="bp-anime-poster" data-src="${escapeHtml(`${API_BASE}/api/media?${new URLSearchParams({ url: it.thumbnail }).toString()}`)}" alt="${escapeHtml(it.title)}" decoding="async" />`
                    : `<span class="bp-anime-poster-fallback">ANIME</span>`}
                  ${it.episode ? `<span class="bp-anime-ep-badge">${escapeHtml(it.episode)}</span>` : ""}
                </div>
                <div class="bp-anime-card-body">
                  <strong class="bp-anime-title">${escapeHtml(it.title)}</strong>
                  ${it.day ? `<span class="bp-anime-sub">${escapeHtml(it.day)}</span>` : ""}
                </div>
              </button>
            `
            )
            .join("");
          hydratePosters(rowEl);
        } catch {
          if (rowEl.isConnected) {
            rowEl.innerHTML = `<div class="alert alert-error" style="width:100%;">Gagal memuat ${escapeHtml(cat.label)}.</div>`;
          }
        }
      }
    };

    catsHost?.addEventListener("click", (e) => {
      const more = e.target.closest("[data-cat-more]");
      if (more) showCategoryFull(more.dataset.catMore, 1);
    });

    const run = async (q) => {
      const clean = String(q || "").trim();
      if (!clean) {
        if (catsHost) catsHost.hidden = false;
        resEl.innerHTML = "";
        return;
      }
      if (catsHost) catsHost.hidden = true;
      lastQuery = clean;
      resEl.innerHTML = `<div class="bp-sp-skeleton" style="flex-direction:column;gap:10px;"><div class="bp-skel-box bp-skel-line"></div><div class="bp-skel-box bp-skel-line short"></div></div>`;
      try {
        const res = await fetch(`${API_BASE}/api/anime/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: clean }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || "Gagal mencari anime.");
        resEl.innerHTML = renderCardsHtml(data.items || [], `Anime "${clean}" tidak ditemukan.`);
        hydratePosters(resEl);
      } catch (err) {
        resEl.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal mencari anime.")}</div>`;
      }
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      run(input.value);
    });
    input?.addEventListener("input", () => {
      if (!input.value.trim()) {
        if (catsHost) catsHost.hidden = false;
        resEl.innerHTML = "";
      }
    });
    if (prefill) run(prefill);
    else loadCategories();
  }

  function showHistory() {
    setView("history");
    const list = loadHistory();
    stageEl.innerHTML = `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">RIWAYAT ANIME</h2>
          <p class="stage-desc">Anime yang baru saja kamu tonton.</p>
        </div>
        ${list.length ? `<button type="button" class="btn btn-sm" id="animeClearHistBtn">Bersihkan</button>` : ""}
      </div>
      ${renderCardsHtml(list, "Belum ada riwayat tontonan anime.")}
    `;
    hydratePosters(stageEl);
    stageEl.querySelector("#animeClearHistBtn")?.addEventListener("click", () => {
      localStorage.removeItem(ANIME_HISTORY_KEY);
      showHistory();
    });
  }

  async function showDetail(url, fallbackMeta = {}) {
    setView("detail");
    epPage = 1;
    stageEl.innerHTML = `
      <div class="tool-topbar">
        <button type="button" class="btn btn-sm" id="animeBackListBtn">← Kembali</button>
        <span class="tag">DETAIL ANIME</span>
      </div>
      <div id="animeDetailBody">
        <div class="bp-sp-skeleton" style="flex-direction:column;gap:10px;">
          <div class="bp-skel-box bp-skel-line"></div>
          <div class="bp-skel-box bp-skel-line short"></div>
          <div class="bp-skel-box bp-skel-line"></div>
        </div>
      </div>
    `;
    stageEl.querySelector("#animeBackListBtn")?.addEventListener("click", () => showOngoing(ongoingPage));

    const body = stageEl.querySelector("#animeDetailBody");
    try {
      const res = await fetch(`${API_BASE}/api/anime/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat detail anime.");
      currentAnime = data;
      saveHistory({
        url,
        title: data.title || fallbackMeta.title || "Anime",
        thumbnail: data.thumbnail || fallbackMeta.thumbnail || "",
        episode: `${(data.episodes || []).length} Eps`,
      });

      const renderDetailEpisodes = () => {
        const eps = data.episodes || [];
        const perPage = 20;
        const totalPages = Math.max(1, Math.ceil(eps.length / perPage));
        const slice = eps.slice((epPage - 1) * perPage, epPage * perPage);
        const thumbSrc = data.thumbnail
          ? `${API_BASE}/api/media?${new URLSearchParams({ url: data.thumbnail }).toString()}`
          : "";

        body.innerHTML = `
          <div class="bp-anime-detail-head">
            ${thumbSrc ? `<img class="bp-anime-detail-poster" src="${escapeHtml(thumbSrc)}" alt="${escapeHtml(data.title)}" />` : ""}
            <div class="bp-anime-detail-meta">
              <h3 style="margin:0 0 6px;font-size:0.98rem;">${escapeHtml(data.title)}</h3>
              ${(data.info || []).slice(0, 4).map((line) => `<div class="bp-anime-info-line">${escapeHtml(line)}</div>`).join("")}
            </div>
          </div>
          ${data.synopsis ? `<p class="bp-anime-synopsis">${escapeHtml(data.synopsis)}</p>` : ""}
          <div class="bp-sp-queue-head" style="margin-top:12px;">DAFTAR EPISODE (${eps.length})</div>
          <div class="bp-anime-ep-list">
            ${slice
              .map(
                (ep, idx) => `
                <button type="button" class="bp-quran-surah-row" style="--ep-i:${Math.min(idx, 14)}" data-watch-ep="${escapeHtml(ep.url)}">
                  <div class="bp-quran-surah-meta"><strong>${escapeHtml(ep.title)}</strong></div>
                  <span class="tag">TONTON</span>
                </button>
              `
              )
              .join("")}
          </div>
          ${totalPages > 1
            ? `<div class="bp-quran-pager">
                <button type="button" class="btn btn-sm bp-quran-page-btn" id="epPrevBtn" ${epPage <= 1 ? "disabled" : ""}>&lt;</button>
                <span class="tag">${epPage} / ${totalPages}</span>
                <button type="button" class="btn btn-sm bp-quran-page-btn" id="epNextBtn" ${epPage >= totalPages ? "disabled" : ""}>&gt;</button>
              </div>`
            : ""}
        `;

        body.querySelector("#epPrevBtn")?.addEventListener("click", () => {
          epPage--;
          renderDetailEpisodes();
        });
        body.querySelector("#epNextBtn")?.addEventListener("click", () => {
          epPage++;
          renderDetailEpisodes();
        });
      };

      renderDetailEpisodes();
    } catch (err) {
      body.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal memuat detail anime.")}</div>`;
    }
  }

  async function showWatch(epUrl) {
    setView("watch");
    stageEl.innerHTML = `
      <div class="tool-topbar">
        <button type="button" class="btn btn-sm" id="animeBackDetailBtn">← Daftar Episode</button>
        <span class="tag">STREAMING</span>
      </div>
      <div id="animeWatchBody">
        <div class="bp-sp-skeleton" style="flex-direction:column;gap:10px;">
          <div class="bp-skel-box bp-skel-line"></div>
          <div class="bp-skel-box bp-skel-line short"></div>
        </div>
      </div>
    `;
    stageEl.querySelector("#animeBackDetailBtn")?.addEventListener("click", () => {
      if (currentAnime?.url) showDetail(currentAnime.url);
      else showOngoing(ongoingPage);
    });

    const body = stageEl.querySelector("#animeWatchBody");
    try {
      const res = await fetch(`${API_BASE}/api/anime/episode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: epUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Gagal memuat stream episode.");

      const proxyVideo = data.streamUrl
        ? `${API_BASE}/api/media?${new URLSearchParams({ url: data.streamUrl }).toString()}`
        : "";

      const playerHtml = proxyVideo
        ? `<video class="video-preview" id="animeStreamVideo" src="${escapeHtml(proxyVideo)}" autoplay playsinline preload="auto"></video>`
        : data.embedUrl
          ? `<div class="bp-anime-iframe-wrap"><iframe src="${escapeHtml(data.embedUrl)}" allowfullscreen frameborder="0" referrerpolicy="no-referrer"></iframe></div>`
          : `<div class="alert alert-error">Stream tidak tersedia untuk episode ini.</div>`;

      const isDownloaded = loadAnimeDownloads().some((d) => d.episodeUrl === epUrl);

      body.innerHTML = `
        <h3 style="margin:0 0 10px;font-size:0.92rem;">${escapeHtml(data.title || "Streaming Anime")}</h3>
        ${playerHtml}
        <div class="bp-anime-ep-nav">
          <button type="button" class="btn btn-sm" id="watchPrevEpBtn" ${data.prevUrl ? "" : "disabled"}>← Episode Sebelumnya</button>
          <button type="button" class="btn btn-sm btn-primary" id="watchNextEpBtn" ${data.nextUrl ? "" : "disabled"}>Episode Berikutnya →</button>
        </div>
        ${data.streamUrl
          ? `<div style="margin-top:8px;">
               <button type="button" class="btn btn-sm btn-primary" id="animeDownloadEpBtn" style="width:100%;">
                 ${isDownloaded ? "✓ TERSIMPAN DI DOWNLOAD ANIME" : "↓ DOWNLOAD EPISODE"}
               </button>
               <div id="animeDownloadProg" style="margin-top:6px;"></div>
             </div>`
          : ""}
        ${(data.downloads || []).length
          ? `<div class="bp-sp-queue-head" style="margin-top:12px;">LINK UNDUH EKSTERNAL</div>
             <div class="dl-list">${data.downloads.map((d) => `<a class="btn btn-sm" href="${escapeHtml(d.url)}" target="_blank" rel="noopener">${escapeHtml(d.quality)} (${escapeHtml(d.host)})</a>`).join("")}</div>`
          : ""}
      `;

      const vid = body.querySelector("#animeStreamVideo");
      if (vid) {
        upgradeVideoPlayer?.(vid);
        vid.play?.().catch(() => {});
      }

      body.querySelector("#watchPrevEpBtn")?.addEventListener("click", () => data.prevUrl && showWatch(data.prevUrl));
      body.querySelector("#watchNextEpBtn")?.addEventListener("click", () => data.nextUrl && showWatch(data.nextUrl));

      const dlBtn = body.querySelector("#animeDownloadEpBtn");
      const dlProg = body.querySelector("#animeDownloadProg");
      dlBtn?.addEventListener("click", async () => {
        if (!data.streamUrl) return;
        dlBtn.disabled = true;
        dlBtn.textContent = "MENGUNDUH...";
        const safeName = `${(data.title || "anime-episode").replace(/[^a-z0-9_-]+/gi, "-").slice(0, 64)}.mp4`;
        const thumbFilename = currentAnime?.thumbnail ? `anime-${Date.now()}.jpg` : "";
        try {
          const result = await downloadMediaFile({
            API_BASE,
            remoteUrl: data.streamUrl,
            mediaType: "video",
            filename: safeName,
            onProgress: (p) => {
              if (dlProg) dlProg.innerHTML = renderProgressHtml({ label: "Mengunduh Episode...", ...p });
            },
          });
          if (currentAnime?.thumbnail && thumbFilename) {
            cacheOfflineThumb(API_BASE, currentAnime.thumbnail, thumbFilename).catch(() => {});
          }
          saveAnimeDownload({
            episodeUrl: epUrl,
            animeUrl: currentAnime?.url || "",
            animeTitle: currentAnime?.title || data.title || "Anime",
            episodeTitle: data.title || "Episode",
            thumbnail: currentAnime?.thumbnail || "",
            thumbFilename,
            filename: safeName,
            streamUrl: data.streamUrl,
            nativePath: result?.nativePath || "",
            nativeUri: result?.nativeUri || "",
          });
          dlBtn.textContent = "✓ TERSIMPAN DI DOWNLOAD ANIME";
          if (dlProg) dlProg.innerHTML = `<div class="alert alert-info">Episode disimpan di tab Download Anime (terpisah dari Galeri).</div>`;
        } catch (dlErr) {
          dlBtn.disabled = false;
          dlBtn.textContent = "↓ DOWNLOAD EPISODE";
          if (dlProg) dlProg.innerHTML = `<div class="alert alert-error">${escapeHtml(dlErr?.message || "Gagal mengunduh episode.")}</div>`;
        }
      });
    } catch (err) {
      body.innerHTML = `<div class="alert alert-error">${escapeHtml(err?.message || "Gagal memuat episode.")}</div>`;
    }
  }

  stageEl.addEventListener("click", (e) => {
    const card = e.target.closest("[data-anime-url]");
    if (card) {
      showDetail(card.dataset.animeUrl, {
        title: card.dataset.animeTitle,
        thumbnail: card.dataset.animeThumb,
      });
      return;
    }
    const epBtn = e.target.closest("[data-watch-ep]");
    if (epBtn) {
      showWatch(epBtn.dataset.watchEp);
    }
  });

  showOngoing(1);

  async function showDownloads() {
    setView("downloads");
    const list = loadAnimeDownloads();
    stageEl.innerHTML = `
      <div class="stage-head">
        <div>
          <h2 class="stage-title">DOWNLOAD ANIME</h2>
          <p class="stage-desc">Anime yang sudah diunduh, terpisah dari Galeri utama.</p>
        </div>
        ${list.length ? `<button type="button" class="btn btn-sm" id="animeClearDlBtn">Bersihkan</button>` : ""}
      </div>
      <div id="animeDlHost">
        ${!list.length
          ? `<div class="alert alert-info">Belum ada anime yang diunduh. Buka episode lalu tekan "Download Episode".</div>`
          : `<div class="bp-anime-ep-list">
              ${list
                .map(
                  (d, idx) => `
                  <div class="bp-anime-dl-row" style="--ep-i:${Math.min(idx, 12)}" data-dl-ep="${escapeHtml(d.episodeUrl)}">
                    <img class="bp-anime-dl-thumb" data-dl-thumb="${escapeHtml(d.episodeUrl)}" alt="${escapeHtml(d.animeTitle || d.episodeTitle)}" />
                    <div class="bp-anime-dl-meta">
                      <strong>${escapeHtml(d.episodeTitle || d.animeTitle)}</strong>
                      <small>${escapeHtml(d.animeTitle || "")}</small>
                    </div>
                    <div class="bp-anime-dl-actions">
                      <button type="button" class="btn btn-sm btn-primary" data-play-dl="${escapeHtml(d.episodeUrl)}">TONTON</button>
                      <button type="button" class="btn btn-sm" data-del-dl="${escapeHtml(d.episodeUrl)}">HAPUS</button>
                    </div>
                  </div>
                `
                )
                .join("")}
            </div>`}
      </div>
      <div id="animeDlPlayerHost" style="margin-top:12px;"></div>
    `;

    // Resolve thumbnails offline-first, fallback to proxy
    for (const d of list) {
      const img = stageEl.querySelector(`[data-dl-thumb="${CSS.escape(d.episodeUrl)}"]`);
      if (!img) continue;
      resolveOfflineThumbSrc(API_BASE, d).then((src) => {
        if (!img.isConnected) return;
        const finalSrc = src || (d.thumbnail ? `${API_BASE}/api/media?${new URLSearchParams({ url: d.thumbnail }).toString()}` : "");
        if (finalSrc) img.src = finalSrc;
      });
    }

    stageEl.querySelector("#animeClearDlBtn")?.addEventListener("click", () => {
      localStorage.removeItem(ANIME_DOWNLOADS_KEY);
      showDownloads();
    });

    stageEl.querySelectorAll("[data-del-dl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        removeAnimeDownload(btn.dataset.delDl);
        showDownloads();
      });
    });

    stageEl.querySelectorAll("[data-play-dl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const entry = loadAnimeDownloads().find((x) => x.episodeUrl === btn.dataset.playDl);
        const playerHost = stageEl.querySelector("#animeDlPlayerHost");
        if (!entry || !playerHost) return;
        const cap = window.Capacitor;
        const offlineSrc = entry.nativeUri && typeof cap?.convertFileSrc === "function"
          ? cap.convertFileSrc(entry.nativeUri)
          : entry.nativeUri || "";
        const src = offlineSrc || (entry.streamUrl ? `${API_BASE}/api/media?${new URLSearchParams({ url: entry.streamUrl }).toString()}` : "");
        if (!src) {
          playerHost.innerHTML = `<div class="alert alert-error">Sumber video tidak tersedia.</div>`;
          return;
        }
        playerHost.innerHTML = `
          <div class="bp-sp-queue-head">MEMUTAR: ${escapeHtml(entry.episodeTitle)}</div>
          <video class="video-preview" id="animeOfflineVideo" src="${escapeHtml(src)}" autoplay playsinline preload="auto"></video>
        `;
        const vid = playerHost.querySelector("#animeOfflineVideo");
        if (vid) {
          upgradeVideoPlayer?.(vid);
          vid.play?.().catch(() => {});
          playerHost.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      });
    });
  }

  return {
    getView: () => view,
    switchNav(tab) {
      if (tab === "ongoing") showOngoing(1);
      else if (tab === "search") showSearch("");
      else if (tab === "downloads") showDownloads();
      else if (tab === "history") showHistory();
      else if (tab === "exit") onExit?.();
    },
    handleBack() {
      if (view === "watch" && currentAnime?.url) {
        showDetail(currentAnime.url);
        return true;
      }
      if (view === "detail" || view === "search" || view === "category" || view === "downloads" || view === "history") {
        showOngoing(ongoingPage);
        return true;
      }
      return false;
    },
  };
}
