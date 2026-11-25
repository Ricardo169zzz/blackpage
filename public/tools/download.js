export function makeProxyUrl(API_BASE, remoteUrl, { download = false, filename = "" } = {}) {
  const params = new URLSearchParams({ url: remoteUrl });
  if (download) params.set("download", "1");
  if (filename) params.set("filename", filename);
  return `${API_BASE}/api/media?${params.toString()}`;
}

export async function downloadMediaFile({ API_BASE, remoteUrl, mediaType, filename }) {
  const cap = window.Capacitor;
  const fs = cap?.Plugins?.Filesystem;

  if (cap?.isNativePlatform?.() && fs) {
    if (!API_BASE) {
      throw new Error("API Base URL belum diisi. Buka Setting -> Lanjutan lalu isi URL server.");
    }

    const subDir = mediaType === "audio" ? "audio" : mediaType === "image" ? "image" : "video";
    const targetPath = `Download/Blackpage/${subDir}/${filename}`;
    const sourceUrl = makeProxyUrl(API_BASE, remoteUrl, { download: true, filename });

    try {
      await fs.requestPermissions?.();
    } catch {
      // Android 13+ may not require legacy storage permission for Download/
    }

    if (typeof fs.downloadFile === "function") {
      await fs.downloadFile({
        url: sourceUrl,
        path: targetPath,
        directory: "EXTERNAL_STORAGE",
        recursive: true,
      });
      return { native: true, path: targetPath };
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
    return { native: true, path: targetPath };
  }

  // Web: trigger standard browser download so user chooses save folder
  const dlUrl = makeProxyUrl(API_BASE, remoteUrl, { download: true, filename });
  const a = document.createElement("a");
  a.href = dlUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { native: false, path: filename };
}
