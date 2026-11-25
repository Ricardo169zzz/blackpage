import { makeProxyUrl } from "./download.js";

export function mountComicReader(stageEl, { API_BASE, escapeHtml, onBackHome }) {
  let lastSearchItems = [];
  let currentComic = null;
  let sortAsc = true;

  function renderSearchView(items = lastSearchItems, query = "") {
    const cardsHtml = items.length
      ? items
          .map(
            (item, i) => `
          <button type="button" class="comic-card" data-comic-idx="${i}">
            <div class="comic-cover-wrap">
              ${
                item.thumbnail
                  ? `<img class="comic-cover" src="${escapeHtml(makeProxyUrl(API_BASE, item.thumbnail))}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" /><span class="comic-cover-fallback" style="display:none;">KOMIK</span>`
                  : `<span class="comic-cover-fallback">KOMIK</span>`
              }
              <span class="tag comic-type-tag">${escapeHtml(item.type || "Manga")}</span>
            </div>
            <div class="comic-card-title">${escapeHtml(item.title)}</div>
          </button>
        `
          )
          .join("")
      : `<div class="alert alert-info">Ketik judul komik atau pilih rekomendasi di atas.</div>`;

    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackHome" style="margin-bottom:10px;">&larr; Halaman Utama</button>
      <div class="panel-card">
        <div class="stage-head">
          <div>
            <h2 class="stage-title">Baca Komik</h2>
            <p class="stage-desc">Manga, Manhwa &amp; Manhua Bahasa Indonesia.</p>
          </div>
          <span class="tag">KOMIKU</span>
        </div>

        <form id="comicSearchForm" class="input-row">
          <input
            id="comicSearchInput"
            class="brutal-input"
            type="search"
            placeholder="Cari judul komik (mis. Solo Leveling)..."
            value="${escapeHtml(query)}"
          />
          <button type="submit" id="comicSearchBtn" class="btn btn-primary" style="grid-column: 1 / -1;">Cari Komik</button>
        </form>

        <div class="cat-bar" id="comicQuickChips" style="margin-top:10px;">
          ${["Solo Leveling", "One Piece", "Naruto", "Jujutsu Kaisen"]
            .map((q) => `<button type="button" class="cat-pill" data-comic-q="${escapeHtml(q)}">${escapeHtml(q)}</button>`)
            .join("")}
        </div>

        <div id="comicFeedback"></div>
        <div class="comic-grid" id="comicGrid">${cardsHtml}</div>
      </div>
    `;

    stageEl.querySelector("#comicBackHome")?.addEventListener("click", onBackHome);
    const form = stageEl.querySelector("#comicSearchForm");
    const input = stageEl.querySelector("#comicSearchInput");
    const btn = stageEl.querySelector("#comicSearchBtn");
    const fb = stageEl.querySelector("#comicFeedback");
    const grid = stageEl.querySelector("#comicGrid");

    async function doSearch(q) {
      btn.disabled = true;
      btn.textContent = "Mencari...";
      fb.innerHTML = `<div class="alert alert-info">Memuat daftar komik...</div>`;
      try {
        const res = await fetch(`${API_BASE}/api/comic/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        lastSearchItems = data.items || [];
        fb.innerHTML = lastSearchItems.length ? "" : `<div class="alert alert-info">Komik tidak ditemukan.</div>`;
        grid.innerHTML = lastSearchItems
          .map(
            (item, i) => `
          <button type="button" class="comic-card" data-comic-idx="${i}">
            <div class="comic-cover-wrap">
              ${
                item.thumbnail
                  ? `<img class="comic-cover" src="${escapeHtml(makeProxyUrl(API_BASE, item.thumbnail))}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='grid';" /><span class="comic-cover-fallback" style="display:none;">KOMIK</span>`
                  : `<span class="comic-cover-fallback">KOMIK</span>`
              }
              <span class="tag comic-type-tag">${escapeHtml(item.type || "Manga")}</span>
            </div>
            <div class="comic-card-title">${escapeHtml(item.title)}</div>
          </button>
        `
          )
          .join("");
      } catch (err) {
        fb.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || "Gagal memuat komik.")}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = "Cari Komik";
      }
    }

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      doSearch(input.value.trim());
    });

    stageEl.querySelector("#comicQuickChips")?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-comic-q]");
      if (!chip) return;
      input.value = chip.dataset.comicQ;
      doSearch(chip.dataset.comicQ);
    });

    grid?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-comic-idx]");
      if (!card) return;
      const item = lastSearchItems[Number(card.dataset.comicIdx)];
      if (item) openComicDetail(item);
    });

    if (!lastSearchItems.length && !query) {
      doSearch("");
    }
  }

  async function openComicDetail(item) {
    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackSearch" style="margin-bottom:10px;">&larr; Daftar Komik</button>
      <div class="panel-card"><div class="alert alert-info">Memuat detail &amp; daftar chapter...</div></div>
    `;
    stageEl.querySelector("#comicBackSearch")?.addEventListener("click", () => renderSearchView());

    try {
      const res = await fetch(`${API_BASE}/api/comic/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      currentComic = { ...data, thumbnail: data.thumbnail || item.thumbnail };
      renderComicDetail();
    } catch (err) {
      stageEl.innerHTML = `
        <button type="button" class="btn btn-sm" id="comicBackSearch" style="margin-bottom:10px;">&larr; Daftar Komik</button>
        <div class="panel-card"><div class="alert alert-error">${escapeHtml(err.message || "Gagal membuka komik.")}</div></div>
      `;
      stageEl.querySelector("#comicBackSearch")?.addEventListener("click", () => renderSearchView());
    }
  }

  function renderComicDetail() {
    if (!currentComic) return renderSearchView();
    const list = sortAsc ? [...currentComic.chapters] : [...currentComic.chapters].reverse();

    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackSearch" style="margin-bottom:10px;">&larr; Daftar Komik</button>
      <div class="panel-card">
        <div class="comic-detail-head">
          ${
            currentComic.thumbnail
              ? `<img class="comic-detail-cover" src="${escapeHtml(makeProxyUrl(API_BASE, currentComic.thumbnail))}" alt="${escapeHtml(currentComic.title)}" />`
              : ""
          }
          <div class="comic-detail-meta">
            <h2 class="stage-title" style="font-size:1.05rem;">${escapeHtml(currentComic.title)}</h2>
            <span class="tag">${currentComic.chapters.length} CHAPTER</span>
            ${currentComic.synopsis ? `<p class="stage-desc" style="margin-top:8px;">${escapeHtml(currentComic.synopsis)}</p>` : ""}
          </div>
        </div>

        <div class="support-head" style="margin-top:12px;">
          <div class="field-label" style="margin:0;">DAFTAR CHAPTER</div>
          <button type="button" class="btn btn-sm" id="comicSortBtn">${sortAsc ? "Terlama ↑" : "Terbaru ↓"}</button>
        </div>

        <div class="comic-chapter-list" id="comicChapterList">
          ${
            list.length
              ? list
                  .map(
                    (ch) => `
                  <button type="button" class="comic-chapter-btn" data-ch-url="${escapeHtml(ch.url)}">
                    <span>${escapeHtml(ch.title)}</span>
                    <span class="tag">BACA</span>
                  </button>
                `
                  )
                  .join("")
              : `<div class="alert alert-info">Belum ada chapter tersedia.</div>`
          }
        </div>
      </div>
    `;

    stageEl.querySelector("#comicBackSearch")?.addEventListener("click", () => renderSearchView());
    stageEl.querySelector("#comicSortBtn")?.addEventListener("click", () => {
      sortAsc = !sortAsc;
      renderComicDetail();
    });
    stageEl.querySelector("#comicChapterList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ch-url]");
      if (!btn) return;
      const idx = currentComic.chapters.findIndex((c) => c.url === btn.dataset.chUrl);
      openChapter(idx >= 0 ? idx : 0);
    });
  }

  async function openChapter(chIdx) {
    const ch = currentComic?.chapters?.[chIdx];
    if (!ch) return;
    const workspace = stageEl.closest(".workspace");
    if (workspace) workspace.scrollTop = 0;

    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackDetail" style="margin-bottom:10px;">&larr; Daftar Chapter</button>
      <div class="panel-card"><div class="alert alert-info">Memuat halaman ${escapeHtml(ch.title)}...</div></div>
    `;
    stageEl.querySelector("#comicBackDetail")?.addEventListener("click", renderComicDetail);

    try {
      const res = await fetch(`${API_BASE}/api/comic/read`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ch.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);

      const hasPrev = chIdx > 0;
      const hasNext = chIdx < currentComic.chapters.length - 1;
      const navHtml = `
        <div class="comic-reader-nav">
          <button type="button" class="btn btn-sm" data-nav-ch="${chIdx - 1}" ${hasPrev ? "" : "disabled"}>&larr; Sebelumnya</button>
          <span class="tag">${data.pages.length} HAL</span>
          <button type="button" class="btn btn-sm btn-primary" data-nav-ch="${chIdx + 1}" ${hasNext ? "" : "disabled"}>Berikutnya &rarr;</button>
        </div>
      `;

      stageEl.innerHTML = `
        <button type="button" class="btn btn-sm" id="comicBackDetail" style="margin-bottom:10px;">&larr; Daftar Chapter</button>
        <div class="panel-card" style="padding:10px;">
          <h2 class="stage-title" style="font-size:0.95rem;margin-bottom:8px;">${escapeHtml(data.title || ch.title)}</h2>
          ${navHtml}
          <div class="comic-reader-pages">
            ${(data.pages || [])
              .map(
                (src, i) =>
                  `<img class="comic-page-img" src="${escapeHtml(makeProxyUrl(API_BASE, src))}" alt="Halaman ${i + 1}" loading="lazy" />`
              )
              .join("")}
          </div>
          ${navHtml}
        </div>
      `;

      stageEl.querySelector("#comicBackDetail")?.addEventListener("click", renderComicDetail);
      stageEl.querySelectorAll("[data-nav-ch]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const nextIdx = Number(btn.dataset.navCh);
          if (nextIdx >= 0 && nextIdx < currentComic.chapters.length) {
            openChapter(nextIdx);
          }
        });
      });
    } catch (err) {
      stageEl.innerHTML = `
        <button type="button" class="btn btn-sm" id="comicBackDetail" style="margin-bottom:10px;">&larr; Daftar Chapter</button>
        <div class="panel-card"><div class="alert alert-error">${escapeHtml(err.message || "Gagal memuat chapter.")}</div></div>
      `;
      stageEl.querySelector("#comicBackDetail")?.addEventListener("click", renderComicDetail);
    }
  }

  renderSearchView();
}
