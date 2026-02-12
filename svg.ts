import { defaultSvgConfig, NowPlayingData, SvgConfig } from "./types.ts";

/**
 * Escape special characters for XML/SVG
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Truncate text to fit within max length
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * (fontSize * 0.55);
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${
    g
      .toString(16)
      .padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`;
}

function mixColors(hexA: string, hexB: string, ratio: number): string {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const clamp = (value: number): number => Math.max(0, Math.min(255, value));
  const r = clamp(Math.round(a.r * (1 - ratio) + b.r * ratio));
  const g = clamp(Math.round(a.g * (1 - ratio) + b.g * ratio));
  const bVal = clamp(Math.round(a.b * (1 - ratio) + b.b * ratio));
  return rgbToHex(r, g, bVal);
}

function seededRandom(index: number, seed: number): number {
  const value = Math.sin(index * 12.9898 + seed) * 43758.5453;
  return value - Math.floor(value);
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * Generate animated equalizer bars with custom color
 */
function generateWavePath(
  startX: number,
  endX: number,
  baseY: number,
  height: number,
  points: number,
  seed: number,
): string {
  const step = (endX - startX) / (points - 1);
  const values = Array.from({ length: points }, (_, i) => {
    const rand = seededRandom(i, seed) * 0.75 +
      seededRandom(i + 7, seed) * 0.25;
    return {
      x: startX + i * step,
      y: baseY - rand * height,
    };
  });

  let path = `M ${values[0].x} ${values[0].y}`;
  for (let i = 1; i < values.length - 1; i++) {
    const prev = values[i - 1];
    const current = values[i];
    const midX = (prev.x + current.x) / 2;
    const midY = (prev.y + current.y) / 2;
    path += ` Q ${prev.x} ${prev.y} ${midX} ${midY}`;
  }
  const last = values[values.length - 1];
  const secondLast = values[values.length - 2];
  path += ` Q ${secondLast.x} ${secondLast.y} ${last.x} ${last.y}`;
  path += ` L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  return path;
}

function generateWaveformLayer(
  color: string,
  opacity: number,
  startX: number,
  endX: number,
  baseY: number,
  height: number,
  seed: number,
  duration: number,
): string {
  const pathA = generateWavePath(startX, endX, baseY, height, 28, seed);
  const pathB = generateWavePath(startX, endX, baseY, height, 28, seed + 2.5);
  return `<path d="${pathA}" fill="${color}" opacity="${opacity}">
    <animate attributeName="d" values="${pathA};${pathB};${pathA}" dur="${duration}s" repeatCount="indefinite" />
  </path>`;
}

/**
 * Generate a simple music note icon SVG
 */
function generateMusicNotePlaceholder(
  albumX: number,
  albumY: number,
  albumSize: number,
  color: string,
): string {
  const scale = albumSize / 100;
  const centerX = albumX + albumSize / 2;
  const centerY = albumY + albumSize / 2;
  const noteX = centerX - 25 * scale;
  const noteY = centerY - 30 * scale;

  return `<g transform="translate(${noteX}, ${noteY}) scale(${scale})" opacity="0.8">
    <!-- Music note (beamed eighth notes) -->
    <path d="M20 60 L20 15 L50 5 L50 50 C50 56 45 60 38 60 C30 60 25 56 25 50 C25 43 30 40 38 40 C42 40 45 41 47 43 L47 20 L23 28 L23 60 C23 66 18 70 10 70 C3 70 0 66 0 60 C0 53 5 50 10 50 C14 50 17 51 20 53 Z" fill="${color}"/>
  </g>`;
}

function generateTauonBadge(x: number, y: number, size: number): string {
  const center = size / 2;
  const scale = 0.68;
  const offset = 14 * scale;
  return `<g transform="translate(${x}, ${y})">
    <circle cx="${center}" cy="${center}" r="${center}" fill="#111111" opacity="0.9" />
    <g transform="translate(${center - offset}, ${
    center - offset
  }) scale(${scale})">
      <ellipse cx="14.55" cy="14.551" rx="14.549" ry="14.551" fill="url(#tauonGradient)" />
      <path d="M 29.098999,-14.551 A 14.549,14.551 0 0 1 14.549999,0 v -14.551 z" transform="scale(1,-1)" fill="#ffffff" fill-opacity="0.156" />
      <path d="M -0.001,14.551 A 14.549,14.551 0 0 1 -14.549999,29.101999 V 14.551 Z" transform="scale(-1,1)" fill="#ffffff" fill-opacity="0.156" />
      <ellipse cx="14.55" cy="14.551" rx="5.047" ry="5.048" fill="#313131" />
      <circle cx="14.55" cy="14.551" r="0.848" fill="#ffffff" />
    </g>
  </g>`;
}

/**
 * Generate the SVG card for now playing widget
 */
export function generateNowPlayingSvg(
  data: NowPlayingData | null,
  config: SvgConfig = defaultSvgConfig,
): string {
  const isStale = data ? Date.now() - data.updatedAt > 5 * 60 * 1000 : true;
  const isPlaying = data && data.status === "playing" && !isStale;
  const isPaused = data && data.status === "paused" && !isStale;
  const hasTrack = data && (isPlaying || isPaused || isStale);

  // Use extracted colors or fall back to defaults
  const dominantColor = data?.colors?.dominant || config.cardBorder;
  const accentColor = data?.colors?.accent || "#22c55e";
  const baseDark = mixColors(dominantColor, "#050505", 0.82);
  const midDark = mixColors(dominantColor, "#0d0f12", 0.7);
  const highlight = data?.colors?.highlight ||
    mixColors(accentColor, "#ffffff", 0.45);

  const width = config.width;
  const height = config.height;
  const albumSize = config.albumSize;
  const padding = 26;
  const albumX = padding;
  const albumY = (height - albumSize) / 2;
  const textX = albumX + albumSize + 22;
  const barsStartX = 2;
  const barsEndX = width - 2;
  const waveBaseY = height - 2;
  const waveHeight = 170;
  const titleFontSize = 20;
  const titleClipWidth = Math.max(220, barsStartX - textX - 40);
  const titleText = data?.title || "";
  const titleSeed = hashString(titleText || "tauon");
  const titleTextWidth = estimateTextWidth(titleText, titleFontSize);
  const titleGap = 36;
  const titleScrollDistance = Math.max(
    titleTextWidth + titleGap,
    titleClipWidth + titleGap,
  );
  const titleScrollNeeded = estimateTextWidth(titleText, titleFontSize) >
    titleClipWidth;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <linearGradient id="cardGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${baseDark}" />
      <stop offset="60%" stop-color="${midDark}" />
      <stop offset="100%" stop-color="${baseDark}" />
    </linearGradient>
    <linearGradient id="barsFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${highlight}" stop-opacity="1" />
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0.3" />
    </linearGradient>
    <linearGradient id="tauonGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ef2acf" />
      <stop offset="100%" stop-color="#8476f1" />
    </linearGradient>
    <clipPath id="albumClip">
      <rect x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" rx="${config.borderRadius}" />
    </clipPath>
    <clipPath id="cardClip" clipPathUnits="userSpaceOnUse">
      <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${
    config.borderRadius - 2
  }" />
    </clipPath>
    <clipPath id="titleClip" clipPathUnits="userSpaceOnUse">
      <rect x="${textX}" y="${
    albumY + 34
  }" width="${titleClipWidth}" height="26" />
    </clipPath>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="8" flood-color="${highlight}" flood-opacity="0.65" />
      <feDropShadow dx="0" dy="0" stdDeviation="16" flood-color="${highlight}" flood-opacity="0.25" />
    </filter>
    <filter id="textGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="4" flood-color="${highlight}" flood-opacity="0.6" />
    </filter>
  </defs>

  <!-- Card background with clean rounded border -->
  <rect width="${width}" height="${height}" rx="${config.borderRadius}" fill="${midDark}" />
  <rect x="2" y="2" width="${width - 4}" height="${height - 4}" rx="${
    config.borderRadius - 2
  }" fill="url(#cardGradient)" />

  <!-- Background waveform -->
  <g fill="url(#barsFade)" opacity="0.4" clip-path="url(#cardClip)">
    ${
    generateWaveformLayer(
      highlight,
      0.28,
      barsStartX,
      barsEndX,
      waveBaseY,
      waveHeight,
      titleSeed * 0.03,
      8,
    )
  }
    ${
    generateWaveformLayer(
      highlight,
      0.18,
      barsStartX,
      barsEndX,
      waveBaseY,
      waveHeight * 0.7,
      titleSeed * 0.05 + 4.1,
      12,
    )
  }
  </g>

  ${
    isPlaying
      ? `<g fill="url(#barsFade)" opacity="0.45" clip-path="url(#cardClip)">${
        generateWaveformLayer(
          highlight,
          0.65,
          barsStartX,
          barsEndX,
          waveBaseY,
          waveHeight * 0.85,
          titleSeed * 0.08 + 8.2,
          5,
        )
      }</g>`
      : ""
  }

  <!-- Text content -->
  <g font-family="'Space Grotesk','Manrope','Sora','Segoe UI',sans-serif">
    ${
    hasTrack
      ? `
    <!-- Status pill -->
    <text x="${textX}" y="${
        albumY + 18
      }" fill="${highlight}" font-size="12" font-weight="700" letter-spacing="0.18em" filter="url(#textGlow)">
      ${isStale ? "LAST PLAYED" : isPlaying ? "NOW PLAYING" : "PAUSED"}
    </text>

    <!-- Title -->
    ${
        titleScrollNeeded
          ? `
    <g clip-path="url(#titleClip)">
      <g>
        <text x="${textX}" y="${
            albumY + 56
          }" fill="${config.textPrimary}" font-size="${titleFontSize}" font-weight="600" filter="url(#textGlow)">
          ${escapeXml(data.title)}
        </text>
        <text x="${textX + titleScrollDistance}" y="${
            albumY + 56
          }" fill="${config.textPrimary}" font-size="${titleFontSize}" font-weight="600" filter="url(#textGlow)">
          ${escapeXml(data.title)}
        </text>
        <animateTransform attributeName="transform" type="translate" from="0 0" to="-${titleScrollDistance} 0" dur="15s" repeatCount="indefinite" />
      </g>
    </g>
    `
          : `
    <text x="${textX}" y="${
            albumY + 56
          }" fill="${config.textPrimary}" font-size="${titleFontSize}" font-weight="600" text-overflow="ellipsis" filter="url(#textGlow)">
      ${escapeXml(truncateText(data.title, 35))}
    </text>
    `
      }

    <!-- Artist -->
    <text x="${textX}" y="${
        albumY + 92
      }" fill="${config.textSecondary}" font-size="16">
      ${escapeXml(truncateText(data.artist, 40))}
    </text>

    <!-- Album and status -->
    <text x="${textX}" y="${
        albumY + 126
      }" fill="${config.textMuted}" font-size="14">
      ${escapeXml(truncateText(data.album, 40))}
    </text>
    `
      : `
    <!-- Not playing message -->
    <text x="${textX}" y="${
        height / 2
      }" fill="${config.textMuted}" font-size="14" dominant-baseline="middle">
      Nothing playing right now
    </text>
    `
  }
  </g>

  ${
    hasTrack && data.artBase64
      ? `
  <!-- Album art with rounded corners -->
  <image x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" xlink:href="data:image/jpeg;base64,${data.artBase64}" clip-path="url(#albumClip)" preserveAspectRatio="xMidYMid slice" filter="url(#glow)" />
  <rect x="${albumX}" y="${albumY}" width="${albumSize}" height="${albumSize}" rx="${config.borderRadius}" fill="none" stroke="${highlight}" stroke-opacity="0.45" stroke-width="2" filter="url(#textGlow)" />
  ${generateTauonBadge(
    albumX + albumSize - config.borderRadius - 11,
    albumY + albumSize - config.borderRadius - 11,
    22,
  )}
  `
      : generateMusicNotePlaceholder(
        albumX,
        albumY,
        albumSize,
        highlight,
      )
  }
</svg>`;

  return svg;
}
