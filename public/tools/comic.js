import { makeProxyUrl } from "./download.js";

const COMIC_SERVERS = [
  { id: "auto", label: "Auto (Semua Server)", tag: "ALL" },
  { id: "komikindo", label: "Komikindo", tag: "ID" },
  { id: "bacakomik", label: "Bacakomik", tag: "ID" },
  { id: "kiryuu", label: "Kiryuu", tag: "ID" },
  { id: "komiku", label: "Komiku", tag: "ID" },
  { id: "manhwaindo", label: "Manhwaindo", tag: "ID" },
  { id: "komikcast", label: "Komikcast", tag: "ID" },
  { id: "mangadex", label: "MangaDex (ID / EN)", tag: "ID/EN" },
];

const CHAPTERS_PER_PAGE = 20;
const AUTOSCROLL_KEY = "blackpage_comic_autoscroll_v1";
const AUTOSCROLL_TIP_HIDE_KEY = "blackpage_comic_as_tip_hide_v1";
const SPEED_PRESETS = [
  { id: "pelan", label: "Pelan", enLabel: "Slow", pxPerSec: 32 },
  { id: "sedang", label: "Sedang", enLabel: "Medium", pxPerSec: 65 },
  { id: "cepat", label: "Cepat", enLabel: "Fast", pxPerSec: 115 },
  { id: "kilat", label: "Kilat", enLabel: "Turbo", pxPerSec: 185 },
];

function loadAutoScrollPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(AUTOSCROLL_KEY) || "{}");
    const speedIdx = Math.max(0, Math.min(SPEED_PRESETS.length - 1, Number(raw.speedIdx ?? 1)));
    return { enabled: Boolean(raw.enabled), speedIdx };
  } catch {
    return { enabled: false, speedIdx: 1 };
  }
}

function saveAutoScrollPrefs(prefs) {
  localStorage.setItem(AUTOSCROLL_KEY, JSON.stringify(prefs));
}

function showAutoScrollTipModal() {
  if (localStorage.getItem(AUTOSCROLL_TIP_HIDE_KEY) === "1") return;
  if (document.querySelector("#comicAsTipModal")) return;
  const host = document.querySelector(".app-shell") || document.body;
  const modal = document.createElement("div");
  modal.id = "comicAsTipModal";
  modal.className = "comic-modal-backdrop";
  modal.innerHTML = `
    <div class="comic-modal-card" role="dialog" aria-modal="true" aria-labelledby="comicAsTipTitle">
      <div class="stage-head" style="margin-bottom:6px;">
        <h3 id="comicAsTipTitle" style="margin:0;font-size:0.95rem;">TIPS AUTO SCROLL</h3>
        <span class="tag">INFO</span>
      </div>
      <p class="stage-desc" style="margin:0 0 12px;line-height:1.45;">
        Saat Auto Scroll aktif, halaman otomatis bergeser ke bawah. Jika ingin scroll manual ke bawah,
        <strong>geser sedikit ke atas terlebih dahulu lalu tarik ke bawah</strong> (atau tekan jeda <code>❚❚</code> di pojok kiri bawah).
      </p>
      <label class="comic-modal-check">
        <input type="checkbox" id="comicAsTipHideCheck" />
        <span class="comic-check-box" aria-hidden="true"></span>
        <span>Jangan ingatkan lagi, saya sudah paham</span>
      </label>
      <button type="button" class="btn btn-primary" id="comicAsTipOk" style="width:100%;margin-top:12px;">Mengerti</button>
    </div>
  `;
  const close = () => {
    const chk = modal.querySelector("#comicAsTipHideCheck");
    if (chk?.checked) {
      localStorage.setItem(AUTOSCROLL_TIP_HIDE_KEY, "1");
    }
    modal.remove();
  };
  modal.querySelector("#comicAsTipOk")?.addEventListener("click", close);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  host.appendChild(modal);
}

export function mountComicReader(stageEl, { API_BASE, escapeHtml, onBackHome }) {
  const isEn = localStorage.getItem("tools_op_lang_v1") === "en";
  const savedServer = localStorage.getItem("blackpage_comic_server_v1");
  const comicLang = localStorage.getItem("blackpage_comic_lang_v1") === "en" ? "en" : "id";
  let lastSearchItems = [];
  let lastHasNext = false;
  let currentComic = null;
  let activeServer = COMIC_SERVERS.some((s) => s.id === savedServer) ? savedServer : "auto";
  let activeSource = activeServer === "mangadex" ? "MANGADEX · ID/EN" : activeServer.toUpperCase();
  let currentQuery = "";
  let currentPage = 1;
  let sortAsc = false;
  let chapterQuery = "";
  let chapterPage = 1;

  let asPrefs = loadAutoScrollPrefs();
  let readerCleanup = null;
  let topFloatCleanup = null;

  function cleanupReaderWidgets() {
    if (typeof readerCleanup === "function") {
      readerCleanup();
      readerCleanup = null;
    }
    if (typeof topFloatCleanup === "function") {
      topFloatCleanup();
      topFloatCleanup = null;
    }
  }

  function attachTopFloatBack(anchorBtn, labelHtml, onClick) {
    if (typeof topFloatCleanup === "function") {
      topFloatCleanup();
      topFloatCleanup = null;
    }
    const workspace = stageEl.closest(".workspace");
    if (!anchorBtn || !workspace) return;
    const appShell = document.querySelector(".app-shell") || document.body;
    const floatBtn = document.createElement("button");
    floatBtn.type = "button";
    floatBtn.className = "comic-top-float-back";
    floatBtn.innerHTML = labelHtml;
    floatBtn.style.top = `${(workspace.offsetTop || 60) + 6}px`;
    appShell.appendChild(floatBtn);
    floatBtn.addEventListener("click", onClick);

    const onScroll = () => {
      if (!anchorBtn.isConnected) return;
      const show =
        anchorBtn.getBoundingClientRect().bottom < workspace.getBoundingClientRect().top + 4;
      floatBtn.classList.toggle("is-visible", show);
    };
    workspace.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    topFloatCleanup = () => {
      workspace.removeEventListener("scroll", onScroll);
      floatBtn.remove();
    };
  }

  function pushComicView(comicView) {
    if (history.state?.page === "comic" && history.state?.comicView !== comicView) {
      history.pushState({ page: "comic", comicView }, "");
    }
  }

  function goBackToSearch() {
    if (history.state?.page === "comic" && history.state?.comicView === "detail") {
      history.back();
    } else {
      renderSearchView();
    }
  }

  function goBackToDetail() {
    if (history.state?.page === "comic" && history.state?.comicView === "read") {
      history.back();
    } else {
      renderComicDetail();
    }
  }

  function renderAutoScrollCardHtml() {
    const preset = SPEED_PRESETS[asPrefs.speedIdx] || SPEED_PRESETS[1];
    return `
      <div class="comic-as-card">
        <span class="comic-as-label">AUTO SCROLL</span>
        <div class="comic-as-controls">
          <button type="button" class="cat-pill ${asPrefs.enabled ? "active" : ""}" id="comicAsCycleSpeed" title="${isEn ? "Change speed" : "Ganti kecepatan"}">
            ${escapeHtml(isEn ? preset.enLabel : preset.label)} &rsaquo;
          </button>
          <button type="button" class="toggle-switch ${asPrefs.enabled ? "on" : ""}" id="comicAsToggle" role="switch" aria-checked="${asPrefs.enabled ? "true" : "false"}" aria-label="Aktifkan Auto Scroll">
            <span class="toggle-knob"></span>
          </button>
        </div>
      </div>
    `;
  }

  function renderServerMenuHtml() {
    return COMIC_SERVERS.map(
      (s) => `
      <button type="button" class="theme-option ${s.id === activeServer ? "active" : ""}" data-comic-server="${escapeHtml(s.id)}">
        <span class="theme-option-title">${escapeHtml(s.label)}</span>
        <span class="tag">${s.id === activeServer ? "AKTIF" : escapeHtml(s.tag)}</span>
      </button>
    `
    ).join("");
  }

  function renderSkeletonGridHtml(count = 6) {
    return Array.from({ length: count })
      .map(
        () => `
      <div class="comic-skeleton-card" aria-hidden="true">
        <div class="comic-skeleton-cover"></div>
        <div class="comic-skeleton-body">
          <div class="comic-skeleton-line"></div>
          <div class="comic-skeleton-line short"></div>
        </div>
      </div>
    `
      )
      .join("");
  }

  function bindCoverLoaders(container) {
    container?.querySelectorAll("img.comic-cover").forEach((img) => {
      const wrap = img.closest(".comic-cover-wrap");
      const done = () => {
        img.classList.add("is-loaded");
        wrap?.classList.remove("is-loading");
      };
      if (img.complete && img.naturalWidth > 0) {
        done();
      } else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
  }

  function renderGridHtml(items) {
    if (!items.length) {
      return `<div class="alert alert-info">Komik tidak ditemukan. Coba kata kunci lain atau ganti server di atas.</div>`;
    }
    return items
      .slice(0, 20)
      .map(
        (item, i) => `
      <button type="button" class="comic-card" data-comic-idx="${i}" style="--comic-i:${Math.min(i, 11)};">
        <div class="comic-cover-wrap ${item.thumbnail ? "is-loading" : ""}">
          ${item.thumbnail
            ? `<img class="comic-cover" src="${escapeHtml(makeProxyUrl(API_BASE, item.thumbnail, { referer: item.referer || "", fallback: true }))}" alt="${escapeHtml(item.title)}" loading="lazy" />`
            : `<span class="comic-cover-fallback">KOMIK</span>`
          }
          <span class="tag comic-type-tag">${escapeHtml(item.type || "KOMIK")}</span>
        </div>
        <div class="comic-card-title">${escapeHtml(item.title)}</div>
      </button>
    `
      )
      .join("");
  }

  function renderPaginationHtml(page, hasNext) {
    return `
      <div class="comic-pagination">
        <button type="button" class="btn btn-sm" id="comicPrevPage" ${page <= 1 ? "disabled" : ""}>&larr; Prev</button>
        <span class="tag">HAL ${page}</span>
        <button type="button" class="btn btn-sm btn-primary" id="comicNextPage" ${hasNext ? "" : "disabled"}>Next &rarr;</button>
      </div>
    `;
  }

  function renderSearchView(items = lastSearchItems, query = currentQuery) {
    cleanupReaderWidgets();
    const activeSrvObj = COMIC_SERVERS.find((s) => s.id === activeServer) || COMIC_SERVERS[0];

    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackHome" style="margin-bottom:10px;">${isEn ? "&larr; Home" : "&larr; Halaman Utama"}</button>
      <div class="panel-card">
        <div class="stage-head">
          <div>
            <h2 class="stage-title">${isEn ? "Read Comics" : "Baca Komik"}</h2>
            <p class="stage-desc">${isEn ? "Latest updates &amp; comic search." : "Update terbaru &amp; pencarian komik Sub Indo."}</p>
          </div>
          <span class="tag" id="comicSourceTag">${escapeHtml(activeSource)}</span>
        </div>

        <div id="comicAsFrontWrap">${renderAutoScrollCardHtml()}</div>

        <div class="select-wrap" style="margin-bottom:8px;">
          <button type="button" class="select-box" id="comicServerBtn" aria-expanded="false">
            <span id="comicServerLabel">${escapeHtml(activeSrvObj.label)}</span>
            <span class="select-chevron">▾</span>
          </button>
          <div class="select-menu" id="comicServerMenu" hidden>
            ${renderServerMenuHtml()}
          </div>
        </div>

        <form id="comicSearchForm" class="input-row">
          <input
            id="comicSearchInput"
            class="brutal-input"
            type="search"
            placeholder="${isEn ? "Search comic title (empty = latest)..." : "Cari judul komik (kosongkan = terbaru)..."}"
            value="${escapeHtml(query)}"
          />
          <button type="submit" id="comicSearchBtn" class="btn btn-primary" style="grid-column: 1 / -1;">${isEn ? "Search Comics" : "Cari Komik"}</button>
        </form>

        <div class="comic-chips-row" id="comicQuickChips">
          ${["", "Solo Leveling", "One Piece", "Naruto", "Gotoubun"]
        .map(
          (q) =>
            `<button type="button" class="cat-pill" data-comic-q="${escapeHtml(q)}">${escapeHtml(q || (isEn ? "Latest" : "Terbaru"))}</button>`
        )
        .join("")}
        </div>

        <div id="comicFeedback"></div>
        <div class="comic-grid" id="comicGrid">${renderGridHtml(items)}</div>
        <div id="comicPageBar">${items.length ? renderPaginationHtml(currentPage, lastHasNext) : ""}</div>
      </div>
    `;

    const backHomeBtn = stageEl.querySelector("#comicBackHome");
    const onBackHomeClick = () => {
      cleanupReaderWidgets();
      onBackHome();
    };
    backHomeBtn?.addEventListener("click", onBackHomeClick);
    attachTopFloatBack(backHomeBtn, isEn ? "&larr; Home" : "&larr; Halaman Utama", onBackHomeClick);

    const asWrap = stageEl.querySelector("#comicAsFrontWrap");
    asWrap?.addEventListener("click", (e) => {
      if (e.target.closest("#comicAsToggle")) {
        asPrefs.enabled = !asPrefs.enabled;
        saveAutoScrollPrefs(asPrefs);
        asWrap.innerHTML = renderAutoScrollCardHtml();
        if (asPrefs.enabled) showAutoScrollTipModal();
        return;
      }
      if (e.target.closest("#comicAsCycleSpeed")) {
        const wasOff = !asPrefs.enabled;
        asPrefs.speedIdx = (asPrefs.speedIdx + 1) % SPEED_PRESETS.length;
        asPrefs.enabled = true;
        saveAutoScrollPrefs(asPrefs);
        asWrap.innerHTML = renderAutoScrollCardHtml();
        if (wasOff) showAutoScrollTipModal();
      }
    });

    const form = stageEl.querySelector("#comicSearchForm");
    const serverBtn = stageEl.querySelector("#comicServerBtn");
    const serverLabel = stageEl.querySelector("#comicServerLabel");
    const serverMenu = stageEl.querySelector("#comicServerMenu");
    const input = stageEl.querySelector("#comicSearchInput");
    const btn = stageEl.querySelector("#comicSearchBtn");
    const fb = stageEl.querySelector("#comicFeedback");
    const grid = stageEl.querySelector("#comicGrid");
    const pageBar = stageEl.querySelector("#comicPageBar");
    const sourceTag = stageEl.querySelector("#comicSourceTag");
    bindCoverLoaders(grid);

    async function doSearch(q, serverId = activeServer, page = 1) {
      currentQuery = q;
      currentPage = Math.max(1, page);
      btn.disabled = true;
      btn.textContent = isEn ? "Searching..." : "Mencari...";
      fb.innerHTML = "";
      grid.innerHTML = renderSkeletonGridHtml(6);
      pageBar.innerHTML = "";
      try {
        const res = await fetch(`${API_BASE}/api/comic/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q, server: serverId, page: currentPage, lang: comicLang }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
        lastSearchItems = (data.items || []).slice(0, 20);
        lastHasNext =
          typeof data.hasNext === "boolean" ? data.hasNext : lastSearchItems.length >= 20;
        const rawSrc = (data.source || serverId).toLowerCase();
        activeSource = rawSrc === "mangadex" ? "MANGADEX · ID/EN" : rawSrc.toUpperCase();
        if (sourceTag) sourceTag.textContent = activeSource;
        grid.innerHTML = renderGridHtml(lastSearchItems);
        bindCoverLoaders(grid);
        pageBar.innerHTML =
          lastSearchItems.length || currentPage > 1
            ? renderPaginationHtml(currentPage, lastHasNext)
            : "";
        const workspace = stageEl.closest(".workspace");
        if (workspace && workspace.scrollTop > 0) {
          workspace.scrollTo({ top: 0, behavior: "smooth" });
        }
      } catch (err) {
        grid.innerHTML = "";
        fb.innerHTML = `<div class="alert alert-error">${escapeHtml(err.message || "Gagal memuat komik.")}</div>`;
      } finally {
        btn.disabled = false;
        btn.textContent = isEn ? "Search Comics" : "Cari Komik";
      }
    }

    serverBtn?.addEventListener("click", () => {
      const open = serverMenu.hidden;
      serverMenu.hidden = !open;
      serverBtn.setAttribute("aria-expanded", String(open));
    });

    serverMenu?.addEventListener("click", (e) => {
      const opt = e.target.closest("[data-comic-server]");
      if (!opt) return;
      activeServer = opt.dataset.comicServer;
      const srvObj = COMIC_SERVERS.find((s) => s.id === activeServer) || COMIC_SERVERS[0];
      if (serverLabel) serverLabel.textContent = srvObj.label;
      serverMenu.innerHTML = renderServerMenuHtml();
      serverMenu.hidden = true;
      serverBtn?.setAttribute("aria-expanded", "false");
      doSearch(input.value.trim(), activeServer, 1);
    });

    form?.addEventListener("submit", (e) => {
      e.preventDefault();
      doSearch(input.value.trim(), activeServer, 1);
    });

    stageEl.querySelector("#comicQuickChips")?.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-comic-q]");
      if (!chip) return;
      input.value = chip.dataset.comicQ;
      doSearch(chip.dataset.comicQ, activeServer, 1);
    });

    pageBar?.addEventListener("click", (e) => {
      if (e.target.closest("#comicPrevPage") && currentPage > 1) {
        doSearch(currentQuery, activeServer, currentPage - 1);
      } else if (e.target.closest("#comicNextPage")) {
        doSearch(currentQuery, activeServer, currentPage + 1);
      }
    });

    grid?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-comic-idx]");
      if (!card) return;
      const item = lastSearchItems[Number(card.dataset.comicIdx)];
      if (item) openComicDetail(item);
    });

    if (!lastSearchItems.length && !query) {
      doSearch("", activeServer, 1);
    }
  }

  async function openComicDetail(item) {
    cleanupReaderWidgets();
    pushComicView("detail");
    chapterQuery = "";
    chapterPage = 1;
    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackSearch" style="margin-bottom:10px;">${isEn ? "&larr; Comic List" : "&larr; Daftar Komik"}</button>
      <div class="panel-card">
        <div class="comic-detail-head">
          <div class="comic-skeleton-cover" style="width:96px;flex-shrink:0;"></div>
          <div class="comic-detail-meta">
            <div class="comic-skeleton-line" style="height:18px;margin-bottom:8px;"></div>
            <div class="comic-skeleton-line short"></div>
            <div class="comic-skeleton-line" style="margin-top:12px;"></div>
            <div class="comic-skeleton-line short"></div>
          </div>
        </div>
      </div>
    `;
    const backSearchBtn = stageEl.querySelector("#comicBackSearch");
    backSearchBtn?.addEventListener("click", goBackToSearch);
    attachTopFloatBack(backSearchBtn, isEn ? "&larr; Comic List" : "&larr; Daftar Komik", goBackToSearch);

    try {
      const res = await fetch(`${API_BASE}/api/comic/detail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: item.url, lang: comicLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
      currentComic = { ...data, thumbnail: item.thumbnail || data.thumbnail };
      renderComicDetail();
    } catch (err) {
      stageEl.innerHTML = `
        <button type="button" class="btn btn-sm" id="comicBackSearch" style="margin-bottom:10px;">${isEn ? "&larr; Comic List" : "&larr; Daftar Komik"}</button>
        <div class="panel-card"><div class="alert alert-error">${escapeHtml(err.message || (isEn ? "Failed to open comic." : "Gagal membuka komik."))}</div></div>
      `;
      const backSearchBtn = stageEl.querySelector("#comicBackSearch");
      backSearchBtn?.addEventListener("click", goBackToSearch);
      attachTopFloatBack(backSearchBtn, isEn ? "&larr; Comic List" : "&larr; Daftar Komik", goBackToSearch);
    }
  }

  function renderComicDetail() {
    cleanupReaderWidgets();
    if (!currentComic) return renderSearchView();
    const baseList = sortAsc
      ? currentComic.chapters.map((ch, idx) => ({ ch, idx }))
      : [...currentComic.chapters].map((ch, idx) => ({ ch, idx })).reverse();

    const q = chapterQuery.trim().toLowerCase();
    const filtered = q
      ? baseList.filter(({ ch }) => ch.title.toLowerCase().includes(q))
      : baseList;

    const totalPages = Math.max(1, Math.ceil(filtered.length / CHAPTERS_PER_PAGE));
    chapterPage = Math.max(1, Math.min(chapterPage, totalPages));
    const start = (chapterPage - 1) * CHAPTERS_PER_PAGE;
    const paged = filtered.slice(start, start + CHAPTERS_PER_PAGE);

    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackSearch" style="margin-bottom:10px;">${isEn ? "&larr; Comic List" : "&larr; Daftar Komik"}</button>
      <div class="panel-card">
        <div class="comic-detail-head">
          ${currentComic.thumbnail
        ? `<img class="comic-detail-cover" src="${escapeHtml(makeProxyUrl(API_BASE, currentComic.thumbnail, { referer: currentComic.referer || "", fallback: true }))}" alt="${escapeHtml(currentComic.title)}" />`
        : ""
      }
          <div class="comic-detail-meta">
            <h2 class="stage-title" style="font-size:1.05rem;">${escapeHtml(currentComic.title)}</h2>
            <span class="tag">${currentComic.chapters.length} CHAPTER</span>
            ${currentComic.source ? `<span class="tag">${escapeHtml(currentComic.source.toUpperCase())}</span>` : ""}
            ${currentComic.synopsis ? `<p class="stage-desc" style="margin-top:8px;">${escapeHtml(currentComic.synopsis)}</p>` : ""}
          </div>
        </div>

        <div class="support-head" style="margin-top:12px;">
          <div class="field-label" style="margin:0;">${isEn ? "CHAPTER LIST" : "DAFTAR CHAPTER"}</div>
          <button type="button" class="btn btn-sm" id="comicSortBtn">${sortAsc ? (isEn ? "Oldest ↑" : "Terlama ↑") : (isEn ? "Newest ↓" : "Terbaru ↓")}</button>
        </div>

        <input
          id="comicChSearch"
          class="brutal-input"
          type="search"
          placeholder="${isEn ? "Search chapter (e.g. 120, 45)..." : "Cari chapter (mis. 120, 45)..."}"
          value="${escapeHtml(chapterQuery)}"
          style="margin-bottom:10px;"
        />

        <div class="comic-chapter-list" id="comicChapterList">
          ${paged.length
        ? paged
          .map(
            ({ ch, idx }, pos) => `
                  <button type="button" class="comic-chapter-btn" data-ch-idx="${idx}" style="--comic-i:${Math.min(pos, 12)};">
                    <span>${escapeHtml(ch.title)}</span>
                    <span class="tag">${isEn ? "READ" : "BACA"}</span>
                  </button>
                `
          )
          .join("")
        : `<div class="alert alert-info">${isEn ? "No chapters available." : "Belum ada chapter tersedia."}</div>`
      }
        </div>

        ${filtered.length > CHAPTERS_PER_PAGE
        ? `<div class="comic-pagination" id="comicChPager">
                <button type="button" class="btn btn-sm" id="comicChPrev" ${chapterPage <= 1 ? "disabled" : ""}>&larr; Prev</button>
                <span class="tag">HAL ${chapterPage}/${totalPages}</span>
                <button type="button" class="btn btn-sm btn-primary" id="comicChNext" ${chapterPage >= totalPages ? "disabled" : ""}>Next &rarr;</button>
              </div>`
        : ""
      }
      </div>
    `;

    const backSearchBtn = stageEl.querySelector("#comicBackSearch");
    backSearchBtn?.addEventListener("click", goBackToSearch);
    attachTopFloatBack(backSearchBtn, isEn ? "&larr; Comic List" : "&larr; Daftar Komik", goBackToSearch);
    stageEl.querySelector("#comicSortBtn")?.addEventListener("click", () => {
      sortAsc = !sortAsc;
      chapterPage = 1;
      renderComicDetail();
    });
    const chInput = stageEl.querySelector("#comicChSearch");
    chInput?.addEventListener("input", () => {
      chapterQuery = chInput.value;
      chapterPage = 1;
      renderComicDetail();
      const restored = stageEl.querySelector("#comicChSearch");
      if (restored) {
        restored.focus();
        restored.setSelectionRange(restored.value.length, restored.value.length);
      }
    });
    stageEl.querySelector("#comicChPrev")?.addEventListener("click", () => {
      if (chapterPage > 1) {
        chapterPage -= 1;
        renderComicDetail();
      }
    });
    stageEl.querySelector("#comicChNext")?.addEventListener("click", () => {
      if (chapterPage < totalPages) {
        chapterPage += 1;
        renderComicDetail();
      }
    });
    stageEl.querySelector("#comicChapterList")?.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-ch-idx]");
      if (!btn) return;
      openChapter(Number(btn.dataset.chIdx));
    });
  }

  async function openChapter(chIdx) {
    cleanupReaderWidgets();
    const ch = currentComic?.chapters?.[chIdx];
    if (!ch) return;
    pushComicView("read");
    const workspace = stageEl.closest(".workspace");
    if (workspace && workspace.scrollTop > 0) {
      workspace.scrollTo({ top: 0, behavior: "smooth" });
    }

    stageEl.innerHTML = `
      <button type="button" class="btn btn-sm" id="comicBackDetail" style="margin-bottom:10px;">${isEn ? "&larr; Chapters" : "&larr; Daftar Chapter"}</button>
      <div class="panel-card"><div class="alert alert-info">${isEn ? "Loading" : "Memuat halaman"} ${escapeHtml(ch.title)}...</div></div>
    `;
    stageEl.querySelector("#comicBackDetail")?.addEventListener("click", goBackToDetail);

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
          <button type="button" class="btn btn-sm" data-nav-ch="${chIdx - 1}" ${hasPrev ? "" : "disabled"}>${isEn ? "&larr; Prev" : "&larr; Sebelumnya"}</button>
          <span class="tag">${data.pages.length} ${isEn ? "PGS" : "HAL"}</span>
          <button type="button" class="btn btn-sm btn-primary" data-nav-ch="${chIdx + 1}" ${hasNext ? "" : "disabled"}>${isEn ? "Next &rarr;" : "Berikutnya &rarr;"}</button>
        </div>
      `;

      const ref = data.referer || currentComic?.referer || "";
      stageEl.innerHTML = `
        <button type="button" class="btn btn-sm" id="comicBackDetail" style="margin-bottom:10px;">${isEn ? "&larr; Chapters" : "&larr; Daftar Chapter"}</button>
        <div class="panel-card" style="padding:10px;">
          <h2 class="stage-title" style="font-size:0.95rem;margin-bottom:8px;">${escapeHtml(data.title || ch.title)}</h2>
          ${navHtml}
          <div class="comic-reader-pages" id="comicReaderPages">
            ${(data.pages || [])
          .map(
            (src, i) =>
              `<img class="comic-page-img" data-page-src="${escapeHtml(makeProxyUrl(API_BASE, src, { referer: ref }))}" alt="Halaman ${i + 1}" />`
          )
          .join("")}
          </div>
          ${navHtml}
        </div>
      `;

      const appShell = document.querySelector(".app-shell") || document.body;
      const topBackBtn = stageEl.querySelector("#comicBackDetail");

      // 1. Floating Back Button (smoothly appears at bottom-right when top Back scrolls out of view)
      const floatBack = document.createElement("button");
      floatBack.type = "button";
      floatBack.className = "comic-float-back";
      floatBack.innerHTML = isEn ? `&larr; Back` : `&larr; Kembali`;
      appShell.appendChild(floatBack);
      floatBack.addEventListener("click", goBackToDetail);

      let io = null;
      const onScrollCheck = () => {
        if (!topBackBtn || !workspace) return;
        const rect = topBackBtn.getBoundingClientRect();
        const wsRect = workspace.getBoundingClientRect();
        floatBack.classList.toggle("is-visible", rect.bottom < wsRect.top + 4);
      };
      if (typeof IntersectionObserver !== "undefined" && topBackBtn && workspace) {
        io = new IntersectionObserver(
          (entries) => {
            floatBack.classList.toggle("is-visible", !entries[0].isIntersecting);
          },
          { root: workspace, threshold: 0.05 }
        );
        io.observe(topBackBtn);
      } else if (workspace) {
        workspace.addEventListener("scroll", onScrollCheck, { passive: true });
      }

      // 2. Zero-Lag Auto-Scroll Engine + Bottom-Left Floating Pill
      let rafId = 0;
      let paused = false;
      let lastTs = 0;
      let accPx = 0;
      let speedMenuOpen = false;
      let floatAs = null;

      const stepScroll = (ts) => {
        if (!asPrefs.enabled || paused || !workspace || !stageEl.querySelector("#comicReaderPages")) {
          rafId = 0;
          return;
        }
        if (lastTs) {
          const dt = Math.min(50, ts - lastTs);
          const speed = (SPEED_PRESETS[asPrefs.speedIdx] || SPEED_PRESETS[1]).pxPerSec;
          accPx += (speed * dt) / 1000;
          if (accPx >= 1) {
            const whole = Math.floor(accPx);
            accPx -= whole;
            const maxTop = workspace.scrollHeight - workspace.clientHeight;
            if (workspace.scrollTop < maxTop) {
              workspace.scrollTop += whole;
            } else {
              paused = true;
              renderFloatAs();
              rafId = 0;
              return;
            }
          }
        }
        lastTs = ts;
        rafId = requestAnimationFrame(stepScroll);
      };

      const startScrollLoop = () => {
        if (!rafId && asPrefs.enabled && !paused) {
          lastTs = 0;
          accPx = 0;
          rafId = requestAnimationFrame(stepScroll);
        }
      };

      const stopScrollLoop = () => {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      };

      const renderFloatAs = () => {
        if (!asPrefs.enabled) {
          if (floatAs) floatAs.hidden = true;
          return;
        }
        if (!floatAs) {
          floatAs = document.createElement("div");
          floatAs.className = "comic-as-float";
          appShell.appendChild(floatAs);
          floatAs.addEventListener("click", (e) => {
            if (e.target.closest("[data-as-toggle-pause]")) {
              paused = !paused;
              renderFloatAs();
              if (!paused) startScrollLoop();
              else stopScrollLoop();
              return;
            }
            if (e.target.closest("[data-as-off]")) {
              asPrefs.enabled = false;
              saveAutoScrollPrefs(asPrefs);
              stopScrollLoop();
              renderFloatAs();
              return;
            }
            if (e.target.closest("[data-as-speed-pop]")) {
              speedMenuOpen = !speedMenuOpen;
              renderFloatAs();
              return;
            }
            const pick = e.target.closest("[data-as-pick]");
            if (pick) {
              asPrefs.speedIdx = Number(pick.dataset.asPick);
              saveAutoScrollPrefs(asPrefs);
              speedMenuOpen = false;
              paused = false;
              renderFloatAs();
              startScrollLoop();
            }
          });
        }
        floatAs.hidden = false;
        const preset = SPEED_PRESETS[asPrefs.speedIdx] || SPEED_PRESETS[1];
        floatAs.innerHTML = `
          ${speedMenuOpen
            ? `<div class="comic-as-pop">
                  ${SPEED_PRESETS.map(
              (p, idx) =>
                `<button type="button" class="cat-pill ${idx === asPrefs.speedIdx ? "active" : ""}" data-as-pick="${idx}">${escapeHtml(isEn ? p.enLabel : p.label)}</button>`
            ).join("")}
                </div>`
            : ""
          }
          <div class="comic-as-pill">
            <span class="comic-as-dot ${paused ? "is-paused" : ""}"></span>
            <button type="button" class="comic-as-btn" data-as-speed-pop>${escapeHtml(isEn ? preset.enLabel : preset.label)} ▾</button>
            <button type="button" class="comic-as-btn" data-as-toggle-pause>${paused ? "▶" : "❚❚"}</button>
            <button type="button" class="comic-as-btn" data-as-off aria-label="${isEn ? "Turn off Auto Scroll" : "Matikan Auto Scroll"}">&times;</button>
          </div>
        `;
      };

      if (asPrefs.enabled) {
        renderFloatAs();
        startScrollLoop();
      }

      let mo = null;
      if (typeof MutationObserver !== "undefined") {
        mo = new MutationObserver(() => {
          if (!stageEl.querySelector("#comicReaderPages")) {
            cleanupReaderWidgets();
          }
        });
        mo.observe(stageEl, { childList: true });
      }

      readerCleanup = () => {
        mo?.disconnect();
        stopScrollLoop();
        io?.disconnect();
        workspace?.removeEventListener("scroll", onScrollCheck);
        floatBack.remove();
        floatAs?.remove();
      };

      // 3. Throttled Page Loader (max 2 concurrent + 1 retry)
      const pageImgs = Array.from(stageEl.querySelectorAll("#comicReaderPages img[data-page-src]"));
      let nextPageIdx = 0;
      let activeWorkers = 0;
      const pumpPages = () => {
        while (activeWorkers < 2 && nextPageIdx < pageImgs.length) {
          const img = pageImgs[nextPageIdx++];
          if (!img.isConnected) return;
          activeWorkers += 1;
          const url = img.dataset.pageSrc;
          const finish = () => {
            img.classList.add("is-loaded");
            activeWorkers -= 1;
            pumpPages();
          };
          img.addEventListener("load", finish, { once: true });
          img.addEventListener(
            "error",
            () => {
              if (!img.dataset.retried) {
                img.dataset.retried = "1";
                setTimeout(() => {
                  if (!img.isConnected) return finish();
                  img.addEventListener("load", finish, { once: true });
                  img.addEventListener("error", finish, { once: true });
                  img.src = `${url}${url.includes("?") ? "&" : "?"}_r=${Date.now()}`;
                }, 450);
              } else {
                finish();
              }
            },
            { once: true }
          );
          img.src = url;
        }
      };
      pumpPages();

      topBackBtn?.addEventListener("click", goBackToDetail);
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
      stageEl.querySelector("#comicBackDetail")?.addEventListener("click", goBackToDetail);
    }
  }

  renderSearchView();
  return {
    syncView(comicView) {
      if (comicView === "detail" && currentComic) renderComicDetail();
      else renderSearchView();
    },
  };
}
