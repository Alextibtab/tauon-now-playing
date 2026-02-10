/**
 * Tauon Music Player API response from /api1/status
 */
export interface TauonTrack {
  title: string;
  artist: string;
  album: string;
  album_artist: string;
  duration: number;
  id: number;
  position: number;
  path: string;
  album_id: number;
  has_lyrics: boolean;
  track_number: string;
  can_download: boolean;
}

export interface TauonStatus {
  status: "playing" | "paused" | "stopped";
  inc: number;
  shuffle: boolean;
  repeat: boolean;
  progress: number;
  auto_stop: boolean;
  volume: number;
  playlist: string;
  playlist_length: number;
  id: number;
  title: string;
  artist: string;
  album: string;
  track: TauonTrack;
  position: number;
  album_id: number;
}

/**
 * Color palette extracted from album art
 */
export interface ColorPalette {
  dominant: string; // Hex color
  accent: string; // Hex color for equalizer/border
  highlight: string; // Bright highlight color
}

/**
 * Data stored in Deno KV and passed between poller and server
 */
export interface NowPlayingData {
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  trackNumber: string;
  duration: number;
  progress: number;
  status: "playing" | "paused" | "stopped";
  artBase64: string | null;
  colors: ColorPalette | null;
  updatedAt: number;
}

/**
 * SVG card configuration
 */
export interface SvgConfig {
  width: number;
  height: number;
  cardBackground: string;
  cardBorder: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  albumSize: number;
  borderRadius: number;
}

export const defaultSvgConfig: SvgConfig = {
  width: 480,
  height: 120,
  cardBackground: "#18181b",
  cardBorder: "#27272a",
  textPrimary: "#fafafa",
  textSecondary: "#a1a1aa",
  textMuted: "#71717a",
  albumSize: 90,
  borderRadius: 8,
};
