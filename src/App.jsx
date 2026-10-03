import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import { useAuth } from "./hooks/useAuth";
import {
  initiateSpotifyAuth,
  clearSpotifyAuthState,
  getValidSpotifyToken,
  getSpotifyPlaylists,
  getSpotifyPlaylistById,
  getSpotifyPlaylistTracks,
  getSpotifyUserProfile,
  createSpotifyPlaylist,
  addTracksToSpotifyPlaylist,
  searchSpotifyTrack,
} from "./lib/spotify";
import {
  initiateYouTubeAuth,
  getValidYouTubeToken,
  getYouTubePlaylists,
  getYouTubePlaylistById,
  getYouTubePlaylistTracks,
  createYouTubePlaylist,
  addTracksToYouTubePlaylist,
  searchYouTubeTrack,
} from "./lib/youtube";
import {
  initiateTidalAuth,
  getValidTidalToken,
  getTidalPlaylists,
  getTidalPlaylistTracks,
  createTidalPlaylist,
  addTracksToTidalPlaylist,
  searchTidalTrack,
  clearTidalAuthState,
} from "./lib/tidal";
import {
  initiateDeezerAuth,
  getValidDeezerToken,
  getDeezerPlaylists,
  getDeezerPublicPlaylist,
  getDeezerPlaylistTracks,
  createDeezerPlaylist,
  addTracksToDeezerPlaylist,
  searchDeezerTrack,
} from "./lib/deezer";
import { parsePublicPlaylistUrl } from "./lib/publicPlaylist";
import { findDuplicates } from "./lib/matching";
import { parsePlaylistFile } from "./lib/import-export";
import { useTransferHistory } from "./hooks/useTransferHistory";
import { RateLimitError } from "./lib/rateLimit";
import { getYouTubeSearchBudget } from "./lib/youtubeQuota";
import { checkpointSignature, clearCheckpoint, loadCheckpoint, saveCheckpoint } from "./lib/transferCheckpoint";
/* ─────────────────────────────────────────────
   CONSTANTS & CONFIG
   ───────────────────────────────────────────── */

const PLATFORMS = {
  spotify: {
    name: "Spotify",
    color: "#1DB954",
    authUrl: "https://accounts.spotify.com/authorize",
    scopes: "playlist-read-private playlist-read-collaborative",
    apiBase: "https://api.spotify.com/v1",
  },
  apple: {
    name: "Apple Music",
    color: "#FC3C44",
    authUrl: "https://authorize.music.apple.com",
    scopes: "music.library.read music.library.modify",
    apiBase: "https://api.music.apple.com/v1",
  },
  youtube: {
    name: "YouTube Music",
    color: "#FF0000",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    scopes: "https://www.googleapis.com/auth/youtube",
    apiBase: "https://www.googleapis.com/youtube/v3",
  },
  tidal: { name: "Tidal", color: "#00FFFF" },
  deezer: { name: "Deezer", color: "#A238FF" },
};

/** Open-in-new-tab URLs for viewing playlists on each destination. */
const DEST_VIEW_URLS = {
  spotify: "https://open.spotify.com/collection/playlists",
  youtube: "https://music.youtube.com",
  tidal: "https://tidal.com/browse/my-library/playlists",
  deezer: "https://www.deezer.com/en/profile/playlists",
  apple: "https://music.apple.com",
};

const ICONS = {
  spotify: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M23.997 6.124a9.23 9.23 0 00-.24-2.19C23.44 2.624 22.695 1.624 21.577.891A5.022 5.022 0 0019.702.175 10.65 10.65 0 0017.867.072C17.101.028 16.335.009 15.57 0H8.43c-.766.009-1.53.028-2.296.072A10.65 10.65 0 004.3.175 5.022 5.022 0 002.425.891C1.307 1.624.562 2.624.245 3.934a9.23 9.23 0 00-.24 2.19C-.008 6.89-.026 7.656 0 8.423v7.154c-.026.766-.008 1.533.005 2.299.026.753.102 1.49.24 2.19.317 1.31 1.062 2.31 2.18 3.043a5.022 5.022 0 001.875.716c.617.084 1.236.118 1.835.103.766.044 1.53.063 2.296.072h7.14c.766-.009 1.53-.028 2.296-.072a10.65 10.65 0 001.836-.103 5.022 5.022 0 001.874-.716c1.118-.733 1.863-1.733 2.18-3.043.139-.7.214-1.437.241-2.19.013-.766.031-1.533.005-2.299V8.423c.026-.767.008-1.534-.005-2.3zM17.994 12l-6 3.464a.75.75 0 01-1.125-.65v-6.928a.75.75 0 011.125-.65l6 3.464a.75.75 0 010 1.3z"/>
    </svg>
  ),
  youtube: (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z" fill="#FF0000"/>
      <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#fff"/>
    </svg>
  ),
  tidal: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <path d="M12 0L8 4l4 4-4 4-4-4 4-4L4 0 0 4l4 4-4 4 4 4 4-4 4 4 4-4-4-4 4-4 4 4 4-4-4-4 4-4-4-4-4 4z" />
    </svg>
  ),
  deezer: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
      <rect x="0" y="18" width="4" height="3" rx="0.5" />
      <rect x="5" y="15" width="4" height="6" rx="0.5" />
      <rect x="10" y="12" width="4" height="9" rx="0.5" />
      <rect x="15" y="9" width="4" height="12" rx="0.5" />
      <rect x="20" y="6" width="4" height="15" rx="0.5" />
    </svg>
  ),
};

// ── Format helpers ──────────────────────────────
function fmtDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(d) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(d);
}

/* ─────────────────────────────────────────────
   STYLES (CSS-in-JS theme object)
   ───────────────────────────────────────────── */
const T = {
  bg: "#f4efe6",
  paper: "#fffdf8",
  surface: "#fffdf8",
  surfaceHover: "#f7f1e8",
  border: "#e6dccf",
  borderLight: "#d9cec0",
  text: "#2c2824",
  textMuted: "#6f675e",
  textDim: "#8a8176",
  radius: 16,
  radiusSm: 12,
  font: "'Nunito Sans', sans-serif",
  display: "'Fraunces', serif",
  mono: "'Nunito Sans', sans-serif",
  accent: "#3e6b5e",
  ok: "#3e6b5e",
  warn: "#8a6840",
  bad: "#8d534c",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Nunito+Sans:wght@400;500;600;700&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; color: ${T.text}; }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #d9cec0; border-radius: 99px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  .fade-up { animation: fadeUp 0.35s ease both; }
  .btn-hover:hover:not(:disabled) { filter: brightness(1.05); }
  .card-hover:hover { border-color: #cfc3b4 !important; background: #fffdf8 !important; }
  .track-row:hover { background: #f7f1e8 !important; }
  .step-title { font-family: ${T.display}; font-weight: 560; letter-spacing: -0.02em; font-size: 28px; line-height: 1.2; color: ${T.text}; }
  input, button { font-family: ${T.font}; }
  input:focus { outline: 2px solid rgba(62, 107, 94, 0.35); outline-offset: 1px; }

  @media (max-width: 640px) {
    .platform-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .nav-buttons { flex-direction: column-reverse; }
    .nav-buttons button { width: 100%; }
    .track-header-row { display: none !important; }
    .track-detail-row { grid-template-columns: auto 1fr auto !important; }
    .track-detail-row .col-album, .track-detail-row .col-dur { display: none; }
    .history-card { flex-direction: column !important; align-items: flex-start !important; }
    .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .header-row { flex-direction: column; align-items: flex-start !important; gap: 14px !important; }
    .step-title { font-size: 24px; }
  }
`;

// Don't show technical error text to users; show a friendly message instead
function isDeveloperOnlyError(msg) {
  if (!msg || typeof msg !== "string") return false;
  const s = msg.toLowerCase();
  return /\.env|api key|client id|client_secret|credentials|configured|developer|oauth consent|cloud console|redirect uri|scope/i.test(s);
}

/* ─────────────────────────────────────────────
   COMPONENTS
   ───────────────────────────────────────────── */

function Chip({ children, active, color, onClick, style = {} }) {
  return (
    <button
      onClick={onClick}
      className="btn-hover"
      style={{
        background: active ? T.surfaceHover : T.paper,
        border: `1.5px solid ${active ? color : T.border}`,
        borderRadius: 999,
        padding: "7px 14px",
        color: active ? T.text : T.textMuted,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: T.font,
        cursor: "pointer",
        transition: "all 0.2s ease",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

function Badge({ children, color }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 8px",
        borderRadius: 999,
        background: `${color}14`,
        color: color,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: T.font,
        letterSpacing: "0.01em",
      }}
    >
      {children}
    </span>
  );
}

function PlatformCard({ id, selected, onClick, disabled, connected, onDisconnect }) {
  const p = PLATFORMS[id];
  const canDisconnect = connected && ["spotify", "youtube", "tidal", "deezer"].includes(id);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onClick(id)}
      onKeyDown={(e) => { if (!disabled && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(id); } }}
      className={`card-hover ${selected ? "" : ""}`}
      style={{
        background: T.paper,
        border: `1.5px solid ${selected ? T.accent : T.border}`,
        boxShadow: selected ? "0 8px 24px rgba(62, 107, 94, 0.08)" : "0 1px 0 rgba(44, 40, 36, 0.03)",
        borderRadius: T.radius,
        padding: "18px 12px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.25 : 1,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        color: selected ? p.color : T.textMuted,
        position: "relative",
        overflow: "hidden",
        width: "100%",
      }}
    >
      <div style={{ width: 28, height: 3, borderRadius: 99, background: p.color, position: "relative", zIndex: 1 }} />
      <div style={{ position: "relative", zIndex: 1, color: selected ? T.text : T.textMuted }}>{ICONS[id]}</div>
      <span style={{ fontFamily: T.font, fontWeight: 700, fontSize: 13, letterSpacing: "0.01em", position: "relative", zIndex: 1, color: T.text }}>{p.name}</span>
      {connected ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
          <Badge color={T.ok}>Connected</Badge>
          {canDisconnect && onDisconnect && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDisconnect(id); }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 10,
                fontWeight: 600,
                fontFamily: T.font,
                color: T.textDim,
                cursor: "pointer",
                textDecoration: "underline",
                transition: "color 0.2s",
              }}
              onMouseOver={(e) => { e.currentTarget.style.color = T.bad; }}
              onMouseOut={(e) => { e.currentTarget.style.color = T.textDim; }}
              title="Remove authorization; you’ll need to sign in again to use this platform"
            >
              Disconnect
            </button>
          )}
        </div>
      ) : (id === "spotify" || id === "youtube" || id === "tidal" || id === "deezer" || id === "apple") ? (
        <span style={{ fontSize: 10, color: T.textDim, fontWeight: 500 }}>Sign in</span>
      ) : null}
      {selected && (
        <div style={{ position: "absolute", top: 8, right: 8, width: 18, height: 18, borderRadius: "50%", background: T.accent, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
      )}
    </div>
  );
}

function TrackRow({ track, matchResult, index, accentColor, showMatch }) {
  const conf = matchResult?.confidence ?? 0;
  const confColor = conf >= 0.85 ? T.ok : conf >= 0.6 ? T.warn : T.bad;
  const confLabel = conf >= 0.85 ? "Found" : conf >= 0.6 ? "Close" : "Not found";
  return (
    <div
      className="track-row track-detail-row"
      style={{
        display: "grid",
        gridTemplateColumns: "32px 1.4fr 1fr 60px 90px",
        gap: 8,
        alignItems: "center",
        padding: "10px 14px",
        borderRadius: T.radiusSm,
        transition: "background 0.15s ease",
        animation: "none",
      }}
    >
      <span style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textAlign: "right" }}>{index + 1}</span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.title}</div>
        <div style={{ fontSize: 11, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.artist}</div>
      </div>
      <div className="col-album" style={{ fontSize: 12, color: T.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{track.album}</div>
      <div className="col-dur" style={{ fontFamily: T.mono, fontSize: 11, color: T.textDim, textAlign: "right" }}>{track.duration != null ? fmtDuration(track.duration) : "—"}</div>
      {showMatch && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Badge color={confColor}>{confLabel} {conf > 0 ? `${Math.round(conf * 100)}%` : ""}</Badge>
        </div>
      )}
    </div>
  );
}

function ExpandedTrackList({ pl, accentColor, source, getToken, setPlaylists }) {
  const [loading, setLoading] = useState(false);
  const tracks = pl.tracks || [];

  useEffect(() => {
    if (tracks.length > 0 || pl.trackCount === 0) return;
    const token = getToken(source);
    if (!token?.accessToken) return;
    setLoading(true);
    const fetchTracks =
      source === "spotify" ? () => getSpotifyPlaylistTracks(token.accessToken, pl.id)
      : source === "youtube" ? () => getYouTubePlaylistTracks(token.accessToken, pl.id)
      : source === "tidal" ? () => getTidalPlaylistTracks(token.accessToken, pl.id)
      : source === "deezer" ? () => getDeezerPlaylistTracks(token.accessToken, pl.id)
      : () => Promise.resolve([]);
    fetchTracks()
      .then((tracksList) => {
        setPlaylists((prev) => prev.map((p) => (p.id === pl.id ? { ...p, tracks: tracksList } : p)));
      })
      .finally(() => setLoading(false));
  }, [pl.id, pl.trackCount, tracks.length, source]);

  if (loading) {
    return (
      <div style={{ marginTop: 2, padding: 16, borderRadius: `0 0 ${T.radiusSm}px ${T.radiusSm}px`, background: "rgba(0,0,0,0.02)", textAlign: "center", color: T.textDim, fontSize: 12 }}>
        Loading tracks...
      </div>
    );
  }
  return (
    <div style={{ marginTop: 2, padding: "8px 8px 8px 48px", maxHeight: 280, overflowY: "auto", borderRadius: `0 0 ${T.radiusSm}px ${T.radiusSm}px`, background: "rgba(0,0,0,0.02)" }}>
      <div className="track-header-row" style={{ display: "grid", gridTemplateColumns: "32px 1.4fr 1fr 60px", gap: 8, padding: "4px 14px 8px", fontSize: 10, fontWeight: 700, color: T.textDim, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: T.mono }}>
        <span style={{ textAlign: "right" }}>#</span>
        <span>Title</span>
        <span>Album</span>
        <span style={{ textAlign: "right" }}>Time</span>
      </div>
      {tracks.map((t, i) => (
        <TrackRow key={t.id || t.videoId || i} track={t} index={i} accentColor={accentColor} showMatch={false} />
      ))}
    </div>
  );
}

function ProgressRing({ progress, size = 48, stroke = 4, color }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (progress / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset} style={{ transition: "stroke-dashoffset 0.4s ease" }} />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   MAIN APP
   ───────────────────────────────────────────── */
const VIEWS = ["transfer", "history", "import"];

export default function PlaylistTransferPro() {
  // Navigation
  const [view, setView] = useState("transfer");

  // Transfer flow
  const [step, setStep] = useState(0); // 0=source, 1=dest, 2=select, 3=review, 4=transferring, 5=complete
  const [source, setSource] = useState(null);
  const [dest, setDest] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedPlaylist, setExpandedPlaylist] = useState(null);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [dupAction, setDupAction] = useState("skip"); // skip | keep | merge

  // Transfer state
  const [progress, setProgress] = useState(0);
  const [currentPlaylist, setCurrentPlaylist] = useState("");
  const [currentTrack, setCurrentTrack] = useState("");
  const [matchResults, setMatchResults] = useState({});
  const [transferLog, setTransferLog] = useState([]);
  const intervalRef = useRef(null);
  const transferStep4RunRef = useRef(false);
  const [transferGoToStep5, setTransferGoToStep5] = useState(false);

  // History (localStorage, capped at 50)
  const { history, addEntry, clearHistory } = useTransferHistory();

  // Import/Export
  const [importData, setImportData] = useState(null);
  const [importFormat, setImportFormat] = useState("json");
  const fileInputRef = useRef(null);

  // Auth (real tokens from callback)
  const { getToken, setToken, isConnected, disconnect } = useAuth();

  // Playlists: real from API or mock
  const [playlists, setPlaylists] = useState([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [lastTransferPlaylists, setLastTransferPlaylists] = useState([]);
  const [showViewOnPlatformModal, setShowViewOnPlatformModal] = useState(false);
  const [showSpotifyReconnectTip, setShowSpotifyReconnectTip] = useState(false);
  const [showTidalReconnectTip, setShowTidalReconnectTip] = useState(false);
  const [showDeezerUnavailable, setShowDeezerUnavailable] = useState(false);
  const [unavailablePlatform, setUnavailablePlatform] = useState(null);
  // Public playlist import (paste link): no source account needed for Deezer; Spotify/YouTube need user connected
  const [publicImportPlaylist, setPublicImportPlaylist] = useState(null);
  const [publicImportUrl, setPublicImportUrl] = useState("");
  const [publicImportLoading, setPublicImportLoading] = useState(false);
  const [publicImportError, setPublicImportError] = useState("");

  // Show all platforms; those without credentials show an "unavailable" modal when clicked
  const availablePlatforms = useMemo(() => ["spotify", "youtube", "tidal", "deezer", "apple"], []);

  const accentColor = T.accent;
  const selectedPlaylists = playlists.filter((p) => selectedIds.includes(p.id));
  const totalTracks = selectedPlaylists.reduce((a, p) => a + ((p.tracks?.length > 0 ? p.tracks.length : null) ?? p.trackCount ?? 0), 0);
  const duplicates = useMemo(
    () => findDuplicates(selectedPlaylists.map((p) => ({ ...p, tracks: p.tracks || [] }))),
    [selectedPlaylists]
  );
  const transferResume = useMemo(() => {
    if (!source || !dest || selectedIds.length === 0) return null;
    const cp = loadCheckpoint();
    if (!cp || cp.signature !== checkpointSignature(source, dest, selectedIds)) return null;
    const done = Object.keys(cp.done || {}).length;
    return done > 0 ? { done } : null;
  }, [source, dest, selectedIds, step]);
  const youtubeBudget = useMemo(
    () => (dest === "youtube" ? getYouTubeSearchBudget() : null),
    [dest, step]
  );

  // Connect: redirect to OAuth when credentials exist; otherwise show unavailable modal
  const connectPlatform = (pid) => {
    if (pid === "spotify" && !isConnected("spotify")) {
      if (!import.meta.env.SPOTIFY_CLIENT_ID) { setUnavailablePlatform("spotify"); return; }
      initiateSpotifyAuth();
      return;
    }
    if (pid === "youtube" && !isConnected("youtube")) {
      if (!import.meta.env.GOOGLE_CLIENT_ID) { setUnavailablePlatform("youtube"); return; }
      initiateYouTubeAuth();
      return;
    }
    if (pid === "tidal" && !isConnected("tidal")) {
      if (!import.meta.env.TIDAL_CLIENT_ID) { setUnavailablePlatform("tidal"); return; }
      initiateTidalAuth();
      return;
    }
    if (pid === "deezer" && !isConnected("deezer")) {
      if (!import.meta.env.DEEZER_APP_ID) { setShowDeezerUnavailable(true); return; }
      initiateDeezerAuth();
      return;
    }
    if (pid === "apple" && !isConnected("apple")) {
      if (!import.meta.env.APPLE_MUSIC_DEVELOPER_TOKEN) { setUnavailablePlatform("apple"); return; }
      return;
    }
  };

  // Load playlists when step 2 and source is set (skip when using public playlist import)
  useEffect(() => {
    if (step !== 2 || !source) return;
    if (publicImportPlaylist) return; // keep playlists from "Load playlist" URL
    if (source === "spotify" && isConnected("spotify")) {
      const token = getToken("spotify");
      if (!token?.accessToken) return;
      setPlaylistsLoading(true);
      getSpotifyPlaylists(token.accessToken)
        .then((list) => {
          setPlaylists(
            list.map((pl) => ({
              ...pl,
              emoji: "🎵",
              duration: `${pl.trackCount} tracks`,
              tracks: [],
            }))
          );
        })
        .catch(() => setPlaylists([]))
        .finally(() => setPlaylistsLoading(false));
      return;
    }
    if (source === "youtube" && isConnected("youtube")) {
      const token = getToken("youtube");
      if (!token?.accessToken) return;
      setPlaylistsLoading(true);
      getYouTubePlaylists(token.accessToken)
        .then((list) => {
          setPlaylists(
            list.map((pl) => ({
              ...pl,
              emoji: "🎵",
              duration: `${pl.trackCount} tracks`,
              tracks: [],
            }))
          );
        })
        .catch(() => setPlaylists([]))
        .finally(() => setPlaylistsLoading(false));
      return;
    }
    if (source === "tidal" && isConnected("tidal")) {
      const token = getToken("tidal");
      if (!token?.accessToken) return;
      setPlaylistsLoading(true);
      getTidalPlaylists(token.accessToken)
        .then((list) => {
          setPlaylists(
            list.map((pl) => ({
              ...pl,
              emoji: "🎵",
              duration: `${pl.trackCount} tracks`,
              tracks: [],
            }))
          );
        })
        .catch(() => setPlaylists([]))
        .finally(() => setPlaylistsLoading(false));
      return;
    }
    if (source === "deezer" && isConnected("deezer")) {
      const token = getToken("deezer");
      if (!token?.accessToken) return;
      setPlaylistsLoading(true);
      getDeezerPlaylists(token.accessToken)
        .then((list) => {
          setPlaylists(
            list.map((pl) => ({
              ...pl,
              emoji: "🎵",
              duration: `${pl.trackCount} tracks`,
            }))
          );
        })
        .catch(() => setPlaylists([]))
        .finally(() => setPlaylistsLoading(false));
      return;
    }
    setPlaylists([]);
  }, [step, source, publicImportPlaylist, isConnected("spotify"), isConnected("youtube"), isConnected("tidal"), isConnected("deezer")]);

  // Reset playlists/selection when source changes (e.g. user picked a different platform card)
  useEffect(() => {
    if (step === 0 && !publicImportPlaylist) {
      setPlaylists([]);
      setSelectedIds([]);
    }
  }, [source, step, publicImportPlaylist]);

  // Load a public playlist from URL (Deezer: no auth; Spotify/YouTube: require connected)
  const loadPublicPlaylist = useCallback(async () => {
    const parsed = parsePublicPlaylistUrl(publicImportUrl);
    setPublicImportError("");
    if (!parsed) {
      setPublicImportError("Unsupported or invalid link. Use a Spotify, YouTube, or Deezer playlist URL.");
      return;
    }
    setPublicImportLoading(true);
    try {
      if (parsed.platform === "deezer") {
        const data = await getDeezerPublicPlaylist(parsed.playlistId);
        const pl = {
          id: data.id,
          name: data.name,
          trackCount: data.tracks.length,
          tracks: data.tracks,
          emoji: "🎵",
          duration: `${data.tracks.length} tracks`,
          platform: "deezer",
        };
        setPlaylists([pl]);
        setSource("deezer");
        setSelectedIds([pl.id]);
        setPublicImportPlaylist({ platform: "deezer", playlist: pl });
        setStep(1);
      } else if (parsed.platform === "spotify") {
        const token = getToken("spotify");
        if (!token?.accessToken || !isConnected("spotify")) {
          setPublicImportError("Connect Spotify first to import a public Spotify playlist.");
          return;
        }
        const meta = await getSpotifyPlaylistById(token.accessToken, parsed.playlistId);
        const tracks = await getSpotifyPlaylistTracks(token.accessToken, parsed.playlistId);
        const pl = {
          id: meta.id,
          name: meta.name,
          trackCount: tracks.length,
          tracks,
          emoji: "🎵",
          duration: `${tracks.length} tracks`,
          platform: "spotify",
        };
        setPlaylists([pl]);
        setSource("spotify");
        setSelectedIds([pl.id]);
        setPublicImportPlaylist({ platform: "spotify", playlist: pl });
        setStep(1);
      } else if (parsed.platform === "youtube") {
        const token = getToken("youtube");
        if (!token?.accessToken || !isConnected("youtube")) {
          setPublicImportError("Connect YouTube first to import a public YouTube playlist.");
          return;
        }
        const meta = await getYouTubePlaylistById(token.accessToken, parsed.playlistId);
        const tracks = await getYouTubePlaylistTracks(token.accessToken, parsed.playlistId);
        const pl = {
          id: meta.id,
          name: meta.name,
          trackCount: tracks.length,
          tracks,
          emoji: "🎵",
          duration: `${tracks.length} tracks`,
          platform: "youtube",
        };
        setPlaylists([pl]);
        setSource("youtube");
        setSelectedIds([pl.id]);
        setPublicImportPlaylist({ platform: "youtube", playlist: pl });
        setStep(1);
      }
    } catch (err) {
      setPublicImportError(err?.message || "Failed to load playlist.");
    } finally {
      setPublicImportLoading(false);
    }
  }, [publicImportUrl, getToken, isConnected]);

  // Toggle playlist selection
  const togglePlaylist = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // When transfer finishes successfully, move to step 5 (backup).
  useEffect(() => {
    if (!transferGoToStep5 || step !== 4) return;
    setTransferGoToStep5(false);
    flushSync(() => setStep(5));
  }, [transferGoToStep5, step]);

  // Run transfer: called from "Start Transfer" button so we use current state (no effect/closure issues).
  const runTransfer = useCallback(async () => {
    const destOk = (dest === "spotify" || dest === "youtube" || dest === "tidal" || dest === "deezer") && isConnected(dest);
    const sourceOk = (source === "spotify" || source === "youtube" || source === "tidal" || source === "deezer") && (isConnected(source) || publicImportPlaylist);
    const isReal = sourceOk && destOk;

    if (isReal) {
      let sourceTokenData = publicImportPlaylist ? null : getToken(source);
      let destTokenData = getToken(dest);
      if (!destTokenData) {
        setTransferLog((prev) => [...prev, { type: "error", text: "Missing connection. Please connect the destination." }]);
        setStep(3);
        return;
      }
      const destTokenRef = { current: null };
      let checkpoint = null;
      let activeDestPlaylistId = null;
      const pendingAdds = { spotify: [], youtube: [], tidal: [], deezer: [], keys: [] };
      const allResults = {};
      let writesSinceFlush = 0;
      const publishResults = (force = false) => {
        writesSinceFlush += 1;
        if (force || writesSinceFlush >= 25) {
          writesSinceFlush = 0;
          setMatchResults({ ...allResults });
          if (checkpoint) saveCheckpoint(checkpoint);
        }
      };
      const flushPending = async () => {
        const token = destTokenRef.current;
        if (!checkpoint) return;
        if (!token || !activeDestPlaylistId || pendingAdds.keys.length === 0) {
          saveCheckpoint(checkpoint);
          return;
        }
        if (dest === "youtube") {
          while (pendingAdds.youtube.length) {
            const videoId = pendingAdds.youtube[0];
            const key = pendingAdds.keys[0];
            await addTracksToYouTubePlaylist(token, activeDestPlaylistId, [videoId]);
            checkpoint.done[key] = true;
            pendingAdds.youtube.shift();
            pendingAdds.keys.shift();
            saveCheckpoint(checkpoint);
          }
          return;
        }
        if (dest === "spotify") await addTracksToSpotifyPlaylist(token, activeDestPlaylistId, pendingAdds.spotify);
        else if (dest === "tidal") await addTracksToTidalPlaylist(token, activeDestPlaylistId, pendingAdds.tidal);
        else if (dest === "deezer") await addTracksToDeezerPlaylist(token, activeDestPlaylistId, pendingAdds.deezer);
        for (const key of pendingAdds.keys) checkpoint.done[key] = true;
        pendingAdds.spotify = [];
        pendingAdds.tidal = [];
        pendingAdds.deezer = [];
        pendingAdds.keys = [];
        saveCheckpoint(checkpoint);
      };
      try {
        setTransferLog((prev) => [...prev, { type: "header", text: `Creating playlists on ${PLATFORMS[dest].name}...` }]);
        setCurrentPlaylist("Loading source playlists...");
        setCurrentTrack("Fetching tracks...");
        // Refresh tokens if expired (skip source when using public import)
        if (!publicImportPlaylist && source === "spotify" && sourceTokenData) {
          const valid = await getValidSpotifyToken(sourceTokenData);
          if (valid) { sourceTokenData = valid; setToken("spotify", valid); } else { sourceTokenData = null; }
        }
        if (dest === "spotify" && destTokenData) {
          const valid = await getValidSpotifyToken(destTokenData);
          if (valid) { destTokenData = valid; setToken("spotify", valid); } else { destTokenData = null; }
        }
        if (!publicImportPlaylist && source === "youtube" && sourceTokenData) {
          const valid = await getValidYouTubeToken(sourceTokenData);
          if (valid) { sourceTokenData = valid; setToken("youtube", valid); } else { sourceTokenData = null; }
        }
        if (dest === "youtube" && destTokenData) {
          const valid = await getValidYouTubeToken(destTokenData);
          if (valid) { destTokenData = valid; setToken("youtube", valid); } else { destTokenData = null; }
        }
        if (!publicImportPlaylist && source === "tidal" && sourceTokenData) {
          const valid = await getValidTidalToken(sourceTokenData);
          if (valid) { sourceTokenData = valid; setToken("tidal", valid); } else { sourceTokenData = null; }
        }
        if (dest === "tidal" && destTokenData) {
          const valid = await getValidTidalToken(destTokenData);
          if (valid) { destTokenData = valid; setToken("tidal", valid); } else { destTokenData = null; }
        }
        if (!publicImportPlaylist && source === "deezer" && sourceTokenData) {
          const valid = await getValidDeezerToken(sourceTokenData);
          if (valid) { sourceTokenData = valid; setToken("deezer", valid); } else { sourceTokenData = null; }
        }
        if (dest === "deezer" && destTokenData) {
          const valid = await getValidDeezerToken(destTokenData);
          if (valid) { destTokenData = valid; setToken("deezer", valid); } else { destTokenData = null; }
        }
        const sourceToken = sourceTokenData?.accessToken;
        const destToken = destTokenData?.accessToken;
        let currentDestToken = destToken; // mutable so we can refresh on 401 mid-transfer
        destTokenRef.current = currentDestToken;
        if (!destToken) {
          setTransferLog((prev) => [...prev, { type: "error", text: "Destination token missing. Connect the destination and retry." }]);
          setStep(3);
          return;
        }
        if (!publicImportPlaylist && !sourceToken) {
          const platforms = [];
          if (source === "spotify" || dest === "spotify") platforms.push("Spotify");
          if (source === "youtube" || dest === "youtube") platforms.push("YouTube");
          if (source === "tidal" || dest === "tidal") platforms.push("Tidal");
          if (source === "deezer" || dest === "deezer") platforms.push("Deezer");
          const reauthMsg = platforms.length
            ? `${platforms.join(" / ")} token expired or invalid. Sign out of the listed platform(s) in the app, sign in again, then retry the transfer.`
            : "Could not get valid tokens.";
          setTransferLog((prev) => [...prev, { type: "error", text: reauthMsg }]);
          setStep(3);
          return;
        }
        const playlistsWithTracks = [];
        for (let idx = 0; idx < selectedPlaylists.length; idx++) {
          const pl = selectedPlaylists[idx];
          setCurrentPlaylist(`Loading: ${pl.name}`);
          setCurrentTrack(`Fetching tracks (${idx + 1}/${selectedPlaylists.length} playlists)...`);
          setProgress(Math.max(1, Math.round(((idx + 0.5) / selectedPlaylists.length) * 15)));
          let tracks = pl.tracks?.length ? pl.tracks : [];
          if (tracks.length === 0 && (pl.trackCount || 0) > 0 && sourceToken) {
            if (source === "spotify") tracks = await getSpotifyPlaylistTracks(sourceToken, pl.id);
            else if (source === "youtube") tracks = await getYouTubePlaylistTracks(sourceToken, pl.id);
            else if (source === "tidal") tracks = await getTidalPlaylistTracks(sourceToken, pl.id);
            else if (source === "deezer") tracks = await getDeezerPlaylistTracks(sourceToken, pl.id);
            else tracks = await getYouTubePlaylistTracks(sourceToken, pl.id);
          }
          playlistsWithTracks.push({ ...pl, tracks });
          await new Promise((r) => setTimeout(r, 0));
        }
        const total = playlistsWithTracks.reduce((a, p) => a + p.tracks.length, 0);
        if (total === 0) {
          clearCheckpoint();
          setTransferLog((prev) => [...prev, { type: "done", text: "No tracks to transfer." }]);
          setMatchResults({});
          setLastTransferPlaylists(playlistsWithTracks);
          setStep(5);
          return;
        }
        const signature = checkpointSignature(source, dest, playlistsWithTracks.map((p) => p.id));
        const existingCheckpoint = loadCheckpoint();
        if (existingCheckpoint?.signature === signature) {
          checkpoint = existingCheckpoint;
          checkpoint.done = checkpoint.done || {};
          checkpoint.results = checkpoint.results || {};
          checkpoint.destPlaylistIds = checkpoint.destPlaylistIds || {};
          const resumed = Object.keys(checkpoint.done).length;
          if (resumed > 0) {
            setTransferLog((prev) => [...prev, { type: "header", text: `Resuming transfer (${resumed} tracks already saved).` }]);
          }
        } else {
          checkpoint = { signature, source, dest, destPlaylistIds: {}, done: {}, results: {} };
        }
        Object.assign(allResults, checkpoint.results);
        if (dest === "youtube") {
          const budget = getYouTubeSearchBudget();
          setTransferLog((prev) => [...prev, { type: "header", text: `YouTube searches left today: ${budget.remaining} of ${budget.limit}. Cached matches do not use a search.` }]);
        }
        let spotifyUserId = null;
        if (dest === "spotify") {
          const profile = await getSpotifyUserProfile(destTokenRef.current);
          spotifyUserId = profile.id;
        }
        let processed = Object.keys(checkpoint.done).length;
        setProgress(15 + Math.round((processed / total) * 85));
        const trackKeyOf = (playlistId, track) => `${playlistId}:${track.id || track.videoId || track.title}`;
        for (const pl of playlistsWithTracks) {
          const tracks = pl.tracks || [];
          const playlistDone = tracks.every((track) => checkpoint.done[trackKeyOf(pl.id, track)]);
          if (playlistDone && checkpoint.destPlaylistIds[pl.id]) {
            setTransferLog((prev) => [...prev, { type: "done", text: `✓ "${pl.name}" already transferred` }]);
            continue;
          }
          setCurrentPlaylist(pl.name);
          let destPlaylistId = checkpoint.destPlaylistIds[pl.id];
          if (destPlaylistId) {
            setTransferLog((prev) => [...prev, { type: "header", text: `Resuming "${pl.name}" on ${PLATFORMS[dest].name}` }]);
          } else {
            setTransferLog((prev) => [...prev, { type: "header", text: `Creating playlist on ${PLATFORMS[dest].name}: "${pl.name}"` }]);
            setCurrentTrack("Creating playlist...");
            if (dest === "spotify") {
              destPlaylistId = await createSpotifyPlaylist(destTokenRef.current, spotifyUserId, pl.name, "Transferred via StreamSwap");
            } else if (dest === "youtube") {
              try {
                destPlaylistId = await createYouTubePlaylist(destTokenRef.current, pl.name, "Transferred via StreamSwap");
              } catch (ytErr) {
                const is401 = String(ytErr?.message || "").includes("401") || String(ytErr?.message || "").includes("Token expired") || String(ytErr?.message || "").includes("Sign out");
                if (is401) {
                  const fresh = await getValidYouTubeToken(getToken("youtube"));
                  if (fresh) {
                    setToken("youtube", fresh);
                    currentDestToken = fresh.accessToken;
                    destTokenRef.current = currentDestToken;
                    destPlaylistId = await createYouTubePlaylist(currentDestToken, pl.name, "Transferred via StreamSwap");
                  } else throw ytErr;
                } else throw ytErr;
              }
            } else if (dest === "tidal") {
              destPlaylistId = await createTidalPlaylist(destTokenRef.current, pl.name, "Transferred via StreamSwap");
            } else if (dest === "deezer") {
              destPlaylistId = await createDeezerPlaylist(destTokenRef.current, pl.name, "Transferred via StreamSwap");
            }
            checkpoint.destPlaylistIds[pl.id] = destPlaylistId;
            saveCheckpoint(checkpoint);
          }
          activeDestPlaylistId = destPlaylistId;
          for (let i = 0; i < tracks.length; i++) {
            const track = tracks[i];
            const tid = track.id || track.videoId || track.title;
            const key = trackKeyOf(pl.id, track);
            if (checkpoint.done[key]) continue;
            setCurrentTrack(`${track.title} — ${track.artist}`);
            let match = null;
            if (dest === "spotify") match = await searchSpotifyTrack(destTokenRef.current, track.title, track.artist, track.isrc || null, track.duration || 0);
            else if (dest === "youtube") match = await searchYouTubeTrack(destTokenRef.current, track.title, track.artist);
            else if (dest === "tidal") match = await searchTidalTrack(destTokenRef.current, track.title, track.artist, track.isrc || null, track.duration || 0);
            else if (dest === "deezer") match = await searchDeezerTrack(destTokenRef.current, track.title, track.artist, track.duration || 0);
            const confidence = match ? (match.confidence ?? 0) : 0;
            const result = { confidence, method: match?.method || "none" };
            allResults[tid] = result;
            checkpoint.results[tid] = result;
            const addedId = dest === "spotify" ? match?.uri : dest === "youtube" ? match?.videoId : match?.id;
            if (addedId) {
              pendingAdds[dest].push(addedId);
              pendingAdds.keys.push(key);
              if (pendingAdds.keys.length >= 50) await flushPending();
            } else {
              checkpoint.done[key] = true;
            }
            processed++;
            setProgress(15 + Math.round((processed / total) * 85));
            publishResults(false);
            if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0));
          }
          await flushPending();
          publishResults(true);
          const exactCount = tracks.filter((t) => (allResults[t.id || t.videoId || t.title]?.confidence ?? 0) >= 0.85).length;
          setTransferLog((prev) => [...prev, { type: "done", text: `✓ "${pl.name}" — ${exactCount}/${tracks.length} matched` }]);
        }
        clearCheckpoint();
        setTransferLog((prev) => [...prev, { type: "done", text: "Transfer complete." }]);
        const exact = Object.values(allResults).filter((r) => r.confidence >= 0.85).length;
        const fuzzy = Object.values(allResults).filter((r) => r.confidence >= 0.6 && r.confidence < 0.85).length;
        const missing = Object.values(allResults).filter((r) => r.confidence < 0.6).length;
        addEntry({
          source,
          dest,
          playlists: playlistsWithTracks.map((p) => p.name),
          totalTracks: total,
          exact,
          fuzzy,
          missing,
        });
        setMatchResults({ ...allResults });
        setLastTransferPlaylists(playlistsWithTracks);
        setStep(5);
        setShowViewOnPlatformModal(true);
      } catch (err) {
        try { await flushPending(); } catch { /* keep the original error */ }
        if (checkpoint) saveCheckpoint(checkpoint);
        setMatchResults({ ...allResults });
        let msg = err?.message != null ? String(err.message) : String(err);
        if (err instanceof RateLimitError || err?.name === "RateLimitError") {
          const saved = Object.keys(checkpoint?.done || {}).length;
          msg = `Rate limit reached. ${saved} tracks are saved. Start the transfer again to resume${err.retryAfterSec ? ` after about ${err.retryAfterSec}s` : ""}.`;
        } else if (err?.name === "YouTubeQuotaError") {
          const budget = getYouTubeSearchBudget();
          msg = err.message === "YOUTUBE_UNIT_QUOTA"
            ? "YouTube's daily unit quota is used up. Tracks already added were saved. Start again tomorrow to resume."
            : `YouTube search limit reached (${budget.used} of ${budget.limit} today). Tracks already added were saved. Start again to resume; cached songs do not use another search.`;
        } else if (msg.startsWith("SPOTIFY_NEED_PERMISSION")) {
          setShowSpotifyReconnectTip(true);
          msg = "Spotify needs permissions. Reconnect and allow.";
        } else if (msg.startsWith("TIDAL_NEED_PERMISSION")) {
          setShowTidalReconnectTip(true);
          msg = "Tidal needs permissions. Reconnect and allow.";
        } else if (isDeveloperOnlyError(msg)) {
          msg = "Something went wrong. Try signing in again or try again later.";
        }
        setTransferLog((prev) => [...prev, { type: "error", text: msg || "Transfer failed" }]);
        setStep(3);
      }
      return;
    }

    // Only real transfers: require both source and destination connected
    setTransferLog((prev) => [...prev, { type: "error", text: "Connect both source and destination to transfer. Only real transfers are supported." }]);
    setStep(3);
  }, [source, dest, selectedPlaylists, publicImportPlaylist, getToken, setToken, isConnected, addEntry]);

  // Clear reconnect tips when leaving step 3 (e.g. user went back or changed flow).
  useEffect(() => {
    if (step !== 3) {
      setShowSpotifyReconnectTip(false);
      setShowTidalReconnectTip(false);
    }
  }, [step]);

  // On step 4: set initial UI once when entering step 4 (transfer is started by button).
  useEffect(() => {
    if (step !== 4) {
      transferStep4RunRef.current = false;
      return;
    }
    if (transferStep4RunRef.current) return;
    transferStep4RunRef.current = true;
    setProgress(0);
    setMatchResults({});
    setCurrentPlaylist("Preparing...");
    setCurrentTrack(`Connecting to ${PLATFORMS[dest]?.name || dest}...`);
    setTransferLog([{ type: "header", text: `Starting transfer to ${PLATFORMS[dest]?.name || dest}...` }]);
  }, [step, dest]);

  // Export playlists
  const exportPlaylists = (format) => {
    const data = selectedPlaylists.map((pl) => ({
      name: pl.name,
      tracks: pl.tracks.map((t) => ({
        title: t.title,
        artist: t.artist,
        album: t.album,
        duration: t.duration,
        isrc: t.isrc,
      })),
    }));
    let blob, filename;
    if (format === "json") {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      filename = "playlists_export.json";
    } else {
      // CSV format
      let csv = "Playlist,Track,Artist,Album,Duration,ISRC\n";
      for (const pl of data) {
        for (const t of pl.tracks) {
          csv += `"${pl.name}","${t.title}","${t.artist}","${t.album}","${fmtDuration(t.duration)}","${t.isrc}"\n`;
        }
      }
      blob = new Blob([csv], { type: "text/csv" });
      filename = "playlists_export.csv";
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import handler
  const handleImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { format, playlists } = parsePlaylistFile(file.name, ev.target.result);
        setImportData(playlists);
        setImportFormat(format);
      } catch (err) {
        setImportData(null);
      }
    };
    reader.readAsText(file);
  };

  const reset = () => {
    setStep(0);
    setSource(null);
    setDest(null);
    setSelectedIds([]);
    setPlaylists([]);
    setExpandedPlaylist(null);
    setShowDuplicates(false);
    setProgress(0);
    setMatchResults({});
    setTransferLog([]);
    setCurrentPlaylist("");
    setCurrentTrack("");
    setLastTransferPlaylists([]);
    setPublicImportPlaylist(null);
    setPublicImportUrl("");
    setPublicImportError("");
  };

  // Computed match stats for complete step
  const matchStats = useMemo(() => {
    const results = Object.values(matchResults);
    return {
      exact: results.filter((r) => r.confidence >= 0.85).length,
      fuzzy: results.filter((r) => r.confidence >= 0.6 && r.confidence < 0.85).length,
      missing: results.filter((r) => r.confidence < 0.6).length,
      total: results.length,
    };
  }, [matchResults]);

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: T.font, position: "relative", overflow: "hidden" }}>
      <style>{css}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "36px 20px 64px", position: "relative", zIndex: 1 }}>

        {/* ── HEADER ── */}
        <div className="header-row" style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 36, gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: T.display, fontWeight: 560, fontSize: 32, letterSpacing: "-0.03em", lineHeight: 1 }}>StreamSwap</h1>
            <p style={{ fontSize: 14, color: T.textMuted, fontWeight: 500, marginTop: 6 }}>Move your playlists, quietly.</p>
          </div>

          <nav style={{ display: "flex", gap: 6, background: T.paper, borderRadius: 999, padding: 4, border: `1px solid ${T.border}` }}>
            {[
              { id: "transfer", label: "Transfer" },
              { id: "history", label: "History" },
              { id: "import", label: "Files" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setView(tab.id); if (tab.id === "transfer" && step > 5) reset(); }}
                style={{
                  background: view === tab.id ? T.accent : "transparent",
                  border: "none",
                  borderRadius: 999,
                  padding: "8px 16px",
                  color: view === tab.id ? "#fffdf8" : T.textMuted,
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: T.font,
                  cursor: "pointer",
                  transition: "background 0.2s ease, color 0.2s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* ═══════════════════════════════════════════
            TRANSFER VIEW
            ═══════════════════════════════════════════ */}
        {view === "transfer" && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }} aria-hidden="true">
                {["From", "To", "Choose", "Check", "Move", "Done"].map((label, i) => (
                  <div key={label} style={{ flex: 1 }}>
                    <div style={{ height: 3, borderRadius: 99, background: i <= step ? T.accent : T.border, transition: "background 0.3s ease" }} />
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 12, color: T.textDim, fontWeight: 700, letterSpacing: "0.04em" }}>
                {["From", "To", "Choose", "Check", "Move", "Done"][step] || "Done"}
                {source && dest && step >= 1 ? `  ·  ${PLATFORMS[source]?.name} to ${PLATFORMS[dest]?.name}` : ""}
              </p>
            </div>

            {/* ── STEP 0: Source ── */}
            {step === 0 && (
              <div className="fade-up">
                <h2 className="step-title" style={{ marginBottom: 8 }}>Where does this music live?</h2>
                <p style={{ fontSize: 15, color: T.textMuted, marginBottom: 22, lineHeight: 1.5 }}>Sign in to the service that has your playlists. You can also paste a public link below.</p>
                <div className="platform-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(availablePlatforms.length, 5)}, 1fr)`, gap: 10 }}>
                  {availablePlatforms.map((id) => (
                    <PlatformCard
                      key={id}
                      id={id}
                      selected={source === id}
                      onClick={(pid) => { setPublicImportPlaylist(null); setSource(pid); if (!isConnected(pid)) connectPlatform(pid); }}
                      connected={isConnected(id)}
                      onDisconnect={(pid) => { disconnect(pid); if (source === pid) setSource(null); if (dest === pid) setDest(null); }}
                    />
                  ))}
                </div>
                {source && !isConnected(source) && (source === "spotify" || source === "youtube" || source === "tidal" || source === "deezer") && (
                  <div className="fade-up" style={{ marginTop: 16, padding: "14px 16px", borderRadius: T.radiusSm, background: `${PLATFORMS[source].color}10`, border: `1px solid ${PLATFORMS[source].color}22`, fontSize: 13, color: T.textMuted }}>
                    Tap {PLATFORMS[source].name} above to sign in.
                  </div>
                )}
                <div className="fade-up" style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
                  <p style={{ fontSize: 15, color: T.textMuted, marginBottom: 10, lineHeight: 1.5 }}>Have a public link instead? Paste a Spotify, YouTube, or Deezer playlist.</p>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <input
                      type="url"
                      placeholder="https://open.spotify.com/playlist/… or youtube.com/playlist?list=… or deezer.com/…/playlist/…"
                      value={publicImportUrl}
                      onChange={(e) => { setPublicImportUrl(e.target.value); setPublicImportError(""); }}
                      style={{
                        flex: 1, minWidth: 200, padding: "10px 14px", borderRadius: T.radiusSm, border: `1px solid ${T.border}`,
                        background: T.surface, color: T.text, fontSize: 13, fontFamily: T.font,
                      }}
                    />
                    <button
                      type="button"
                      onClick={loadPublicPlaylist}
                      disabled={publicImportLoading || !publicImportUrl.trim()}
                      style={{
                        padding: "10px 18px", borderRadius: T.radiusSm, border: "none", fontFamily: T.font, fontWeight: 600, fontSize: 13,
                        background: (publicImportLoading || !publicImportUrl.trim()) ? T.border : accentColor,
                        color: (publicImportLoading || !publicImportUrl.trim()) ? T.textDim : "#fff", cursor: (publicImportLoading || !publicImportUrl.trim()) ? "not-allowed" : "pointer",
                      }}
                    >
                      {publicImportLoading ? "Loading…" : "Load playlist"}
                    </button>
                  </div>
                  {publicImportError && <p style={{ fontSize: 12, color: T.bad, marginTop: 8 }}>{publicImportError}</p>}
                </div>
              </div>
            )}

            {/* ── STEP 1: Destination ── */}
            {step === 1 && (
              <div className="fade-up">
                <h2 className="step-title" style={{ marginBottom: 8 }}>Where should it go?</h2>
                <p style={{ fontSize: 15, color: T.textMuted, marginBottom: 22, lineHeight: 1.5 }}>Pick the service that should receive these playlists. The one you started from stays put.</p>
                <div className="platform-grid" style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(availablePlatforms.length, 5)}, 1fr)`, gap: 10 }}>
                  {availablePlatforms.map((id) => (
                    <PlatformCard
                      key={id}
                      id={id}
                      selected={dest === id}
                      onClick={(pid) => { setDest(pid); if (!isConnected(pid)) connectPlatform(pid); }}
                      disabled={id === source}
                      connected={isConnected(id)}
                      onDisconnect={(pid) => { disconnect(pid); if (source === pid) setSource(null); if (dest === pid) setDest(null); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 2: Select Playlists ── */}
            {step === 2 && (
              <div className="fade-up">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <h2 className="step-title">Choose what to bring</h2>
                  <button onClick={() => setSelectedIds(selectedIds.length === playlists.length ? [] : playlists.map((p) => p.id))} style={{ background: "none", border: "none", color: accentColor, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: T.font }}>
                    {selectedIds.length === playlists.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 16 }}>
                  {playlistsLoading ? "Loading playlists..." : playlists.length === 0 ? "No playlists found. Make sure you're connected and have playlists on " + PLATFORMS[source].name + "." : `Found ${playlists.length} playlists on ${PLATFORMS[source].name}`}
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {playlistsLoading ? (
                    <div style={{ textAlign: "center", padding: 32, color: T.textDim }}>
                      <div style={{ width: 28, height: 28, border: `2px solid ${T.border}`, borderTopColor: accentColor, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                      Loading...
                    </div>
                  ) : playlists.map((pl) => {
                    const selected = selectedIds.includes(pl.id);
                    const expanded = expandedPlaylist === pl.id;
                    return (
                      <div key={pl.id}>
                        <div
                          onClick={() => togglePlaylist(pl.id)}
                          className="card-hover"
                          style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                            borderRadius: T.radiusSm,
                            background: selected ? `${accentColor}0a` : T.surface,
                            border: `1.5px solid ${selected ? `${accentColor}33` : T.border}`,
                            cursor: "pointer", transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{
                            width: 20, height: 20, borderRadius: 5,
                            border: `2px solid ${selected ? accentColor : T.borderLight}`,
                            background: selected ? accentColor : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            transition: "all 0.2s ease", flexShrink: 0,
                          }}>
                            {selected && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4"><polyline points="20 6 9 17 4 12" /></svg>}
                          </div>
                          <div style={{ width: 42, height: 42, borderRadius: 8, background: "rgba(0,0,0,0.04)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>{pl.emoji}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pl.name}</div>
                            <div style={{ fontSize: 11, color: T.textDim }}>{pl.trackCount} tracks · {pl.duration}</div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setExpandedPlaylist(expanded ? null : pl.id); }}
                            style={{ background: "none", border: "none", color: T.textDim, cursor: "pointer", fontSize: 18, padding: "4px 8px", transition: "transform 0.2s ease", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}
                          >
                            ▾
                          </button>
                        </div>
                        {/* Expanded track list */}
                        {expanded && (
                          <ExpandedTrackList
                            pl={pl}
                            accentColor={accentColor}
                            source={source}
                            getToken={getToken}
                            setPlaylists={setPlaylists}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedIds.length > 0 && (
                  <div className="fade-up" style={{ marginTop: 14, padding: "12px 16px", borderRadius: T.radiusSm, background: `${accentColor}0a`, border: `1px solid ${accentColor}1a`, fontSize: 13, color: T.textMuted, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>{selectedIds.length} playlist{selectedIds.length > 1 ? "s" : ""} · {totalTracks} tracks</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <Chip color={accentColor} active onClick={() => exportPlaylists("json")}>Export JSON</Chip>
                      <Chip color={accentColor} active={false} onClick={() => exportPlaylists("csv")}>Export CSV</Chip>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: Review (Duplicates + Confirmation) ── */}
            {step === 3 && (
              <div className="fade-up">
                <h2 className="step-title" style={{ marginBottom: 8 }}>Take a last look</h2>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
                  Transferring {selectedIds.length} playlist{selectedIds.length > 1 ? "s" : ""} ({totalTracks} tracks) from <span style={{ color: PLATFORMS[source].color, fontWeight: 600 }}>{PLATFORMS[source].name}</span> → <span style={{ color: PLATFORMS[dest].color, fontWeight: 600 }}>{PLATFORMS[dest].name}</span>
                </p>

                {transferResume && (
                  <div style={{ marginBottom: 16, padding: 14, borderRadius: T.radiusSm, background: `${accentColor}12`, border: `1px solid ${accentColor}33`, fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                    A transfer of this selection is paused. <strong>{transferResume.done}</strong> tracks are already saved. Start again to resume where it stopped.
                  </div>
                )}

                {youtubeBudget && (
                  <div style={{ marginBottom: 16, padding: 14, borderRadius: T.radiusSm, background: `${PLATFORMS.youtube.color}10`, border: `1px solid ${PLATFORMS.youtube.color}33`, fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                    YouTube searches left today: <strong>{youtubeBudget.remaining}</strong> of {youtubeBudget.limit}. Each uncached song uses one search. The transfer pauses when the daily limit is reached, and cached matches are reused for free.
                  </div>
                )}

                {showSpotifyReconnectTip && dest === "spotify" && (
                  <div style={{ marginBottom: 16, padding: 14, borderRadius: T.radiusSm, background: `${PLATFORMS.spotify.color}12`, border: `1px solid ${PLATFORMS.spotify.color}30`, fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                    <strong style={{ color: PLATFORMS.spotify.color }}>Spotify needs permissions.</strong> Reconnect and allow.
                    <button
                      type="button"
                      onClick={() => { clearSpotifyAuthState(); disconnect("spotify"); setShowSpotifyReconnectTip(false); initiateSpotifyAuth(); }}
                      className="btn-hover"
                      style={{ width: "100%", marginTop: 10, background: PLATFORMS.spotify.color, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}
                    >
                      Reconnect Spotify
                    </button>
                  </div>
                )}

                {showTidalReconnectTip && (dest === "tidal" || source === "tidal") && (
                  <div style={{ marginBottom: 16, padding: 14, borderRadius: T.radiusSm, background: `${PLATFORMS.tidal.color}12`, border: `1px solid ${PLATFORMS.tidal.color}30`, fontSize: 12, color: T.text, lineHeight: 1.5 }}>
                    <strong style={{ color: PLATFORMS.tidal.color }}>Tidal needs permissions.</strong> Reconnect and allow.
                    <button
                      type="button"
                      onClick={() => { clearTidalAuthState(); disconnect("tidal"); setShowTidalReconnectTip(false); initiateTidalAuth(); }}
                      className="btn-hover"
                      style={{ width: "100%", marginTop: 10, background: PLATFORMS.tidal.color, color: "#fff", border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}
                    >
                      Reconnect Tidal
                    </button>
                  </div>
                )}

                {/* Summary cards */}
                <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
                  {[
                    { label: "Playlists", value: selectedIds.length },
                    { label: "Songs", value: totalTracks },
                    { label: "Repeated", value: duplicates.length },
                  ].map((s) => (
                    <div key={s.label} style={{ padding: "16px 14px", borderRadius: T.radiusSm, background: T.paper, border: `1px solid ${T.border}`, textAlign: "center" }}>
                      <div style={{ fontFamily: T.display, fontSize: 28, fontWeight: 560, color: T.text }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: T.textDim, fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Duplicates section */}
                {duplicates.length > 0 && (
                  <div style={{ marginBottom: 20, padding: 16, borderRadius: T.radius, background: "#fbf6ee", border: `1px solid ${T.border}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{duplicates.length} songs show up more than once</div>
                        <div style={{ fontSize: 13, color: T.textMuted, marginTop: 4, lineHeight: 1.45 }}>They appear in more than one playlist you selected.</div>
                      </div>
                      <button onClick={() => setShowDuplicates(!showDuplicates)} style={{ background: "none", border: "none", color: T.warn, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: T.font }}>
                        {showDuplicates ? "Hide" : "Show"} details
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: showDuplicates ? 12 : 0 }}>
                      {[
                        { id: "skip", label: "Keep one copy" },
                        { id: "keep", label: "Keep every copy" },
                        { id: "merge", label: "Merge into one" },
                      ].map((opt) => (
                        <Chip key={opt.id} color={T.warn} active={dupAction === opt.id} onClick={() => setDupAction(opt.id)}>{opt.label}</Chip>
                      ))}
                    </div>

                    {showDuplicates && (
                      <div style={{ maxHeight: 180, overflowY: "auto" }}>
                        {duplicates.slice(0, 20).map((d, i) => (
                          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderTop: i > 0 ? `1px solid rgba(251,191,36,0.08)` : "none", fontSize: 12 }}>
                            <span style={{ color: T.text }}>{d.track.title} — <span style={{ color: T.textMuted }}>{d.track.artist}</span></span>
                            <span style={{ color: T.textDim, fontSize: 11 }}>{d.existsIn} & {d.playlist}</span>
                          </div>
                        ))}
                        {duplicates.length > 20 && <div style={{ fontSize: 11, color: T.textDim, padding: "8px 0" }}>+{duplicates.length - 20} more...</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Playlists to transfer */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {selectedPlaylists.map((pl) => (
                    <div key={pl.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: T.radiusSm, background: T.surface, border: `1px solid ${T.border}` }}>
                      <span style={{ fontSize: 18 }}>{pl.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{pl.name}</div>
                        <div style={{ fontSize: 11, color: T.textDim }}>{pl.trackCount} tracks</div>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── STEP 4: Transferring ── */}
            {step === 4 && (
              <div className="fade-up">
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <h2 className="step-title" style={{ marginBottom: 8 }}>Moving your music</h2>
                  <p style={{ fontSize: 12, color: T.textMuted }}>{transferLog.length > 0 ? "Transfer in progress…" : "Starting…"}</p>
                </div>

                {/* Progress bar — always visible */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, textTransform: "uppercase", letterSpacing: "0.06em" }}>Transfer progress</span>
                    <span style={{ fontFamily: T.mono, fontSize: 14, fontWeight: 700, color: accentColor }}>{progress}%</span>
                  </div>
                  <div style={{ width: "100%", height: 12, borderRadius: 6, background: "rgba(0,0,0,0.1)", overflow: "hidden", border: `1px solid ${T.border}` }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${Math.max(progress, 0)}%`,
                        minWidth: progress >= 100 ? "100%" : progress > 0 ? "4%" : "0%",
                        borderRadius: 5,
                        background: `linear-gradient(90deg, ${PLATFORMS[source]?.color || accentColor}, ${PLATFORMS[dest]?.color || accentColor})`,
                        transition: "width 0.35s ease-out",
                        boxShadow: `0 0 20px ${accentColor}40`,
                      }}
                    />
                  </div>
                </div>

                {/* Source → Dest visual + ring */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, marginBottom: 24 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: PLATFORMS[source]?.color }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: `${PLATFORMS[source]?.color}15`, border: `2px solid ${PLATFORMS[source]?.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>{ICONS[source]}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: T.mono }}>{PLATFORMS[source]?.name}</span>
                  </div>
                  <div style={{ position: "relative", width: 64 }}>
                    <ProgressRing progress={progress} size={64} stroke={5} color={accentColor} />
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.mono, fontSize: 12, fontWeight: 700, color: accentColor }}>{progress}%</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: PLATFORMS[dest]?.color }}>
                    <div style={{ width: 52, height: 52, borderRadius: 12, background: `${PLATFORMS[dest]?.color}15`, border: `2px solid ${PLATFORMS[dest]?.color}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>{ICONS[dest]}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, fontFamily: T.mono }}>{PLATFORMS[dest]?.name}</span>
                  </div>
                </div>

                {/* Current activity — what’s happening now */}
                <div style={{ textAlign: "center", marginBottom: 16, padding: "12px 16px", borderRadius: T.radiusSm, background: T.surface, border: `1px solid ${T.border}` }}>
                  <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Now</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.text, marginBottom: 2 }}>{currentPlaylist || "—"}</div>
                  <div style={{ fontSize: 12, color: T.textMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 360, margin: "0 auto" }}>{currentTrack || "—"}</div>
                </div>

                {/* Log */}
                <div style={{ maxHeight: 160, overflowY: "auto", borderRadius: T.radiusSm, background: T.surface, padding: 12, border: `1px solid ${T.border}` }}>
                  {transferLog.map((log, i) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: T.mono, color: log.type === "done" ? T.ok : log.type === "header" ? accentColor : log.type === "error" ? T.bad : T.textMuted, padding: "3px 0", fontWeight: log.type === "header" ? 600 : 400 }}>
                      {log.text}
                    </div>
                  ))}
                </div>

                {/* Manual "View results" if transfer appears done (backup if auto-transition fails) */}
                {(progress >= 100 || transferLog.some((l) => l.type === "done" && (l.text === "Transfer complete." || l.text?.startsWith("✓")))) && (
                  <div style={{ marginTop: 16, textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => setStep(5)}
                      className="btn-hover"
                      style={{ background: accentColor, border: "none", borderRadius: T.radius, padding: "12px 24px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}
                    >
                      View results →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 5: Complete ── */}
            {step === 5 && (
              <div className="fade-up" style={{ textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${PLATFORMS[dest].color}15`, border: `3px solid ${PLATFORMS[dest].color}`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={PLATFORMS[dest].color} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
                </div>

                <h2 className="step-title" style={{ marginBottom: 8 }}>They’re home.</h2>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                  {selectedIds.length} playlist{selectedIds.length > 1 ? "s" : ""} moved from <span style={{ color: PLATFORMS[source].color, fontWeight: 600 }}>{PLATFORMS[source].name}</span> to <span style={{ color: PLATFORMS[dest].color, fontWeight: 600 }}>{PLATFORMS[dest].name}</span>
                </p>

                {/* Match stats */}
                <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
                  {[
                    { label: "Total", value: matchStats.total, color: T.text },
                    { label: "Found", value: matchStats.exact, color: T.ok },
                    { label: "Close match", value: matchStats.fuzzy, color: T.warn },
                    { label: "Not found", value: matchStats.missing, color: T.bad },
                  ].map((s) => (
                    <div key={s.label} style={{ padding: "14px 8px", borderRadius: T.radiusSm, background: T.surface, border: `1px solid ${T.border}` }}>
                      <div style={{ fontFamily: T.mono, fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                      <div style={{ fontSize: 10, color: T.textDim, fontWeight: 500, marginTop: 2 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Track-level results per playlist */}
                <div style={{ textAlign: "left", marginBottom: 28 }}>
                  {(lastTransferPlaylists.length ? lastTransferPlaylists : selectedPlaylists).map((pl) => {
                    const tracks = pl.tracks || [];
                    const plMatches = tracks.map((t) => ({ track: t, result: matchResults[t.id] || matchResults[t.videoId] || matchResults[t.title] }));
                    const exact = plMatches.filter((m) => m.result?.confidence >= 0.85).length;
                    const fuzzy = plMatches.filter((m) => m.result?.confidence >= 0.6 && m.result?.confidence < 0.85).length;
                    const missing = plMatches.filter((m) => !m.result || m.result.confidence < 0.6).length;
                    const isExpanded = expandedPlaylist === pl.id;
                    return (
                      <div key={pl.id} style={{ marginBottom: 4 }}>
                        <div
                          onClick={() => setExpandedPlaylist(isExpanded ? null : pl.id)}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: T.radiusSm, background: T.surface, border: `1px solid ${T.border}`, cursor: "pointer" }}
                        >
                          <span style={{ fontSize: 16 }}>{pl.emoji}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{pl.name}</div>
                          </div>
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <Badge color={T.ok}>{exact}</Badge>
                            {fuzzy > 0 && <Badge color={T.warn}>{fuzzy}</Badge>}
                            {missing > 0 && <Badge color={T.bad}>{missing}</Badge>}
                          </div>
                          <span style={{ color: T.textDim, fontSize: 16, transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0)" }}>▾</span>
                        </div>
                        {isExpanded && (
                          <div style={{ padding: "6px 0 6px 12px", maxHeight: 300, overflowY: "auto" }}>
                            {plMatches.map((m, i) => (
                              <TrackRow key={m.track.id || m.track.videoId || i} track={m.track} matchResult={m.result} index={i} accentColor={accentColor} showMatch={true} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                  <button onClick={reset} className="btn-hover" style={{ background: `${accentColor}15`, border: `1.5px solid ${accentColor}33`, borderRadius: T.radius, padding: "12px 28px", color: accentColor, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font, transition: "all 0.2s ease" }}>
                    Transfer More
                  </button>
                  <button onClick={() => setView("history")} className="btn-hover" style={{ background: T.surface, border: `1.5px solid ${T.border}`, borderRadius: T.radius, padding: "12px 28px", color: T.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font, transition: "all 0.2s ease" }}>
                    View History
                  </button>
                </div>
              </div>
            )}

            {/* ── Navigation Buttons ── */}
            {step >= 0 && step <= 3 && (
              <div className="nav-buttons" style={{ display: "flex", justifyContent: "space-between", marginTop: 28, gap: 10 }}>
                {step > 0 ? (
                  <button onClick={() => setStep((s) => s - 1)} className="btn-hover" style={{ background: T.surface, border: `1.5px solid ${T.borderLight}`, borderRadius: T.radius, padding: "12px 24px", color: T.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font, transition: "all 0.2s ease" }}>
                    ← Back
                  </button>
                ) : <div />}
                <button
                  onClick={() => {
                    if (step === 3) {
                      setStep(4);
                      runTransfer();
                    } else {
                      setStep((s) => s + 1);
                    }
                  }}
                  disabled={step === 0 ? !source : step === 1 ? !dest : step === 2 ? selectedIds.length === 0 : false}
                  className="btn-hover"
                  style={{
                    background: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? accentColor : T.surface,
                    border: "none", borderRadius: T.radius, padding: "12px 28px",
                    color: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? "#fff" : T.textDim,
                    fontSize: 13, fontWeight: 700, cursor: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? "pointer" : "not-allowed",
                    fontFamily: T.font, transition: "all 0.3s ease",
                    boxShadow: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? `0 4px 20px ${accentColor}33` : "none",
                    opacity: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? 1 : 0.5,
                  }}
                >
                  {step === 3 ? (transferResume ? "Resume Transfer →" : "Start Transfer →") : step === 2 ? `Review ${selectedIds.length} Playlist${selectedIds.length !== 1 ? "s" : ""} →` : "Continue →"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════
            HISTORY VIEW
            ═══════════════════════════════════════════ */}
        {view === "history" && (
          <div className="fade-up">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h2 className="step-title" style={{ marginBottom: 4 }}>What you’ve moved</h2>
                <p style={{ fontSize: 14, color: T.textMuted }}>{history.length === 0 ? "Nothing saved yet" : `${history.length} transfer${history.length === 1 ? "" : "s"} saved`}</p>
              </div>
              {history.length > 0 && (
                <button onClick={clearHistory} style={{ background: T.paper, border: `1px solid ${T.border}`, borderRadius: 999, padding: "7px 14px", color: T.bad, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}>
                  Clear All
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: T.textDim }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>Nothing moved yet</div>
                <div style={{ fontSize: 14, marginTop: 6, lineHeight: 1.5 }}>When you finish a transfer, it will wait here so you can look back.</div>
                <button onClick={() => setView("transfer")} className="btn-hover" style={{ marginTop: 16, background: `${accentColor}15`, border: `1px solid ${accentColor}33`, borderRadius: T.radiusSm, padding: "10px 24px", color: accentColor, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
                  Start a Transfer
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {history.map((h) => (
                  <div key={h.id} className="history-card card-hover" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}`, gap: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ color: PLATFORMS[h.source]?.color, width: 20 }}>{ICONS[h.source]}</div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textDim} strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
                        <div style={{ color: PLATFORMS[h.dest]?.color, width: 20 }}>{ICONS[h.dest]}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{h.playlists.length} playlist{h.playlists.length > 1 ? "s" : ""} · {h.totalTracks} tracks</div>
                        <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{fmtDate(new Date(h.date))}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <Badge color={T.ok}>{h.exact} found</Badge>
                      {h.fuzzy > 0 && <Badge color={T.warn}>{h.fuzzy} close</Badge>}
                      {h.missing > 0 && <Badge color={T.bad}>{h.missing} missing</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════
            IMPORT/EXPORT VIEW
            ═══════════════════════════════════════════ */}
        {view === "import" && (
          <div className="fade-up">
            <h2 className="step-title" style={{ marginBottom: 8 }}>Bring a file, or take one with you</h2>
            <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 24 }}>Backup, share, or migrate playlists using JSON or CSV files</p>

            {/* Export */}
            <div style={{ padding: 20, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Save a copy</div>
              <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>Download your playlists as a portable file format. Load playlists in Transfer first (connect a source and select playlists).</p>
              {playlists.length === 0 ? (
                <p style={{ fontSize: 12, color: T.textDim, padding: "12px 0" }}>No playlists loaded. Go to Transfer → choose a source and load playlists, then return here to export.</p>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => { setSelectedIds(playlists.map(p => p.id)); exportPlaylists("json"); }} className="btn-hover" style={{ background: `${accentColor}12`, border: `1.5px solid ${accentColor}33`, borderRadius: T.radiusSm, padding: "10px 20px", color: accentColor, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
                    Export All as JSON
                  </button>
                  <button onClick={() => { setSelectedIds(playlists.map(p => p.id)); exportPlaylists("csv"); }} className="btn-hover" style={{ background: T.surface, border: `1.5px solid ${T.borderLight}`, borderRadius: T.radiusSm, padding: "10px 20px", color: T.textMuted, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
                    Export All as CSV
                  </button>
                </div>
              )}
            </div>

            {/* Import */}
            <div style={{ padding: 20, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Open a file</div>
              <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>Upload a JSON or CSV file to import playlists into any platform</p>
              <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleImport} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} className="btn-hover" style={{ background: T.surfaceHover, border: `2px dashed ${T.borderLight}`, borderRadius: T.radiusSm, padding: "24px 20px", color: T.textMuted, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: T.font, width: "100%", transition: "all 0.2s ease" }}>
                Choose a JSON or CSV file
              </button>

              {importData && (
                <div className="fade-up" style={{ marginTop: 16 }}>
                  <div style={{ padding: "12px 16px", borderRadius: T.radiusSm, background: `${accentColor}0a`, border: `1px solid ${accentColor}1a` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.ok, marginBottom: 8 }}>
                      ✓ Loaded {importData.length} playlist{importData.length > 1 ? "s" : ""} from {importFormat.toUpperCase()}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {importData.map((pl, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: T.textMuted }}>
                          <span style={{ color: T.text, fontWeight: 500 }}>{pl.name}</span>
                          <span>{pl.tracks?.length ?? 0} tracks</span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => { setView("transfer"); setStep(1); setSource(availablePlatforms[0] || "spotify"); }}
                      className="btn-hover"
                      style={{ marginTop: 12, background: accentColor, border: "none", borderRadius: T.radiusSm, padding: "10px 24px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}
                    >
                      Transfer Imported Playlists →
                    </button>
                  </div>
                </div>
              )}

              {/* Format guide */}
              <div style={{ marginTop: 16, padding: 14, borderRadius: T.radiusSm, background: "rgba(0,0,0,0.02)", border: `1px solid ${T.border}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: T.textMuted, marginBottom: 8 }}>Supported file types</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 11, color: T.textDim }}>
                    <span style={{ color: accentColor, fontFamily: T.mono, fontWeight: 600 }}>JSON</span> — Your playlists and tracks in a standard format
                  </div>
                  <div style={{ fontSize: 11, color: T.textDim }}>
                    <span style={{ color: accentColor, fontFamily: T.mono, fontWeight: 600 }}>CSV</span> — Spreadsheet-style: Playlist, Track, Artist, Album
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, textAlign: "center", fontSize: 11, color: T.textDim, lineHeight: 1.6, paddingBottom: 24 }}>
          Your accounts stay signed in on this device. Nothing is stored on a StreamSwap server.
        </div>
      </div>

      {/* View on platform modal — shown after transfer completes */}
      {showViewOnPlatformModal && dest && PLATFORMS[dest] && DEST_VIEW_URLS[dest] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="view-on-platform-title"
          onClick={() => setShowViewOnPlatformModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.bg,
              borderRadius: 16,
              boxShadow: "0 24px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.06)",
              maxWidth: 400,
              width: "100%",
              overflow: "hidden",
              animation: "scaleIn 0.25s ease-out",
            }}
          >
            <div style={{ padding: "28px 24px 24px", textAlign: "center" }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: `${PLATFORMS[dest].color}18`,
                  border: `2px solid ${PLATFORMS[dest].color}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 20px",
                }}
              >
                {ICONS[dest]}
              </div>
              <h2 id="view-on-platform-title" style={{ fontSize: 18, fontWeight: 700, marginBottom: 8, color: T.text }}>
                View your playlists
              </h2>
              <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5, marginBottom: 24 }}>
                Your transfer is complete. Open <span style={{ color: PLATFORMS[dest].color, fontWeight: 600 }}>{PLATFORMS[dest].name}</span> to see your new playlists.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  href={DEST_VIEW_URLS[dest]}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setShowViewOnPlatformModal(false)}
                  className="btn-hover"
                  style={{
                    display: "block",
                    background: PLATFORMS[dest].color,
                    color: "#fff",
                    borderRadius: 10,
                    padding: "14px 20px",
                    fontSize: 14,
                    fontWeight: 700,
                    textDecoration: "none",
                    fontFamily: T.font,
                    transition: "all 0.2s ease",
                    boxShadow: `0 4px 14px ${PLATFORMS[dest].color}44`,
                  }}
                >
                  Open {PLATFORMS[dest].name} →
                </a>
                <button
                  type="button"
                  onClick={() => setShowViewOnPlatformModal(false)}
                  className="btn-hover"
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${T.border}`,
                    borderRadius: 10,
                    padding: "12px 20px",
                    fontSize: 13,
                    fontWeight: 600,
                    color: T.textMuted,
                    cursor: "pointer",
                    fontFamily: T.font,
                    transition: "all 0.2s ease",
                  }}
                >
                  Stay here
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deezer signup unavailable — when user clicks Deezer and no app is configured */}
      {showDeezerUnavailable && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="deezer-unavailable-title"
          onClick={() => setShowDeezerUnavailable(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.bg,
              borderRadius: 16,
              boxShadow: "0 24px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.06)",
              maxWidth: 360,
              width: "100%",
              overflow: "hidden",
              animation: "scaleIn 0.25s ease-out",
            }}
          >
            <div style={{ padding: "28px 24px 24px", textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: `${PLATFORMS.deezer.color}18`,
                  border: `2px solid ${PLATFORMS.deezer.color}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                {ICONS.deezer}
              </div>
              <h2 id="deezer-unavailable-title" style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: T.text }}>
                Deezer signup temporarily unavailable
              </h2>
              <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5, marginBottom: 20 }}>
                You can't connect Deezer right now. Check back later.
              </p>
              <button
                type="button"
                onClick={() => setShowDeezerUnavailable(false)}
                className="btn-hover"
                style={{
                  width: "100%",
                  background: PLATFORMS.deezer.color,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: T.font,
                  transition: "all 0.2s ease",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform not configured — when user clicks a platform that has no credentials */}
      {unavailablePlatform && PLATFORMS[unavailablePlatform] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unavailable-platform-title"
          onClick={() => setUnavailablePlatform(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 24,
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.bg,
              borderRadius: 16,
              boxShadow: "0 24px 48px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.06)",
              maxWidth: 360,
              width: "100%",
              overflow: "hidden",
              animation: "scaleIn 0.25s ease-out",
            }}
          >
            <div style={{ padding: "28px 24px 24px", textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: `${PLATFORMS[unavailablePlatform].color}18`,
                  border: `2px solid ${PLATFORMS[unavailablePlatform].color}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                {ICONS[unavailablePlatform]}
              </div>
              <h2 id="unavailable-platform-title" style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: T.text }}>
                {unavailablePlatform === "apple" ? `${PLATFORMS[unavailablePlatform].name} isn't configured` : `${PLATFORMS[unavailablePlatform].name} isn't available right now`}
              </h2>
              <p style={{ fontSize: 14, color: T.textMuted, lineHeight: 1.5, marginBottom: 20 }}>
                {unavailablePlatform === "apple" ? "This service isn't available right now." : unavailablePlatform === "tidal" ? "To use Tidal, it needs to be enabled first. Try Spotify, YouTube Music, or Deezer in the meantime." : "We can't connect to this service at the moment. Try again later."}
              </p>
              <button
                type="button"
                onClick={() => setUnavailablePlatform(null)}
                className="btn-hover"
                style={{
                  width: "100%",
                  background: PLATFORMS[unavailablePlatform].color,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: T.font,
                  transition: "all 0.2s ease",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
