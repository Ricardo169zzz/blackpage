const assert = require("assert");
const http = require("http");
const { parse, isValidTikTokUrl } = require("../lib/tiktok");
const { isValidYouTubeUrl } = require("../lib/youtube");
const { isValidInstagramUrl } = require("../lib/instagram");
const { isValidFacebookUrl } = require("../lib/facebook");
const { isValidCapCutUrl } = require("../lib/capcut");
const { isValidPinterestUrl } = require("../lib/pinterest");
const { isValidSpotifyPlaylistUrl } = require("../lib/spotify");
const { createServer, isAllowedRemoteUrl, sanitizeFilename } = require("../server");

function request(port, method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: "127.0.0.1", port, path, method, headers: { "Content-Type": "application/json" } },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => resolve({ status: res.statusCode, body: data }));
      }
    );
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

(async () => {
  // 1. URL validation
  assert.strictEqual(isValidTikTokUrl("https://vt.tiktok.com/ZSxgka422/"), true);
  assert.strictEqual(isValidTikTokUrl("https://www.tiktok.com/@user/video/123"), true);
  assert.strictEqual(isValidTikTokUrl("https://evil.com/tiktok.com"), false);
  assert.strictEqual(isValidTikTokUrl("not-a-url"), false);

  // 2. HTML parser (including ssr-card caption & avatar)
  const sampleHtml = `
    <div class="ssr-card">
      <div class="ssr-poster" style="background-image: url('https://tikcdn.io/ssstik/p/thumb.webp')"></div>
      <img class="ssr-ava" src="https://tikcdn.io/ssstik/a/avatar.webp" alt="User Avatar" />
      <div class="ssr-author"><h2>Nexa Pemula</h2></div>
      <p class="ssr-caption">source code di ch #website</p>
      <span>12.5K likes</span>
      <a href="https://ssstik.io/d/123.mp4" download>Tanpa tanda air HD</a>
      <a href="https://ssstik.io/d/123.mp3">Unduh MP3</a>
    </div>
  `;
  const parsed = parse(sampleHtml, "https://vt.tiktok.com/ZSxgka422/");
  assert.strictEqual(parsed.status, "success");
  assert.strictEqual(parsed.author, "Nexa Pemula");
  assert.strictEqual(parsed.avatar, "https://tikcdn.io/ssstik/a/avatar.webp");
  assert.strictEqual(parsed.thumbnail, "https://tikcdn.io/ssstik/p/thumb.webp");
  assert.strictEqual(parsed.title, "source code di ch #website");
  assert.strictEqual(parsed.downloads.length, 2);
  assert.strictEqual(parsed.downloads[0].type, "video_hd_no_watermark");
  assert.strictEqual(parsed.downloads[1].type, "audio_mp3");
  assert.strictEqual(parsed.stats.likes, "12.5K");

  // 3. HTTP server routes
  const server = createServer();
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();

  try {
    const health = await request(port, "GET", "/api/health");
    assert.strictEqual(health.status, 200);
    assert.strictEqual(JSON.parse(health.body).ok, true);

    const badUrl = await request(port, "POST", "/api/tiktok", { url: "https://example.com" });
    assert.strictEqual(badUrl.status, 400);

    const home = await request(port, "GET", "/");
    assert.strictEqual(home.status, 200);
    assert.ok(home.body.includes("Blackpage"));

    // 4. Media proxy SSRF guard & filename sanitizer
    assert.strictEqual(isAllowedRemoteUrl("https://cdn.example.com/v.mp4"), true);
    assert.strictEqual(isAllowedRemoteUrl("http://127.0.0.1:3000/secret"), false);
    assert.strictEqual(isAllowedRemoteUrl("http://localhost/test"), false);
    assert.strictEqual(sanitizeFilename("video keren!.mp4"), "video_keren_.mp4");

    const blockedMedia = await request(port, "GET", "/api/media?url=http://127.0.0.1:3000/");
    assert.strictEqual(blockedMedia.status, 400);

    // 5. YouTube URL validation & endpoint guard
    assert.strictEqual(isValidYouTubeUrl("https://youtu.be/gQmLrZw5Jlg?si=LZWsf2kY90HG9nEo"), true);
    assert.strictEqual(isValidYouTubeUrl("https://www.youtube.com/watch?v=gQmLrZw5Jlg"), true);
    assert.strictEqual(isValidYouTubeUrl("https://evil.com/youtube.com"), false);

    const badYt = await request(port, "POST", "/api/youtube", { url: "https://example.com" });
    assert.strictEqual(badYt.status, 400);

    const badYtPl = await request(port, "POST", "/api/youtube/playlist", { url: "https://example.com" });
    assert.strictEqual(badYtPl.status, 400);

    // 6. Spotify empty query guard & playlist guard
    const badSp = await request(port, "POST", "/api/spotify", { q: "   " });
    assert.strictEqual(badSp.status, 400);

    assert.strictEqual(
      isValidSpotifyPlaylistUrl("https://open.spotify.com/playlist/6Tp1XghEcLfAsZfwHZA6dK"),
      true
    );
    assert.strictEqual(isValidSpotifyPlaylistUrl("https://open.spotify.com/track/123"), false);
    const badSpPl = await request(port, "POST", "/api/spotify/playlist", { url: "https://example.com" });
    assert.strictEqual(badSpPl.status, 400);

    // 7. Instagram URL validation & endpoint guard
    assert.strictEqual(isValidInstagramUrl("https://www.instagram.com/reel/Da_eH4pva9C/"), true);
    assert.strictEqual(isValidInstagramUrl("https://evil.com/instagram.com"), false);

    const badIg = await request(port, "POST", "/api/instagram", { url: "https://example.com" });
    assert.strictEqual(badIg.status, 400);

    // 8. Facebook URL validation & endpoint guard
    assert.strictEqual(isValidFacebookUrl("https://www.facebook.com/share/r/176Gd2Y3F5/"), true);
    assert.strictEqual(isValidFacebookUrl("https://fb.watch/abc123/"), true);
    assert.strictEqual(isValidFacebookUrl("https://evil.com/facebook.com"), false);

    const badFb = await request(port, "POST", "/api/facebook", { url: "https://example.com" });
    assert.strictEqual(badFb.status, 400);

    // 9. CapCut URL validation & endpoint guard
    assert.strictEqual(isValidCapCutUrl("https://www.capcut.com/tv2/ZSQ9N6qA4/"), true);
    assert.strictEqual(isValidCapCutUrl("https://evil.com/capcut.com"), false);

    const badCc = await request(port, "POST", "/api/capcut", { url: "https://example.com" });
    assert.strictEqual(badCc.status, 400);

    // 10. Pinterest URL validation & endpoint guard
    assert.strictEqual(isValidPinterestUrl("https://pin.it/5TJ3CCrNF"), true);
    assert.strictEqual(isValidPinterestUrl("https://www.pinterest.com/pin/123456/"), true);
    assert.strictEqual(isValidPinterestUrl("https://evil.com/pinterest.com"), false);

    const badPin = await request(port, "POST", "/api/pinterest", { url: "https://example.com" });
    assert.strictEqual(badPin.status, 400);

    // 11. AIO URL validation guard
    const badAio = await request(port, "POST", "/api/aio", { url: "not-a-url" });
    assert.strictEqual(badAio.status, 400);
  } finally {
    server.close();
  }

  console.log("All checks passed!");
})();
