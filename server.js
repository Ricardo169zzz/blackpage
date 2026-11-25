const http = require("http");
const fs = require("fs");
const path = require("path");
const {
  handleApiRequest,
  sendJson,
  isAllowedRemoteUrl,
  sanitizeFilename,
} = require("./lib/router");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  const relPath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        return res.end("Not Found");
      }
      res.writeHead(500);
      return res.end("Internal Server Error");
    }

    const ext = path.extname(filePath).toLowerCase();
    const isCode = ext === ".html" || ext === ".css" || ext === ".js";
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": isCode ? "no-store" : "public, max-age=3600",
    });
    res.end(content);
  });
}

async function handleRequest(req, res) {
  const handled = await handleApiRequest(req, res);
  if (handled) return;

  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (req.method === "GET") {
    return serveStatic(req, res, urlObj.pathname);
  }
  sendJson(res, 405, { status: "error", message: "Method Not Allowed" });
}

function createServer() {
  return http.createServer(handleRequest);
}

if (require.main === module) {
  const server = createServer();
  server.listen(PORT, () => {
    console.log(`Blackpage running at http://localhost:${PORT}`);
  });
}

module.exports = { createServer, handleRequest, isAllowedRemoteUrl, sanitizeFilename };
