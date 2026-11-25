# Daftar Fungsi Scraper — `SCRAPER_COFLYN` (`@coflyn/scrapr` v1.4.1)

Sumber: `https://github.com/coflyn/scrapr`  
Entrypoint utama: [SCRAPER_COFLYN/index.js](file:///e:/TOOLS%20OP/SCRAPER_COFLYN/index.js)

> [!NOTE]
> Modul-modul di folder ini menggunakan dependency `axios` dan `cheerio` (lihat [package.json](file:///e:/TOOLS%20OP/SCRAPER_COFLYN/package.json)). Saat akan diintegrasikan ke Blackpage, pastikan dependency terpasang atau adaptasikan ke `fetch` bawaan Node.js.

---

## 1. Social & Video Downloader

| Kategori | Path Modul | Fungsi / Provider Tersedia |
|---|---|---|
| **TikTok** | `lib/tiktok/index.js` | `snaptik.scrape`, `tiktokio.scrape`, `savetik.scrape`, `ssstik.scrape`, `tikdownloader.scrape` |
| **Douyin** | `lib/douyin/index.js` | `direct.scrape` |
| **YouTube** | `lib/youtube/index.js` | `ytmp3.scrape`, `ytmp3.extractVideoId`, `ytmp3gg.scrape`, `playlist.scrape` |
| **Instagram** | `lib/instagram/index.js` | `indown.scrape`, `snapinsta.scrape`, `snapsave.scrape`, `direct.scrape` |
| **Facebook** | `lib/facebook/index.js` | `snapsave.scrape`, `fdown.scrape` |
| **Twitter / X** | `lib/twitter/index.js` | `tweeload.scrape`, `tvd.scrape`, `savetwt.scrape`, `direct.scrape` |
| **Threads** | `lib/threads/index.js` | `threadster` (alias `threadster.scrape`) |
| **Reddit** | `lib/reddit/index.js` | `rapidsave` (alias `rapidsave.scrape`) |
| **Pinterest** | `lib/pinterest/index.js` | `pindown.scrape`, `direct.scrape` |
| **Pixiv** | `lib/pixiv/index.js` | `ajax.scrape` |
| **Bilibili** | `lib/bilibili/index.js` | `direct.scrape` |
| **RedNote (Xiaohongshu)** | `lib/rednote/index.js` | `direct.scrape` |

## 2. Musik & Audio Downloader

| Kategori | Path Modul | Fungsi / Provider Tersedia |
|---|---|---|
| **Spotify** | `lib/spotify/index.js` | `spotmate.scrape`, `spotidown.scrape`, `soundloaders.scrape`, `spotisaver.scrape` |
| **Apple Music** | `lib/applemusic/index.js` | `aplmate.scrape` |
| **SoundCloud** | `lib/soundcloud/index.js` | `direct.scrape`, `klickaud.scrape` |
| **Bandcamp** | `lib/bandcamp/index.js` | `direct.scrape`, `bandcampdownloader.scrape` |

## 3. File Hosting & Link Resolver (`lib/resolver/index.js`)

| Fungsi | Provider / Kegunaan |
|---|---|
| `resolver.sfile(url)` | Ekstrak link download **Sfile.mobi** |
| `resolver.mediafire(url)` | Ekstrak link download **MediaFire** |
| `resolver.gdrive(url)` | Ekstrak link download **Google Drive** |
| `resolver.pixeldrain(url)` | Ekstrak link download **Pixeldrain** |
| `resolver.catbox(url)` | Ekstrak link **Catbox** |
| `resolver.krakenfiles(url)` | Ekstrak link download **Krakenfiles** |
| `resolver.doodstream(url)` | Ekstrak link video **Doodstream** |
| `resolver.safelinku(url)` | Bypass / resolve **Safelinku** |
| `resolver.sub2unlock(url)` | Bypass / resolve **Sub2Unlock** |
| `resolver.rekonise(url)` | Bypass / resolve **Rekonise** |
| `resolver.unshorten(url)` | Membuka shortlink (unshorten URL) |
| `terabox.sechno(url)` | Ekstrak file **TeraBox** (`lib/terabox/index.js`) |

## 4. Anime (`lib/anime/index.js`)

Setiap provider diekspor langsung sebagai fungsi `scrape`:
- `anime.otakudesu(queryOrUrl)` — OtakuDesu (`lib/anime/otakudesu/index.js`)
- `anime.nimegami(queryOrUrl)` — Nimegami (`lib/anime/nimegami/index.js`)
- `anime.gogoanime(queryOrUrl)` — Gogoanime (`lib/anime/gogoanime/index.js`)
- `anime.animetosho(queryOrUrl)` — AnimeTosho (`lib/anime/animetosho/index.js`)

## 5. Komik / Manga (`lib/comic/index.js`)

Setiap provider diekspor langsung sebagai fungsi `scrape`:
- `comic.kiryuu` — Kiryuu (`lib/comic/kiryuu/index.js`)
- `comic.komikcast` — Komikcast (`lib/comic/komikcast/index.js`)
- `comic.mangadex` — MangaDex (`lib/comic/mangadex/index.js`)
- `comic.komikindo` — Komikindo (`lib/comic/komikindo/index.js`)
- `comic.komiku` — Komiku (`lib/comic/komiku/index.js`)
- `comic.bacakomik` — Bacakomik (`lib/comic/bacakomik/index.js`)
- `comic.manhwaindo` — Manhwaindo (`lib/comic/manhwaindo/index.js`)
- `comic.asurascans` — AsuraScans (`lib/comic/asurascans/index.js`)
- `comic.mangabats` (alias `comic.mangabat`) — MangaBats (`lib/comic/mangabats/index.js`)
