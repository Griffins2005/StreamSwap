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

// ── Song Matching Engine ──────────────────────────────
function normalizeStr(s) {
  return s
    .toLowerCase()
    .replace(/\(feat\.?.*?\)/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

// ── Duplicate Detection ──────────────────────────────
function findDuplicates(playlists) {
  const seen = new Map();
  const dupes = [];
  for (const pl of playlists) {
    for (const t of pl.tracks) {
      const key = normalizeStr(`${t.title}|${t.artist}`);
      if (seen.has(key)) {
        dupes.push({ track: t, playlist: pl.name, existsIn: seen.get(key) });
      } else {
        seen.set(key, pl.name);
      }
    }
  }
  return dupes;
}

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
  bg: "#fafaf8",
  surface: "rgba(0,0,0,0.03)",
  surfaceHover: "rgba(0,0,0,0.06)",
  border: "rgba(0,0,0,0.08)",
  borderLight: "rgba(0,0,0,0.12)",
  text: "#1c1c1e",
  textMuted: "rgba(0,0,0,0.55)",
  textDim: "rgba(0,0,0,0.4)",
  radius: 14,
  radiusSm: 10,
  font: "'Outfit', sans-serif",
  mono: "'JetBrains Mono', monospace",
  accent: "#7C3AED",
};

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 3px; }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(-8px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes glow { 0%, 100% { box-shadow: 0 0 20px var(--glow-color, rgba(124,58,237,0.2)); } 50% { box-shadow: 0 0 40px var(--glow-color, rgba(124,58,237,0.35)); } }
  @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
  .fade-up { animation: fadeUp 0.4s ease both; }
  .stagger-1 { animation-delay: 0.05s; }
  .stagger-2 { animation-delay: 0.1s; }
  .stagger-3 { animation-delay: 0.15s; }
  .stagger-4 { animation-delay: 0.2s; }
  .btn-hover:hover { filter: brightness(0.97); transform: translateY(-1px); }
  .card-hover:hover { border-color: rgba(0,0,0,0.12) !important; background: rgba(0,0,0,0.04) !important; }
  .track-row:hover { background: rgba(0,0,0,0.03) !important; }
  
  @media (max-width: 640px) {
    .platform-grid { grid-template-columns: repeat(3, 1fr) !important; }
    .nav-buttons { flex-direction: column-reverse; }
    .nav-buttons button { width: 100%; }
    .track-header-row { display: none !important; }
    .track-detail-row { grid-template-columns: auto 1fr auto !important; }
    .track-detail-row .col-album, .track-detail-row .col-dur { display: none; }
    .history-card { flex-direction: column !important; align-items: flex-start !important; }
    .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .header-row { flex-direction: column; gap: 12px !important; }
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
        background: active ? `${color}20` : T.surface,
        border: `1.5px solid ${active ? `${color}55` : T.border}`,
        borderRadius: 20,
        padding: "6px 14px",
        color: active ? color : T.textMuted,
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
        borderRadius: 6,
        background: `${color}18`,
        color: color,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: T.mono,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
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
        background: selected ? `linear-gradient(145deg, ${p.color}15, ${p.color}08)` : T.surface,
        border: `2px solid ${selected ? p.color : T.border}`,
        borderRadius: T.radius,
        padding: "20px 14px",
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
      {selected && (
        <div style={{ position: "absolute", inset: 0, background: `radial-gradient(circle at 50% -20%, ${p.color}12, transparent 70%)`, pointerEvents: "none" }} />
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{ICONS[id]}</div>
      <span style={{ fontFamily: T.font, fontWeight: 600, fontSize: 12, letterSpacing: "0.01em", position: "relative", zIndex: 1 }}>{p.name}</span>
      {connected ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", zIndex: 1 }}>
          <Badge color="#4ade80">Connected</Badge>
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
              onMouseOver={(e) => { e.currentTarget.style.color = "#ef4444"; }}
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
        <div style={{ position: "absolute", top: 7, right: 7, width: 18, height: 18, borderRadius: "50%", background: p.color, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
      )}
    </div>
  );
}

function TrackRow({ track, matchResult, index, accentColor, showMatch }) {
  const conf = matchResult?.confidence ?? 0;
  const confColor = conf >= 0.85 ? "#4ade80" : conf >= 0.6 ? "#fbbf24" : "#ef4444";
  const confLabel = conf >= 0.85 ? "Exact" : conf >= 0.6 ? "Fuzzy" : "Missing";
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
        animation: `slideIn 0.2s ease ${index * 0.02}s both`,
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
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth={stroke} />
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

  // History (persistent)
  const [history, setHistory] = useState([]);
  const historyRef = useRef(history);
  historyRef.current = history;
  const [historyLoading, setHistoryLoading] = useState(true);

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

  // Load history from persistent storage
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("transfer-history");
        if (result?.value) setHistory(JSON.parse(result.value));
      } catch (e) {}
      setHistoryLoading(false);
    })();
  }, []);

  // Save history
  const saveHistory = async (h) => {
    setHistory(h);
    try { await window.storage.set("transfer-history", JSON.stringify(h)); } catch (e) {}
  };

  // Show all platforms; those without credentials show an "unavailable" modal when clicked
  const availablePlatforms = useMemo(() => ["spotify", "youtube", "tidal", "deezer", "apple"], []);

  const accentColor = dest ? PLATFORMS[dest]?.color : source ? PLATFORMS[source]?.color : T.accent;
  const selectedPlaylists = playlists.filter((p) => selectedIds.includes(p.id));
  const totalTracks = selectedPlaylists.reduce((a, p) => a + ((p.tracks?.length > 0 ? p.tracks.length : null) ?? p.trackCount ?? 0), 0);
  const duplicates = useMemo(() => findDuplicates(selectedPlaylists), [selectedPlaylists]);

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
          setTransferLog((prev) => [...prev, { type: "done", text: "No tracks to transfer." }]);
          setMatchResults({});
          setLastTransferPlaylists(playlistsWithTracks);
          setStep(5);
          return;
        }
        let processed = 0;
        const allResults = {};
        for (const pl of playlistsWithTracks) {
          setCurrentPlaylist(pl.name);
          setTransferLog((prev) => [...prev, { type: "header", text: `Creating playlist on ${PLATFORMS[dest].name}: "${pl.name}"` }]);
          setCurrentTrack("Creating playlist...");
          let destPlaylistId;
          if (dest === "spotify") {
            const profile = await getSpotifyUserProfile(currentDestToken);
            destPlaylistId = await createSpotifyPlaylist(currentDestToken, profile.id, pl.name, "Transferred via StreamSwap");
          } else if (dest === "youtube") {
            try {
              destPlaylistId = await createYouTubePlaylist(currentDestToken, pl.name, "Transferred via StreamSwap");
            } catch (ytErr) {
              const is401 = String(ytErr?.message || "").includes("401") || String(ytErr?.message || "").includes("Token expired") || String(ytErr?.message || "").includes("Sign out");
              if (is401) {
                const fresh = await getValidYouTubeToken(getToken("youtube"));
                if (fresh) {
                  setToken("youtube", fresh);
                  currentDestToken = fresh.accessToken;
                  destPlaylistId = await createYouTubePlaylist(currentDestToken, pl.name, "Transferred via StreamSwap");
                } else throw ytErr;
              } else throw ytErr;
            }
          } else if (dest === "tidal") {
            destPlaylistId = await createTidalPlaylist(currentDestToken, pl.name, "Transferred via StreamSwap");
          } else if (dest === "deezer") {
            destPlaylistId = await createDeezerPlaylist(currentDestToken, pl.name, "Transferred via StreamSwap");
          }
          const spotifyUris = [];
          const youtubeVideoIds = [];
          const tidalTrackIds = [];
          const deezerTrackIds = [];
          for (let i = 0; i < (pl.tracks || []).length; i++) {
            const track = pl.tracks[i];
            setCurrentTrack(`${track.title} — ${track.artist}`);
            let match = null;
            if (dest === "spotify") {
              match = await searchSpotifyTrack(currentDestToken, track.title, track.artist, track.isrc || null);
              if (match?.uri) spotifyUris.push(match.uri);
            } else if (dest === "youtube") {
              match = await searchYouTubeTrack(currentDestToken, track.title, track.artist);
              if (match?.videoId) youtubeVideoIds.push(match.videoId);
            } else if (dest === "tidal") {
              match = await searchTidalTrack(currentDestToken, track.title, track.artist, track.isrc || null);
              if (match?.id) tidalTrackIds.push(match.id);
            } else if (dest === "deezer") {
              match = await searchDeezerTrack(currentDestToken, track.title, track.artist);
              if (match?.id) deezerTrackIds.push(match.id);
            }
            const confidence = match ? (match.confidence ?? 0.85) : 0;
            const tid = track.id || track.videoId || track.title;
            allResults[tid] = { match: match ? { ...track } : null, confidence, method: match?.method || "none" };
            processed++;
            setProgress(15 + Math.round((processed / total) * 85));
            setMatchResults((prev) => ({ ...prev, [tid]: { match: match ? { ...track } : null, confidence, method: match?.method || "none" } }));
            if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
          }
          if (dest === "spotify" && spotifyUris.length > 0) await addTracksToSpotifyPlaylist(currentDestToken, destPlaylistId, spotifyUris);
          if (dest === "youtube" && youtubeVideoIds.length > 0) await addTracksToYouTubePlaylist(currentDestToken, destPlaylistId, youtubeVideoIds);
          if (dest === "tidal" && tidalTrackIds.length > 0) await addTracksToTidalPlaylist(currentDestToken, destPlaylistId, tidalTrackIds);
          if (dest === "deezer" && deezerTrackIds.length > 0) await addTracksToDeezerPlaylist(currentDestToken, destPlaylistId, deezerTrackIds);
          const exactCount = (pl.tracks || []).filter((t) => (allResults[t.id || t.videoId || t.title]?.confidence ?? 0) >= 0.85).length;
          setTransferLog((prev) => [...prev, { type: "done", text: `✓ "${pl.name}" — ${exactCount}/${(pl.tracks || []).length} matched` }]);
        }
        setTransferLog((prev) => [...prev, { type: "done", text: "Transfer complete." }]);
        const exact = Object.values(allResults).filter((r) => r.confidence >= 0.85).length;
        const fuzzy = Object.values(allResults).filter((r) => r.confidence >= 0.6 && r.confidence < 0.85).length;
        const missing = Object.values(allResults).filter((r) => r.confidence < 0.6).length;
        await saveHistory([{ id: `h-${Date.now()}`, date: new Date().toISOString(), source, dest, playlists: playlistsWithTracks.map((p) => p.name), totalTracks, exact, fuzzy, missing }, ...historyRef.current]);
        setMatchResults(allResults);
        setLastTransferPlaylists(playlistsWithTracks);
        setStep(5);
        setShowViewOnPlatformModal(true);
      } catch (err) {
        let msg = err?.message != null ? String(err.message) : String(err);
        if (msg.startsWith("SPOTIFY_NEED_PERMISSION")) {
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
  }, [source, dest, selectedPlaylists, publicImportPlaylist, getToken, setToken, isConnected]);

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
        const text = ev.target.result;
        if (file.name.endsWith(".json")) {
          setImportData(JSON.parse(text));
          setImportFormat("json");
        } else {
          // Parse CSV
          const lines = text.split("\n").filter(Boolean);
          const playlists = {};
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)?.map((c) => c.replace(/^"|"$/g, ""));
            if (!cols || cols.length < 4) continue;
            const [plName, title, artist, album] = cols;
            if (!playlists[plName]) playlists[plName] = { name: plName, tracks: [] };
            playlists[plName].tracks.push({ title, artist, album });
          }
          setImportData(Object.values(playlists));
          setImportFormat("csv");
        }
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

  const clearHistory = async () => {
    setHistory([]);
    try { await window.storage.delete("transfer-history"); } catch (e) {}
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

      {/* Ambient glow */}
      <div style={{ position: "fixed", inset: 0, background: `radial-gradient(ellipse at 25% 15%, ${accentColor}18 0%, transparent 50%), radial-gradient(ellipse at 75% 85%, ${accentColor}0c 0%, transparent 50%)`, pointerEvents: "none", transition: "background 0.8s ease" }} />

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 16px", position: "relative", zIndex: 1 }}>

        {/* ── HEADER ── */}
        <div className="header-row" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 11, background: `linear-gradient(135deg, ${accentColor}, #6D28D9)`, display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.4s ease" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div>
              <h1 style={{ fontFamily: T.mono, fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em", lineHeight: 1.2 }}>StreamSwap</h1>
              <p style={{ fontSize: 11, color: T.textDim, fontWeight: 500 }}>Move music between platforms</p>
            </div>
          </div>

          {/* Nav tabs */}
          <div style={{ display: "flex", gap: 4, background: T.surface, borderRadius: 10, padding: 3, border: `1px solid ${T.border}` }}>
            {[
              { id: "transfer", label: "Transfer", icon: "↔" },
              { id: "history", label: "History", icon: "⏱" },
              { id: "import", label: "Import/Export", icon: "📁" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setView(tab.id); if (tab.id === "transfer" && step > 5) reset(); }}
                style={{
                  background: view === tab.id ? `${accentColor}18` : "transparent",
                  border: view === tab.id ? `1px solid ${accentColor}33` : "1px solid transparent",
                  borderRadius: 8,
                  padding: "7px 14px",
                  color: view === tab.id ? accentColor : T.textMuted,
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: T.font,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════
            TRANSFER VIEW
            ═══════════════════════════════════════════ */}
        {view === "transfer" && (
          <>
            {/* Step indicator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 32 }}>
              {["Source", "Destination", "Playlists", "Review", "Transfer", "Done"].map((label, i) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%",
                    background: i < step ? accentColor : i === step ? `${accentColor}22` : T.surface,
                    border: i === step ? `2px solid ${accentColor}` : i < step ? `2px solid ${accentColor}` : `2px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, fontFamily: T.mono,
                    color: i < step ? "#fff" : i === step ? accentColor : T.textDim,
                    transition: "all 0.3s ease",
                  }}>
                    {i < step ? "✓" : i + 1}
                  </div>
                  {i < 5 && <div style={{ width: 20, height: 2, borderRadius: 1, background: i < step ? accentColor : T.border, transition: "all 0.3s ease" }} />}
                </div>
              ))}
            </div>

            {/* ── STEP 0: Source ── */}
            {step === 0 && (
              <div className="fade-up">
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Where are your playlists?</h2>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Select the source platform. Connect your account to fetch real playlists.</p>
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
                    🔗 Click the {PLATFORMS[source].name} card above to sign in.
                  </div>
                )}
                <div className="fade-up" style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${T.border}` }}>
                  <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 10 }}>Or paste a public playlist link (Spotify, YouTube, or Deezer) to copy it to another platform.</p>
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
                        background: (publicImportLoading || !publicImportUrl.trim()) ? T.border : `linear-gradient(135deg, ${accentColor}, #6D28D9)`,
                        color: (publicImportLoading || !publicImportUrl.trim()) ? T.textDim : "#fff", cursor: (publicImportLoading || !publicImportUrl.trim()) ? "not-allowed" : "pointer",
                      }}
                    >
                      {publicImportLoading ? "Loading…" : "Load playlist"}
                    </button>
                  </div>
                  {publicImportError && <p style={{ fontSize: 12, color: "#e74c3c", marginTop: 8 }}>{publicImportError}</p>}
                </div>
              </div>
            )}

            {/* ── STEP 1: Destination ── */}
            {step === 1 && (
              <div className="fade-up">
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Where should they go?</h2>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>Choose the destination platform for your playlists.</p>
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
                  <h2 style={{ fontSize: 17, fontWeight: 700 }}>Select playlists</h2>
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
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Review & Confirm</h2>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 20 }}>
                  Transferring {selectedIds.length} playlist{selectedIds.length > 1 ? "s" : ""} ({totalTracks} tracks) from <span style={{ color: PLATFORMS[source].color, fontWeight: 600 }}>{PLATFORMS[source].name}</span> → <span style={{ color: PLATFORMS[dest].color, fontWeight: 600 }}>{PLATFORMS[dest].name}</span>
                </p>

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
                    { label: "Playlists", value: selectedIds.length, icon: "📋" },
                    { label: "Total Tracks", value: totalTracks, icon: "🎵" },
                    { label: "Duplicates Found", value: duplicates.length, icon: "🔄" },
                  ].map((s) => (
                    <div key={s.label} style={{ padding: "16px 14px", borderRadius: T.radiusSm, background: T.surface, border: `1px solid ${T.border}`, textAlign: "center" }}>
                      <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
                      <div style={{ fontFamily: T.mono, fontSize: 22, fontWeight: 700, color: accentColor }}>{s.value}</div>
                      <div style={{ fontSize: 11, color: T.textDim, fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Duplicates section */}
                {duplicates.length > 0 && (
                  <div style={{ marginBottom: 20, padding: 16, borderRadius: T.radius, background: "rgba(251, 191, 36, 0.05)", border: "1px solid rgba(251, 191, 36, 0.15)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#fbbf24" }}>⚠ {duplicates.length} Duplicate Tracks</div>
                        <div style={{ fontSize: 12, color: T.textMuted, marginTop: 2 }}>Tracks appearing in multiple selected playlists</div>
                      </div>
                      <button onClick={() => setShowDuplicates(!showDuplicates)} style={{ background: "none", border: "none", color: "#fbbf24", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: T.font }}>
                        {showDuplicates ? "Hide" : "Show"} details
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: 6, marginBottom: showDuplicates ? 12 : 0 }}>
                      {[
                        { id: "skip", label: "Skip duplicates" },
                        { id: "keep", label: "Keep all copies" },
                        { id: "merge", label: "Merge into one" },
                      ].map((opt) => (
                        <Chip key={opt.id} color="#fbbf24" active={dupAction === opt.id} onClick={() => setDupAction(opt.id)}>{opt.label}</Chip>
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
                  <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Matching & transferring</h2>
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
                    <div key={i} style={{ fontSize: 11, fontFamily: T.mono, color: log.type === "done" ? "#4ade80" : log.type === "header" ? accentColor : log.type === "error" ? "#ef4444" : T.textMuted, padding: "3px 0", fontWeight: log.type === "header" ? 600 : 400 }}>
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
                      style={{ background: `linear-gradient(135deg, ${accentColor}, #6D28D9)`, border: "none", borderRadius: T.radius, padding: "12px 24px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}
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

                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>Transfer Complete!</h2>
                <p style={{ fontSize: 13, color: T.textMuted, marginBottom: 24, lineHeight: 1.6 }}>
                  {selectedIds.length} playlist{selectedIds.length > 1 ? "s" : ""} moved from <span style={{ color: PLATFORMS[source].color, fontWeight: 600 }}>{PLATFORMS[source].name}</span> to <span style={{ color: PLATFORMS[dest].color, fontWeight: 600 }}>{PLATFORMS[dest].name}</span>
                </p>

                {/* Match stats */}
                <div className="stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 24, maxWidth: 480, margin: "0 auto 24px" }}>
                  {[
                    { label: "Total", value: matchStats.total, color: T.text },
                    { label: "Exact Match", value: matchStats.exact, color: "#4ade80" },
                    { label: "Fuzzy Match", value: matchStats.fuzzy, color: "#fbbf24" },
                    { label: "Not Found", value: matchStats.missing, color: "#ef4444" },
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
                            <Badge color="#4ade80">{exact}</Badge>
                            {fuzzy > 0 && <Badge color="#fbbf24">{fuzzy}</Badge>}
                            {missing > 0 && <Badge color="#ef4444">{missing}</Badge>}
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
                    background: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? `linear-gradient(135deg, ${accentColor}, #6D28D9)` : T.surface,
                    border: "none", borderRadius: T.radius, padding: "12px 28px",
                    color: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? "#fff" : T.textDim,
                    fontSize: 13, fontWeight: 700, cursor: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? "pointer" : "not-allowed",
                    fontFamily: T.font, transition: "all 0.3s ease",
                    boxShadow: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? `0 4px 20px ${accentColor}33` : "none",
                    opacity: (step === 0 ? source : step === 1 ? dest : selectedIds.length > 0) ? 1 : 0.5,
                  }}
                >
                  {step === 3 ? `Start Transfer →` : step === 2 ? `Review ${selectedIds.length} Playlist${selectedIds.length !== 1 ? "s" : ""} →` : "Continue →"}
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
                <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 2 }}>Transfer History</h2>
                <p style={{ fontSize: 12, color: T.textMuted }}>{history.length} past transfer{history.length !== 1 ? "s" : ""} saved</p>
              </div>
              {history.length > 0 && (
                <button onClick={clearHistory} style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, padding: "6px 14px", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: T.font }}>
                  Clear All
                </button>
              )}
            </div>

            {historyLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: T.textDim }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${T.border}`, borderTopColor: accentColor, borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 48, color: T.textDim }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>No transfers yet</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Your transfer history will appear here</div>
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
                      <Badge color="#4ade80">{h.exact} exact</Badge>
                      {h.fuzzy > 0 && <Badge color="#fbbf24">{h.fuzzy} fuzzy</Badge>}
                      {h.missing > 0 && <Badge color="#ef4444">{h.missing} missing</Badge>}
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
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 4 }}>Import & Export</h2>
            <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 24 }}>Backup, share, or migrate playlists using JSON or CSV files</p>

            {/* Export */}
            <div style={{ padding: 20, borderRadius: T.radius, background: T.surface, border: `1px solid ${T.border}`, marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📤 Export Playlists</div>
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
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>📥 Import Playlists</div>
              <p style={{ fontSize: 12, color: T.textMuted, marginBottom: 14 }}>Upload a JSON or CSV file to import playlists into any platform</p>
              <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={handleImport} style={{ display: "none" }} />
              <button onClick={() => fileInputRef.current?.click()} className="btn-hover" style={{ background: T.surfaceHover, border: `2px dashed ${T.borderLight}`, borderRadius: T.radiusSm, padding: "24px 20px", color: T.textMuted, fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: T.font, width: "100%", transition: "all 0.2s ease" }}>
                📂 Click to choose a file (.json or .csv)
              </button>

              {importData && (
                <div className="fade-up" style={{ marginTop: 16 }}>
                  <div style={{ padding: "12px 16px", borderRadius: T.radiusSm, background: `${accentColor}0a`, border: `1px solid ${accentColor}1a` }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#4ade80", marginBottom: 8 }}>
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
                      style={{ marginTop: 12, background: `linear-gradient(135deg, ${accentColor}, #6D28D9)`, border: "none", borderRadius: T.radiusSm, padding: "10px 24px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: T.font }}
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
          Connect your music accounts to move playlists between services.
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
