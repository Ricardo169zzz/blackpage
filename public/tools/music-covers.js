/**
 * 10 Geometric Bauhaus Music Cover Marks (viewBox 0 0 256 256, pure geometry, zero <text>)
 * Used as deterministic fallback thumbnails across Music Hero, Queue, Mini-Banner, and Floating Circle.
 */

const COVER_SVGS = [
  // 1. Vinyl Eclipse (Red + Ink + Cream)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#FAF7F0"/><circle cx="128" cy="128" r="96" fill="#141414"/><circle cx="128" cy="128" r="70" fill="none" stroke="#FAF7F0" stroke-width="4" stroke-dasharray="18 12"/><circle cx="128" cy="128" r="38" fill="#D93829"/><circle cx="128" cy="128" r="12" fill="#FAF7F0"/></svg>`,

  // 2. Bauhaus Soundwave Pillars (Blue + Yellow + Ink)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#1D569E"/><rect x="34" y="104" width="28" height="48" fill="#FAF7F0"/><rect x="74" y="64" width="28" height="128" fill="#F2B705"/><rect x="114" y="38" width="28" height="180" fill="#141414"/><rect x="154" y="76" width="28" height="104" fill="#FAF7F0"/><rect x="194" y="96" width="28" height="64" fill="#D93829"/></svg>`,

  // 3. Geometric Play Prism (Red + Ink + Yellow)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#D93829"/><circle cx="128" cy="128" r="92" fill="#FAF7F0"/><polygon points="104,76 184,128 104,180" fill="#141414"/><circle cx="72" cy="72" r="18" fill="#F2B705"/></svg>`,

  // 4. Turntable Arm (Ink + Cream + Red)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#141414"/><circle cx="110" cy="136" r="80" fill="#FAF7F0"/><circle cx="110" cy="136" r="24" fill="#1D569E"/><circle cx="110" cy="136" r="8" fill="#FAF7F0"/><path d="M196 42 L196 116 L156 156" fill="none" stroke="#D93829" stroke-width="14" stroke-linecap="square"/><circle cx="196" cy="42" r="16" fill="#F2B705"/></svg>`,

  // 5. Split Cassette Geometry (Yellow + Ink + Blue)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#F2B705"/><rect x="28" y="60" width="200" height="136" fill="#141414"/><circle cx="84" cy="122" r="28" fill="#FAF7F0"/><circle cx="172" cy="122" r="28" fill="#FAF7F0"/><circle cx="84" cy="122" r="10" fill="#D93829"/><circle cx="172" cy="122" r="10" fill="#1D569E"/><polygon points="64,196 192,196 176,166 80,166" fill="#FAF7F0"/></svg>`,

  // 6. Concentric Pulse Rings (Cream + Blue + Red)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#FAF7F0"/><circle cx="128" cy="128" r="98" fill="none" stroke="#141414" stroke-width="14"/><circle cx="128" cy="128" r="66" fill="none" stroke="#1D569E" stroke-width="14"/><circle cx="128" cy="128" r="34" fill="#D93829"/></svg>`,

  // 7. Diagonal Rhythm Blocks (Ink + Red + Yellow + Cream)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#FAF7F0"/><polygon points="0,0 160,0 0,160" fill="#141414"/><polygon points="256,256 96,256 256,96" fill="#D93829"/><circle cx="128" cy="128" r="46" fill="#F2B705"/><circle cx="128" cy="128" r="16" fill="#141414"/></svg>`,

  // 8. Acoustic Note Monolith (Blue + Cream + Red)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#141414"/><rect x="132" y="42" width="24" height="128" fill="#FAF7F0"/><polygon points="132,42 204,64 204,96 132,74" fill="#D93829"/><circle cx="108" cy="172" r="42" fill="#F2B705"/><circle cx="108" cy="172" r="14" fill="#141414"/></svg>`,

  // 9. Bauhaus Grid Beat (Cream + Ink + Blue + Yellow)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#FAF7F0"/><rect x="28" y="28" width="92" height="92" fill="#141414"/><rect x="136" y="28" width="92" height="92" rx="46" fill="#D93829"/><rect x="28" y="136" width="92" height="92" rx="46" fill="#1D569E"/><rect x="136" y="136" width="92" height="92" fill="#F2B705"/></svg>`,

  // 10. Stereo Twin Discs (Red + Cream + Ink)
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="#1D569E"/><circle cx="96" cy="128" r="68" fill="#141414"/><circle cx="160" cy="128" r="68" fill="#FAF7F0"/><circle cx="160" cy="128" r="24" fill="#D93829"/><circle cx="96" cy="128" r="18" fill="#F2B705"/></svg>`,
];

function hashSeed(str) {
  let h = 2166136261;
  const s = String(str || "blackpage");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function getTrackFallbackCover(track) {
  const seed = track?.url || track?.filename || track?.title || track?.author || "bp";
  const idx = hashSeed(seed) % COVER_SVGS.length;
  return `data:image/svg+xml;utf8,${encodeURIComponent(COVER_SVGS[idx])}`;
}
