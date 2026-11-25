export function makeProxyUrl(API_BASE, remoteUrl, { download = false, filename = "" } = {}) {
  const params = new URLSearchParams({ url: remoteUrl });
  if (download) params.set("download", "1");
  if (filename) params.set("filename", filename);
  return `${API_BASE}/api/media?${params.toString()}`;
}

function escapeAttr(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderProgressHtml({ label = "Mengunduh...", percent = null, bytes = 0, total = 0 } = {}) {
  const pctText =
    typeof percent === "number"
      ? `${percent}%`
      : bytes > 0
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : "...";
  const isIndet = typeof percent !== "number";
  const widthStyle = isIndet ? "" : `style="width:${Math.max(0, Math.min(100, percent))}%"`;
  const totalText = total > 0 ? ` (${(bytes / (1024 * 1024)).toFixed(1)}/${(total / (1024 * 1024)).toFixed(1)} MB)` : "";

  return `
    <div class="dl-progress-wrap">
      <div class="dl-progress-meta">
        <span>${escapeAttr(label)}${escapeAttr(totalText)}</span>
        <span>${escapeAttr(pctText)}</span>
      </div>
      <div class="dl-progress-bar">
        <div class="dl-progress-fill ${isIndet ? "indeterminate" : ""}" ${widthStyle}></div>
      </div>
    </div>
  `;
}

function triggerBrowserDownload(href, filename) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadMediaFile({ API_BASE, remoteUrl, mediaType, filename, onProgress }) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;

  if (cap?.isNativePlatform?.()) {
    if (!fs) {
      throw new Error("Plugin Filesystem belum aktif di APK. Silakan update/build ulang APK.");
    }
    if (!API_BASE) {
      throw new Error("API Base URL belum diisi. Buka Setting -> Lanjutan lalu isi URL server.");
    }

    const subDir = mediaType === "audio" ? "audio" : mediaType === "image" ? "image" : "video";
    const dirPath = `Download/Blackpage/${subDir}`;
    const targetPath = `${dirPath}/${filename}`;
    const sourceUrl = makeProxyUrl(API_BASE, remoteUrl, { download: true, filename });

    try {
      await fs.requestPermissions?.();
    } catch {
      // Android 13+ may not require legacy storage permission for Download/
    }

    try {
      await fs.mkdir({
        path: dirPath,
        directory: "EXTERNAL_STORAGE",
        recursive: true,
      });
    } catch {
      // Folder may already exist
    }

    if (typeof fs.downloadFile === "function") {
      let progressHandle = null;
      if (onProgress && typeof fs.addListener === "function") {
        try {
          progressHandle = await fs.addListener("progress", (ev) => {
            if (ev?.url && ev.url !== sourceUrl) return;
            const total = Number(ev?.contentLength || 0);
            const bytes = Number(ev?.bytes || 0);
            const percent = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null;
            onProgress({ bytes, total, percent });
          });
        } catch {
          progressHandle = null;
        }
      }

      try {
        onProgress?.({ bytes: 0, total: 0, percent: 0 });
        await fs.downloadFile({
          url: sourceUrl,
          path: targetPath,
          directory: "EXTERNAL_STORAGE",
          recursive: true,
          progress: Boolean(onProgress),
        });
        onProgress?.({ bytes: 1, total: 1, percent: 100 });
        return { native: true, path: targetPath };
      } finally {
        await progressHandle?.remove?.().catch?.(() => {});
      }
    }

    // Fallback for older Filesystem plugin without downloadFile
    const res = await fetch(makeProxyUrl(API_BASE, remoteUrl));
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || "").split(",")[1] || "");
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    await fs.writeFile({
      path: targetPath,
      data: base64,
      directory: "EXTERNAL_STORAGE",
      recursive: true,
    });
    onProgress?.({ bytes: blob.size, total: blob.size, percent: 100 });
    return { native: true, path: targetPath };
  }

  // Web: stream with progress when callback provided, then save via Blob URL
  const dlUrl = makeProxyUrl(API_BASE, remoteUrl, { download: true, filename });
  if (onProgress && typeof ReadableStream !== "undefined") {
    try {
      onProgress({ bytes: 0, total: 0, percent: 0 });
      const res = await fetch(dlUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (res.body) {
        const total = Number(res.headers.get("content-length") || 0);
        const reader = res.body.getReader();
        const chunks = [];
        let bytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          bytes += value.byteLength;
          const percent = total > 0 ? Math.min(100, Math.round((bytes / total) * 100)) : null;
          onProgress({ bytes, total, percent });
        }
        const blob = new Blob(chunks, {
          type: res.headers.get("content-type") || "application/octet-stream",
        });
        const objUrl = URL.createObjectURL(blob);
        triggerBrowserDownload(objUrl, filename);
        setTimeout(() => URL.revokeObjectURL(objUrl), 30000);
        onProgress({ bytes, total: total || bytes, percent: 100 });
        return { native: false, path: filename };
      }
    } catch {
      // Fallback to direct anchor if CORS/stream fails
    }
  }

  triggerBrowserDownload(dlUrl, filename);
  return { native: false, path: filename };
}
