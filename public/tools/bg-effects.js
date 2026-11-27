/**
 * Lightweight 60fps Background Effects (Constellation Stars & Rain)
 * - Capped DPR <= 1.5 for zero-lag mobile WebView performance
 * - Single-path batched rain draw call
 * - Stops rAF completely when mode === "none" or document is hidden
 */

export function createBgEffects(canvas) {
  let mode = "none"; // "none" | "stars" | "rain"
  let brightness = 100; // 20..200
  let speed = 100; // 20..200
  let rafId = null;
  let w = 0;
  let h = 0;
  let dpr = 1;
  let stars = [];
  let drops = [];
  const ctx = canvas ? canvas.getContext("2d", { alpha: true }) : null;

  function isDark() {
    return document.documentElement.dataset.theme === "dark";
  }

  function resize() {
    if (!canvas || !ctx) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    w = Math.max(320, Math.round(rect?.width || window.innerWidth));
    h = Math.max(480, Math.round(rect?.height || window.innerHeight));
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initParticles() {
    if (mode === "stars") {
      const count = 28;
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 1.2 + Math.random() * 1.4,
        phase: Math.random() * Math.PI * 2,
      }));
    } else if (mode === "rain") {
      const count = 42;
      drops = Array.from({ length: count }, () => ({
        x: Math.random() * (w + 40) - 20,
        y: Math.random() * h,
        len: 10 + Math.random() * 12,
        speed: 4.5 + Math.random() * 3.5,
      }));
    }
  }

  function drawStars(now) {
    ctx.clearRect(0, 0, w, h);
    const dark = isDark();
    const bScale = Math.max(0.2, Math.min(2, brightness / 100));
    const sScale = Math.max(0.2, Math.min(2, speed / 100));
    const dotAlpha = Math.min(1, (dark ? 0.68 : 0.5) * bScale);
    const lineBase = Math.min(0.85, (dark ? 0.28 : 0.24) * bScale);
    const dotColor = dark ? `rgba(250, 247, 240, ${dotAlpha.toFixed(3)})` : `rgba(20, 20, 22, ${dotAlpha.toFixed(3)})`;
    const lineRgb = dark ? "250, 247, 240" : "29, 86, 158";
    const maxDist = 96;
    const maxDistSq = maxDist * maxDist;

    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      s.x += s.vx * sScale;
      s.y += s.vy * sScale;
      if (s.x < 0) s.x = w;
      else if (s.x > w) s.x = 0;
      if (s.y < 0) s.y = h;
      else if (s.y > h) s.y = 0;
    }

    ctx.lineWidth = bScale > 1.3 ? 1.25 : 0.9;
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      for (let j = i + 1; j < stars.length; j++) {
        const b = stars[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < maxDistSq) {
          const alpha = (1 - Math.sqrt(dSq) / maxDist) * lineBase;
          ctx.strokeStyle = `rgba(${lineRgb}, ${alpha.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    const t = now * 0.002 * sScale;
    const rBoost = bScale > 1.25 ? 1.18 : 1;
    ctx.fillStyle = dotColor;
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const r = s.r * rBoost * (0.85 + 0.2 * Math.sin(t + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRain() {
    ctx.clearRect(0, 0, w, h);
    const dark = isDark();
    const bScale = Math.max(0.2, Math.min(2, brightness / 100));
    const sScale = Math.max(0.2, Math.min(2, speed / 100));
    const rainAlpha = Math.min(0.95, (dark ? 0.26 : 0.28) * bScale);
    ctx.strokeStyle = dark ? `rgba(250, 247, 240, ${rainAlpha.toFixed(3)})` : `rgba(29, 86, 158, ${rainAlpha.toFixed(3)})`;
    ctx.lineWidth = bScale > 1.3 ? 1.55 : 1.15;
    ctx.beginPath();
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.22, d.y + d.len);
      d.x -= d.speed * sScale * 0.22;
      d.y += d.speed * sScale;
      if (d.y > h + 20) {
        d.y = -20;
        d.x = Math.random() * (w + 40);
      }
      if (d.x < -30) d.x = w + 10;
    }
    ctx.stroke();
  }

  function tick(now) {
    if (mode === "none" || document.visibilityState !== "visible") {
      rafId = null;
      return;
    }
    if (mode === "stars") drawStars(now);
    else if (mode === "rain") drawRain();
    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (!canvas || !ctx || mode === "none") return;
    canvas.hidden = false;
    resize();
    if ((mode === "stars" && !stars.length) || (mode === "rain" && !drops.length)) {
      initParticles();
    }
    if (!rafId && document.visibilityState === "visible") {
      rafId = requestAnimationFrame(tick);
    }
  }

  function stop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (ctx) ctx.clearRect(0, 0, w, h);
    if (canvas) canvas.hidden = true;
  }

  function setMode(nextMode) {
    const clean = nextMode === "stars" || nextMode === "rain" ? nextMode : "none";
    if (clean === mode && (clean === "none" || rafId)) return;
    mode = clean;
    stars = [];
    drops = [];
    if (mode === "none") {
      stop();
    } else {
      start();
    }
  }

  window.addEventListener("resize", () => {
    if (mode !== "none") resize();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && mode !== "none") {
      start();
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  });

  function setConfig(cfg = {}) {
    if (typeof cfg.brightness === "number" && Number.isFinite(cfg.brightness)) {
      brightness = Math.max(20, Math.min(200, cfg.brightness));
    }
    if (typeof cfg.speed === "number" && Number.isFinite(cfg.speed)) {
      speed = Math.max(20, Math.min(200, cfg.speed));
    }
  }

  return { setMode, setConfig, getMode: () => mode };
}
