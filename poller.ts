import { ColorPalette, NowPlayingData, TauonStatus } from "./types.ts";
import sharp from "sharp";

// Configuration from environment
const TAUON_URL = Deno.env.get("TAUON_URL") || "http://localhost:7814";
const DEPLOY_URL = Deno.env.get("DEPLOY_URL");
const API_KEY = Deno.env.get("API_KEY");
const POLL_INTERVAL_MS = parseInt(Deno.env.get("POLL_INTERVAL_MS") || "10000");
const ART_TARGET_SIZE = 400; // Resized album art dimension (keeps it under 64KB when base64'd)

// State to track last sent/seen data to avoid unnecessary updates
let lastSentTrackId: number | null = null;
let lastSentStatus: string | null = null;
let lastSeenStatus: string | null = null;
let lastAlbumName: string | null = null;
let lastArtBase64: string | null = null;
let lastColors: ColorPalette | null = null;

if (!DEPLOY_URL) {
  console.error("DEPLOY_URL environment variable is required");
  Deno.exit(1);
}

if (!API_KEY) {
  console.error("API_KEY environment variable is required");
  Deno.exit(1);
}

/**
 * Fetch current status from Tauon
 */
async function fetchTauonStatus(): Promise<TauonStatus | null> {
  try {
    const response = await fetch(`${TAUON_URL}/api1/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      console.warn(`Tauon status fetch failed: ${response.status}`);
      return null;
    }
    return await response.json() as TauonStatus;
  } catch (error) {
    console.warn("Failed to fetch Tauon status:", error);
    return null;
  }
}

interface ArtResult {
  base64: string;
  colors: ColorPalette;
}

/**
 * Extract dominant color from image using sharp stats
 */
function extractDominantColor(stats: sharp.Stats): string {
  // Use the most dominant channel average as a simple approach
  const r = Math.round(stats.channels[0].mean);
  const g = Math.round(stats.channels[1].mean);
  const b = Math.round(stats.channels[2].mean);
  return `#${r.toString(16).padStart(2, "0")}${
    g.toString(16).padStart(2, "0")
  }${b.toString(16).padStart(2, "0")}`;
}

/**
 * Calculate a complementary/accent color
 */
function calculateAccentColor(hexColor: string): string {
  // Convert hex to RGB
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);

  // Calculate complementary color with some adjustments for vibrancy
  const accentR = Math.min(255, Math.round(r * 1.2));
  const accentG = Math.min(255, Math.round(g * 1.2));
  const accentB = Math.min(255, Math.round(b * 1.2));

  return `#${accentR.toString(16).padStart(2, "0")}${
    accentG.toString(16).padStart(2, "0")
  }${accentB.toString(16).padStart(2, "0")}`;
}

function rgbToHsl(r: number, g: number, b: number): {
  h: number;
  s: number;
  l: number;
} {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const delta = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rNorm:
        h = ((gNorm - bNorm) / delta) % 6;
        break;
      case gNorm:
        h = (bNorm - rNorm) / delta + 2;
        break;
      case bNorm:
        h = (rNorm - gNorm) / delta + 4;
        break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s, l };
}

function extractHighlightFromRaw(
  raw: Uint8Array,
  width: number,
  height: number,
  dominantHex: string,
): string | null {
  const dominantR = parseInt(dominantHex.slice(1, 3), 16);
  const dominantG = parseInt(dominantHex.slice(3, 5), 16);
  const dominantB = parseInt(dominantHex.slice(5, 7), 16);
  let bestScore = 0;
  let best: { r: number; g: number; b: number } | null = null;

  for (let i = 0; i < width * height; i++) {
    const idx = i * 3;
    const r = raw[idx];
    const g = raw[idx + 1];
    const b = raw[idx + 2];
    if (r > 235 && g > 235 && b > 235) continue;
    if (r < 20 && g < 20 && b < 20) continue;
    const { s, l } = rgbToHsl(r, g, b);
    if (s < 0.35 || l < 0.18 || l > 0.85) continue;
    const dist = Math.sqrt(
      (r - dominantR) ** 2 +
        (g - dominantG) ** 2 +
        (b - dominantB) ** 2,
    ) / (Math.sqrt(3) * 255);
    const score = s * 0.7 + dist * 0.2 + (1 - Math.abs(l - 0.55)) * 0.1;
    if (score > bestScore) {
      bestScore = score;
      best = { r, g, b };
    }
  }

  if (!best) return null;
  const toHex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${toHex(best.r)}${toHex(best.g)}${toHex(best.b)}`;
}

function extractHighlightColor(stats: sharp.Stats): string {
  const r = Math.round(stats.channels[0].max);
  const g = Math.round(stats.channels[1].max);
  const b = Math.round(stats.channels[2].max);
  const toHex = (value: number): string => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function blendWithWhite(hexColor: string, ratio: number): string {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  const blend = (value: number): number =>
    Math.min(255, Math.round(value + (255 - value) * ratio));
  return `#${blend(r).toString(16).padStart(2, "0")}${
    blend(g).toString(16)
      .padStart(2, "0")
  }${blend(b).toString(16).padStart(2, "0")}`;
}

/**
 * Fetch and resize album art from Tauon
 */
async function fetchAndResizeArt(trackId: number): Promise<ArtResult | null> {
  try {
    const response = await fetch(
      `${TAUON_URL}/api1/pic/medium/${trackId}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) {
      console.warn(`Album art fetch failed: ${response.status}`);
      return null;
    }

    const imageBuffer = new Uint8Array(await response.arrayBuffer());

    // Process with sharp - resize and get stats
    const sharpInstance = sharp(imageBuffer)
      .resize(ART_TARGET_SIZE, ART_TARGET_SIZE, {
        fit: "cover",
        position: "center",
      })
      .jpeg({ quality: 85, progressive: true });

    const [resizedBuffer, stats, tinyRaw] = await Promise.all([
      sharpInstance.toBuffer(),
      sharpInstance.clone().stats(),
      sharpInstance.clone().resize(24, 24, { fit: "cover" }).raw().toBuffer({
        resolveWithObject: true,
      }),
    ]);

    // Extract colors
    const dominant = extractDominantColor(stats);
    const accent = calculateAccentColor(dominant);
    const highlightCandidate = extractHighlightFromRaw(
      tinyRaw.data,
      tinyRaw.info.width,
      tinyRaw.info.height,
      dominant,
    );
    const fallbackHighlight = extractHighlightColor(stats);
    const highlight = blendWithWhite(
      highlightCandidate || fallbackHighlight,
      0.10,
    );

    // Convert to base64
    const base64 = btoa(String.fromCharCode(...new Uint8Array(resizedBuffer)));

    return {
      base64,
      colors: { dominant, accent, highlight },
    };
  } catch (error) {
    console.warn("Failed to fetch/resize album art:", error);
    return null;
  }
}

/**
 * Send now playing data to Deploy API
 */
async function sendToDeploy(data: NowPlayingData): Promise<boolean> {
  try {
    const response = await fetch(`${DEPLOY_URL}/api/now-playing`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.warn(`Deploy API error: ${response.status}`);
      return false;
    }

    return true;
  } catch (error) {
    console.warn("Failed to send to Deploy API:", error);
    return false;
  }
}

/**
 * Check if we should send an update (track change or play/pause change)
 */
function shouldUpdate(status: TauonStatus): boolean {
  const trackId = status.id;
  const statusStr = status.status;
  const isPlayableStatus = statusStr === "playing" || statusStr === "paused";

  if (!isPlayableStatus) {
    return false;
  }

  // Always update on track change
  if (trackId !== lastSentTrackId) {
    return true;
  }

  // Update on status change (play/pause)
  if (statusStr !== lastSentStatus) {
    return true;
  }

  // Update when transitioning from stopped to active playback
  if (lastSeenStatus === "stopped") {
    return true;
  }

  return false;
}

/**
 * Main polling loop
 */
async function poll(): Promise<void> {
  const status = await fetchTauonStatus();

  if (!status) {
    // Tauon is unreachable - don't update, keep last known state
    console.log("Tauon unreachable, skipping update");
    return;
  }

  // Check if we need to send an update
  if (!shouldUpdate(status)) {
    lastSeenStatus = status.status;
    return;
  }

  let artBase64: string | null = null;
  let colors: ColorPalette | null = null;
  const albumName = (status.track?.album || status.album || '').trim();
  const isPlayableStatus = status.status === "playing" ||
    status.status === "paused";
  const hasCachedArt = albumName.length > 0 && albumName === lastAlbumName &&
    lastArtBase64 && lastColors;

  // Fetch art when the album changes or cache is empty
  if (isPlayableStatus && status.id > 0 && albumName.length > 0) {
    if (!hasCachedArt) {
      const artResult = await fetchAndResizeArt(status.id);
      if (artResult) {
        artBase64 = artResult.base64;
        colors = artResult.colors;
        lastAlbumName = albumName;
        lastArtBase64 = artBase64;
        lastColors = colors;
      }
    } else {
      artBase64 = lastArtBase64;
      colors = lastColors;
    }
  }

  const nowPlayingData: NowPlayingData = {
    title: status.title || status.track?.title || "Unknown Title",
    artist: status.artist || status.track?.artist || "Unknown Artist",
    album: status.album || status.track?.album || "Unknown Album",
    albumArtist: status.track?.album_artist || status.artist ||
      "Unknown Artist",
    trackNumber: status.track?.track_number || "",
    duration: status.track?.duration || 0,
    progress: status.progress,
    status: status.status,
    artBase64,
    colors,
    updatedAt: Date.now(),
  };

  const success = await sendToDeploy(nowPlayingData);

  if (success) {
    lastSentTrackId = status.id;
    lastSentStatus = status.status;
    lastSeenStatus = status.status;
    console.log(`Updated: ${nowPlayingData.title} by ${nowPlayingData.artist}`);
  }
}

/**
 * Main function
 */
async function main(): Promise<void> {
  console.log(`Tauon Now Playing Poller`);
  console.log(`  Tauon URL: ${TAUON_URL}`);
  console.log(`  Deploy URL: ${DEPLOY_URL}`);
  console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);

  // Initial poll
  await poll();

  // Schedule polling
  setInterval(poll, POLL_INTERVAL_MS);

  // Keep the process running
  console.log("Poller running. Press Ctrl+C to stop.");
}

if (import.meta.main) {
  await main();
}
