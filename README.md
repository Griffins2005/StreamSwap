<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="StreamSwap Logo" />
</p>

<h1 align="center">StreamSwap</h1>

<p align="center">
  <strong>Transfer playlists between Spotify, Apple Music, YouTube Music, Tidal, and Deezer.</strong><br/>
  Smart song matching · Duplicate detection · Import/Export · Transfer history
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/license-MIT-green?style=flat-square" alt="License" />
  <img src="https://img.shields.io/badge/react-18-61dafb?style=flat-square&logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/vite-5-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite 5" />
</p>

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Demo Walkthrough](#demo-walkthrough)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [API Setup Guides](#api-setup-guides)
  - [Spotify](#spotify)
  - [Apple Music](#apple-music)
  - [YouTube Music](#youtube-music)
  - [Tidal & Deezer](#tidal--deezer)
- [Project Structure](#project-structure)
- [Architecture](#architecture)
  - [Authentication Flow](#authentication-flow)
  - [Song Matching Engine](#song-matching-engine)
  - [Transfer Pipeline](#transfer-pipeline)
  - [Duplicate Detection](#duplicate-detection)
  - [Persistent Storage](#persistent-storage)
- [API Reference](#api-reference)
  - [spotify.js](#spotifyjs)
  - [youtube.js](#youtubejs)
  - [apple-music.js](#apple-musicjs)
  - [matching.js](#matchingjs)
  - [import-export.js](#import-exportjs)
- [Import/Export Formats](#importexport-formats)
- [UI Components](#ui-components)
- [Customization](#customization)
- [Deployment](#deployment)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

StreamSwap is a client-side web application that transfers playlists between music streaming platforms. It connects to each platform's API via OAuth, reads your playlists and tracks, matches songs across catalogs using ISRC codes and fuzzy text matching, and recreates your playlists on the destination platform.

The entire app runs in the browser — there is no backend server. Authentication uses OAuth 2.0 with PKCE (Proof Key for Code Exchange), which means your credentials and tokens never touch a third-party server.

### Spotify ↔ YouTube (both directions)

With **Spotify** and **YouTube Music** configured (both free), you can:

- **Spotify → YouTube:** Choose Spotify as source, YouTube as destination. Sign in to both. Your Spotify playlists load; select the ones to move. The app creates matching playlists on YouTube and adds found tracks (search by title + artist).
- **YouTube → Spotify:** Choose YouTube as source, Spotify as destination. Your YouTube playlists load; select them. The app creates playlists on Spotify and adds matched tracks (ISRC when available, then title+artist search).

The same flow applies in either direction. Only platforms you have configured in `.env` appear in the app.

---

## Features

### Core Transfer
- **5 Platforms** — Spotify, Apple Music, YouTube Music, Tidal, Deezer
- **Bidirectional** — Transfer in either direction between any supported pair
- **Batch Transfer** — Select multiple playlists and transfer them all at once
- **Real-Time Progress** — Live progress bar, current track display, and transfer log

### Smart Song Matching
- **ISRC Matching** — Uses the International Standard Recording Code for guaranteed exact matches (100% confidence)
- **Fuzzy Matching** — Levenshtein distance algorithm on normalized title + artist strings when ISRC is unavailable
- **Duration Validation** — Cross-checks track duration as a tiebreaker (±5 second tolerance)
- **Weighted Scoring** — Title (55%) + Artist (35%) + Duration (10%) composite score
- **String Normalization** — Strips feat./ft. tags, bracket annotations, special characters, and smart quotes before comparison
- **Confidence Classification** — Every track gets an Exact (≥88%), Fuzzy (60-87%), or Missing (<60%) badge

### Track-Level Detail
- **Expandable Playlists** — Click any playlist to see every track with title, artist, album, and duration
- **Per-Track Match Status** — After transfer, each track shows its match confidence and method (ISRC / title+artist / fuzzy / none)
- **Column Headers** — Sortable track number, title, album, and duration columns
- **Per-Playlist Summary** — Breakdown of exact/fuzzy/missing counts per playlist

### Duplicate Detection
- **Cross-Playlist Scanning** — Detects the same track appearing in multiple selected playlists
- **Normalized Comparison** — Matches duplicates even with slightly different metadata
- **Three Resolution Strategies:**
  - **Skip** — Transfer each unique track only once
  - **Keep** — Transfer all copies (preserves playlist structure)
  - **Merge** — Combine overlapping playlists into one
- **Detail View** — Expandable list showing each duplicate, which playlists it appears in

### Transfer History
- **Persistent Storage** — History survives across browser sessions
- **Per-Transfer Stats** — Source, destination, playlist names, total tracks, exact/fuzzy/missing counts
- **Timestamped** — Each entry records the date and time
- **Max 50 Entries** — Oldest entries auto-pruned
- **Clear All** — One-click history reset

### Import/Export
- **JSON Export** — Full playlist data with track metadata and ISRC codes
- **CSV Export** — Spreadsheet-friendly format (Playlist, Track, Artist, Album, Duration, ISRC)
- **JSON Import** — Load playlists from JSON files (compatible with StreamSwap export format)
- **CSV Import** — Load from CSV with auto-format detection
- **Auto-Detect** — File parser identifies format from extension or content
- **Transfer Imported Data** — Imported playlists can be transferred to any connected platform

### Design & UX
- **Milk White Theme** — Off-white (#fafaf8) background with purple (#7C3AED) accents
- **Responsive Layout** — Adapts from desktop to mobile with grid reflow, hidden columns, and stacked navigation
- **Animated Transitions** — fadeUp, slideIn, spin, and glow CSS animations
- **Platform-Aware Colors** — UI accent color changes based on selected source/destination (Spotify green, Apple red, YouTube red, Tidal cyan, Deezer purple)
- **Step Indicator** — Visual progress through the 6-step transfer flow
- **Typography** — Outfit (display) + JetBrains Mono (monospace/data)
- **Micro-Interactions** — Hover states, checkbox animations, expand/collapse transitions

---

## Demo Walkthrough

StreamSwap ships with mock data so you can explore the full UI without connecting any API:

1. **Choose Source** — Pick a platform (e.g., Spotify). Simulates OAuth connection.
2. **Choose Destination** — Pick where playlists should go (e.g., Apple Music). Source is auto-disabled.
3. **Select Playlists** — 8 mock playlists with realistic track data. Select/deselect individually or all at once. Expand any playlist to browse tracks.
4. **Review & Confirm** — See summary stats, duplicate detection results, and choose a duplicate resolution strategy.
5. **Transfer** — Watch the real-time matching engine process each track with ISRC + fuzzy matching. See the live log and progress ring.
6. **Results** — Per-playlist breakdown with expandable track-level match confidence. View exact/fuzzy/missing totals.

---

## Quick Start

### Prerequisites
- **Node.js** 18+ ([download](https://nodejs.org/))
- **npm** 9+ (included with Node.js)
- A **Spotify** (or YouTube) developer account for real API access — both are **free**. Apple Music is optional and requires a paid Apple Developer account ($99/year).

### Install & Run

```bash
# Clone the repository
git clone https://github.com/yourname/streamswap.git
cd streamswap

# Install dependencies
npm install

# Create your environment file
cp .env.example .env

# Start the dev server (from the project folder that contains package.json)
npm run dev
```

When the server starts, the terminal will show something like `Local: http://localhost:3000/`. Open the app in your browser using **either**:

- **http://localhost:3000**  
- **http://127.0.0.1:3000**

Both point to the same app. If one does not load, try the other. Keep the terminal running while you use the app.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |

---

## Environment Variables

The app only shows platforms you have configured. **You can run the full project for free** with just **Spotify** (and optionally **YouTube Music**); no need to pay for Apple. Add only the credentials you have.

Create a `.env` file in the project root (copy from `.env.example`):

```env
# ── Spotify ──────────────────────────────────
# Get from https://developer.spotify.com/dashboard
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_REDIRECT_URI=http://127.0.0.1:3000/callback/spotify

# ── Apple Music ──────────────────────────────
# Get from https://developer.apple.com/musickit/
APPLE_MUSIC_DEVELOPER_TOKEN=your_apple_developer_token_here

# ── YouTube Music (Google OAuth) ─────────────
# Get from https://console.cloud.google.com/
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/callback/youtube
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# ── Tidal (optional) ────────────────────────
# Get from https://developer.tidal.com/dashboard
TIDAL_CLIENT_ID=
TIDAL_REDIRECT_URI=http://127.0.0.1:3000/callback/tidal

# ── Deezer (optional, stub only) ────────────
DEEZER_APP_ID=
DEEZER_REDIRECT_URI=http://127.0.0.1:3000/callback/deezer
```

> **Security Note:** These are *client-side* credentials only. The PKCE flow means no client secret is ever stored in the frontend. Never commit your `.env` file — it is already in `.gitignore`.

---

## API Setup Guides

### Spotify

Spotify is the primary integration and uses OAuth 2.0 with PKCE (no backend required).

1. Go to the **[Spotify Developer Dashboard](https://developer.spotify.com/dashboard)**
2. Click **Create App**
3. Fill in:

   | Field | Value |
   |-------|-------|
   | App name | `StreamSwap` |
   | App description | `Playlist transfer tool for moving music between streaming platforms` |
   | Website | *(optional)* Your domain or leave blank |
   | Redirect URI | `http://127.0.0.1:3000/callback/spotify` |
   | APIs/SDKs | ✅ **Web API** |

4. Accept the Developer Terms of Service
5. Click **Save**
6. Copy the **Client ID** from the app settings page
7. Paste it into your `.env` file:
   ```
   SPOTIFY_CLIENT_ID=abc123def456...
   ```

**Scopes requested:**

| Scope | Purpose |
|-------|---------|
| `playlist-read-private` | Read user's private playlists |
| `playlist-read-collaborative` | Read collaborative playlists |
| `playlist-modify-public` | Create public playlists on destination |
| `playlist-modify-private` | Create private playlists on destination |
| `user-library-read` | Access saved/liked tracks |

**Redirect URI (Spotify):** Spotify no longer allows `localhost`; use the loopback IP: `http://127.0.0.1:3000/callback/spotify`. In the Dashboard, add exactly this URI (not `http://localhost:...`). For production, use HTTPS.

### Apple Music

Apple Music uses MusicKit JS which requires a Developer Token (JWT).

**Full step-by-step (including team account):** see **[docs/APPLE_MUSIC_TEAM_SETUP.md](docs/APPLE_MUSIC_TEAM_SETUP.md)**. To generate the token after you have the key and .p8 file, run: `npm run apple-token`.

Quick outline:

1. Go to **[Apple Developer](https://developer.apple.com/account)** (switch to your **team** in the top-left)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Under **Keys**, create a new key with **MusicKit** enabled
4. Download the `.p8` private key file
5. Note your **Key ID** and **Team ID**
6. Generate a JWT Developer Token:

   ```javascript
   // Use a tool like node-jose or jsonwebtoken
   const jwt = require('jsonwebtoken');
   const fs = require('fs');

   const privateKey = fs.readFileSync('AuthKey_XXXXXXXXXX.p8');
   const token = jwt.sign({}, privateKey, {
     algorithm: 'ES256',
     expiresIn: '180d',
     issuer: 'YOUR_TEAM_ID',
     header: {
       alg: 'ES256',
       kid: 'YOUR_KEY_ID'
     }
   });

   console.log(token);
   ```

7. Paste the generated JWT into `.env`:
   ```
   APPLE_MUSIC_DEVELOPER_TOKEN=eyJhbGciOiJFUzI1NiIs...
   ```

**Important:** Developer tokens expire (max 180 days). You'll need to regenerate periodically.

### YouTube Music

YouTube Music uses the **YouTube Data API v3** with Google OAuth 2.0 (PKCE; client secret optional).

1. Go to **[Google Cloud Console](https://console.cloud.google.com/)**
2. Create a new project or select an existing one (top bar).
3. **Enable the API:**  
   - Go to **APIs & Services → Library** ([direct link](https://console.cloud.google.com/apis/library))  
   - Search for **YouTube Data API v3**  
   - Open it and click **Enable**
4. **OAuth consent screen (if not done):**  
   - **APIs & Services → OAuth consent screen**  
   - Choose **External** (or Internal for workspace), add app name, support email, and add your email as test user if External
5. **Data Access (scopes):**  
   - In the same OAuth consent screen, open **Data Access** in the left sidebar.  
   - Click **Add or remove scopes**, find **YouTube Data API v3**, and add the scope that manages your YouTube account (e.g. **See, edit, and permanently delete your YouTube videos, ratings, comments and captions** — or the one that includes creating playlists). Save. Without this, the app cannot create or modify playlists.
6. **Create OAuth client:**  
   - **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**  
   - Application type: **Web application**  
   - Under **Authorized redirect URIs** add: `http://127.0.0.1:3000/callback/youtube`  
   - Create and copy the **Client ID**
7. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
   GOOGLE_REDIRECT_URI=http://127.0.0.1:3000/callback/youtube
   GOOGLE_CLIENT_SECRET=GOCSPX-...
   ```
   (Client ID and secret from the OAuth 2.0 client in Credentials.)

**Note:** For production, add your live URL to the OAuth client’s redirect URIs and set `GOOGLE_REDIRECT_URI` accordingly.

### Tidal

Tidal uses OAuth 2.1 with PKCE (no client secret required). Use it as source or destination for transfers (Spotify ↔ YouTube ↔ Tidal ↔ Deezer).

1. Go to the **[TIDAL Developer Dashboard](https://developer.tidal.com/dashboard)** and sign in with your TIDAL account (create one at [account.tidal.com](https://account.tidal.com) if needed).
2. Accept the developer **Guidelines** on first login if prompted.
3. Click **Create app** (or open an existing app).
4. In the app **Overview** tab, copy your **Client ID**. (Client Secret is optional for PKCE; you can reveal it if your flow needs it.)
5. Set the **Redirect URI** for your app to exactly:
   ```
   http://127.0.0.1:3000/callback/tidal
   ```
   For production, add your live URL as an additional redirect URI.
6. Add to your `.env`:
   ```
   TIDAL_CLIENT_ID=your_client_id_here
   TIDAL_REDIRECT_URI=http://127.0.0.1:3000/callback/tidal
   ```
7. In the app's **Scopes** section, ensure **playlists.read** and **playlists.write** are enabled (and **user.read** if you need user info). Save.
8. Restart the dev server and choose Tidal as source or destination in StreamSwap. Click the Tidal card to sign in and load playlists.

**Production:** Redirect URIs must use HTTPS only, no query parameters, no localhost, and no private IPs. For local development, `http://127.0.0.1:3000/callback/tidal` is fine.

### Deezer

Deezer uses OAuth at [developers.deezer.com](https://developers.deezer.com/). Set `DEEZER_APP_ID` and optionally `DEEZER_APP_SECRET` and `DEEZER_REDIRECT_URI` in `.env`. If Deezer is not accepting new app creation, the app shows a short message when users try to connect.

---

## Project Structure

```
streamswap/
│
├── index.html                         # Entry HTML with root div
├── vite.config.js                     # Vite build configuration
├── package.json                       # Dependencies and scripts
├── .env.example                       # Environment variable template
├── .gitignore                         # Git ignore rules
├── README.md                          # This file
│
├── public/
│   └── favicon.svg                    # Gradient music note favicon
│
└── src/
    ├── main.jsx                       # App entry: React 18 + Router setup
    ├── App.jsx                        # Main application (all views, state, UI)
    ├── styles.css                     # Global styles, animations, responsive
    │
    ├── lib/                           # Core logic (no UI)
    │   ├── platforms.js               #   Platform configs, colors, auth URLs, icons
    │   ├── spotify.js                 #   Spotify OAuth PKCE + playlists, search, create
    │   ├── youtube.js                 #   YouTube OAuth PKCE + playlists, search, create
    │   ├── apple-music.js             #   Apple MusicKit + all API operations
    │   ├── matching.js                #   Song matching engine (ISRC + fuzzy)
    │   └── import-export.js           #   JSON/CSV parsing, generation, download
    │
    ├── hooks/                         # React hooks
    │   ├── useAuth.js                 #   OAuth token state + sessionStorage
    │   └── useTransferHistory.js      #   Transfer history + localStorage
    │
    └── pages/
        └── Callback.jsx               #   OAuth redirect handler (/callback/:platform)
```

### File Sizes

| File | Lines | Purpose |
|------|-------|---------|
| `App.jsx` | ~1,180 | Main UI — all 6 transfer steps, history view, import/export view |
| `spotify.js` | ~260 | Spotify OAuth PKCE + playlists, tracks, search, create |
| `youtube.js` | ~240 | YouTube OAuth PKCE + playlists, tracks, search, create |
| `apple-music.js` | ~210 | Apple MusicKit integration |
| `matching.js` | ~196 | Song matching algorithm |
| `import-export.js` | ~249 | File parsing and generation |
| `styles.css` | ~90 | Global styles + responsive breakpoints |

---

## Architecture

### Authentication Flow

StreamSwap uses **OAuth 2.0 with PKCE** for Spotify and YouTube, and **MusicKit JS** for Apple Music.

```
┌──────────────┐    1. Auth Request     ┌─────────────────┐
│  StreamSwap   │ ───────────────────▶  │  Platform OAuth  │
│  (Browser)    │                        │  (Spotify/Google)│
│               │ ◀─────────────────── │                   │
│               │    2. Redirect +      └─────────────────┘
│               │       Auth Code
│               │
│               │    3. Exchange Code + PKCE Verifier
│               │ ───────────────────▶  Token Endpoint
│               │ ◀───────────────────  Access Token
│               │
│               │    4. API Calls with Bearer Token
│               │ ───────────────────▶  Platform API
└──────────────┘
```

**PKCE Flow (Spotify/YouTube):**
1. Generate a random `code_verifier` (64 chars)
2. Hash it with SHA-256 → `code_challenge`
3. Store `code_verifier` in `sessionStorage`
4. Redirect user to platform auth URL with `code_challenge`
5. User authorizes → redirected back with `code`
6. Exchange `code` + `code_verifier` for access token
7. Store token in `sessionStorage` (via `useAuth` hook)

**MusicKit JS (Apple Music):**
1. Load MusicKit JS from Apple's CDN
2. Configure with Developer Token (JWT)
3. Call `mk.authorize()` → Apple login popup
4. Receive `musicUserToken` for API calls

### Song Matching Engine

Located in `src/lib/matching.js`. The matching pipeline runs for every track being transferred:

```
Source Track
    │
    ├─── 1. ISRC Lookup ──────────── Match found? ──▶ confidence: 1.0 (ISRC)
    │                                      │ no
    │                                      ▼
    ├─── 2. Normalize strings
    │       • lowercase
    │       • strip (feat. ...), [Remix], etc.
    │       • remove special chars
    │       • collapse whitespace
    │
    ├─── 3. Compare against every destination track:
    │       title_similarity  = 1 - (levenshtein(a, b) / max(len(a), len(b)))
    │       artist_similarity = same formula
    │       duration_ok       = |dur_a - dur_b| ≤ 5 seconds
    │
    │       combined_score = title × 0.55 + artist × 0.35 + duration × 0.10
    │
    ├─── 4. Classify best match:
    │       ≥ 0.88  →  "title+artist" (high confidence)
    │       ≥ 0.60  →  "fuzzy" (review recommended)
    │       < 0.60  →  "none" (not found)
    │
    └─── Return { match, confidence, method }
```

**Normalization Examples:**

| Raw Input | Normalized |
|-----------|-----------|
| `Blinding Lights (feat. Daft Punk)` | `blinding lights` |
| `Don't Start Now [Remix]` | `dont start now` |
| `Señorita - ft. Camila Cabello` | `senorita` |
| `Can't Help Falling In Love` | `cant help falling in love` |

### Transfer Pipeline

When **source and destination are Spotify and/or YouTube** (real transfer):

1. Load tracks for each selected playlist (from source API if not already loaded).
2. For each playlist: create a new playlist on the destination (Spotify or YouTube API).
3. For each track: search the destination catalog (Spotify: ISRC then title+artist; YouTube: title+artist in Music category).
4. Add matched tracks to the new playlist (Spotify: batch 100; YouTube: one request per video).
5. Record match confidence per track and save to transfer history.

When source or destination is not connected (e.g. Apple only, or mock): the app runs a simulated transfer with mock data for demo purposes.

### Duplicate Detection

Located in `matching.js → findDuplicates()`. Runs before transfer at the Review step:

```
For each track in each selected playlist:
  key = normalize(title + "|" + artist)
  if key already seen → flag as duplicate
  else → record key with playlist name

Returns: [{ track, playlist, existsIn }]
```

This catches the same song even when metadata differs slightly across playlists.

### Persistent Storage

| Data | Storage | Hook | Key |
|------|---------|------|-----|
| Transfer history | `localStorage` | `useTransferHistory` | `streamswap_history` |
| OAuth tokens | `sessionStorage` | `useAuth` | `streamswap_tokens` |
| PKCE code verifier (Spotify) | `sessionStorage` | spotify.js | `spotify_code_verifier` |
| PKCE code verifier (YouTube) | `sessionStorage` | youtube.js | `youtube_code_verifier` |

`localStorage` survives browser restarts. `sessionStorage` clears when the tab closes (appropriate for tokens).

---

## API Reference

### spotify.js

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `initiateSpotifyAuth()` | — | Redirects browser | Starts PKCE OAuth flow |
| `exchangeSpotifyCode(code)` | Authorization code | `{ accessToken, refreshToken, expiresAt }` | Exchanges auth code for tokens |
| `refreshSpotifyToken(refreshToken)` | Refresh token | `{ accessToken, refreshToken, expiresAt }` | Gets new access token |
| `getSpotifyUserProfile(accessToken)` | Access token | User profile object | Fetches current user info |
| `getSpotifyPlaylists(accessToken)` | Access token | `[{ id, name, trackCount, image, owner, ... }]` | Fetches all user playlists (paginated) |
| `getSpotifyPlaylistTracks(accessToken, playlistId)` | Access token, playlist ID | `[{ id, title, artist, album, duration, isrc, uri }]` | Fetches all tracks in a playlist (paginated) |
| `createSpotifyPlaylist(accessToken, userId, name, description?)` | Token, user ID, name | Playlist ID | Creates a new playlist |
| `addTracksToSpotifyPlaylist(accessToken, playlistId, trackUris)` | Token, playlist ID, URI array | — | Adds tracks in batches of 100 |
| `searchSpotifyTrack(accessToken, title, artist, isrc?)` | Token, title, artist, optional ISRC | Match object or null | Searches catalog by ISRC then text |

### youtube.js

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `initiateYouTubeAuth()` | — | Redirects browser | Starts Google OAuth PKCE flow |
| `exchangeYouTubeCode(code)` | Authorization code | `{ accessToken, refreshToken, expiresAt }` | Exchanges code for tokens |
| `getYouTubePlaylists(accessToken)` | Access token | `[{ id, name, trackCount, image, platform }]` | Fetches user playlists (paginated) |
| `getYouTubePlaylistTracks(accessToken, playlistId)` | Token, playlist ID | `[{ id, videoId, title, artist, platform }]` | Fetches playlist items (paginated) |
| `createYouTubePlaylist(accessToken, name, description?)` | Token, name | Playlist ID | Creates private playlist |
| `addTracksToYouTubePlaylist(accessToken, playlistId, videoIds)` | Token, playlist ID, video ID array | — | Adds videos to playlist |
| `searchYouTubeTrack(accessToken, title, artist)` | Token, title, artist | Match object or null | Search in Music category (videoCategoryId 10) |

### apple-music.js

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `initAppleMusic()` | — | MusicKit instance | Loads MusicKit JS and configures |
| `initiateAppleMusicAuth()` | — | `{ musicUserToken }` | Shows Apple login and authorizes |
| `getAppleMusicPlaylists(musicUserToken)` | User token | Playlist array | Fetches library playlists |
| `getAppleMusicPlaylistTracks(musicUserToken, playlistId)` | User token, playlist ID | Track array | Fetches playlist tracks |
| `createAppleMusicPlaylist(musicUserToken, name, description?)` | User token, name | Playlist ID | Creates a library playlist |
| `addTracksToAppleMusicPlaylist(musicUserToken, playlistId, trackIds)` | User token, playlist ID, ID array | — | Adds tracks in batches of 100 |
| `searchAppleMusicTrack(musicUserToken, title, artist, isrc?)` | User token, title, artist, optional ISRC | Match object or null | Searches catalog |

### matching.js

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `normalizeString(str)` | Any string | Cleaned string | Strips metadata noise for comparison |
| `levenshteinDistance(a, b)` | Two strings | Integer | Edit distance (memory-optimized single-row) |
| `stringSimilarity(a, b)` | Two strings | 0..1 float | 1 = identical, 0 = completely different |
| `durationMatch(durA, durB, tolerance?)` | Two durations in seconds | Boolean | True if within tolerance (default 5s) |
| `matchTrack(track, catalog)` | Source track, destination array | `{ match, confidence, method }` | Full matching pipeline |
| `matchPlaylist(tracks, catalog)` | Track array, catalog array | `Map<trackId, matchResult>` | Batch match all tracks |
| `findDuplicates(playlists)` | Playlist array | `[{ track, playlist, existsIn }]` | Cross-playlist duplicate detection |
| `computeMatchStats(results)` | Match results Map | `{ total, exact, fuzzy, missing, avgConfidence }` | Aggregate statistics |

### import-export.js

| Function | Parameters | Returns | Description |
|----------|-----------|---------|-------------|
| `exportAsJSON(playlists)` | Playlist array | Downloads .json file | Full playlist export with metadata |
| `exportAsCSV(playlists)` | Playlist array | Downloads .csv file | Spreadsheet-friendly export |
| `parseJSON(text)` | JSON string | Playlist array | Parses StreamSwap JSON format |
| `parseCSV(text)` | CSV string | Playlist array | Parses CSV with auto-column detection |
| `parsePlaylistFile(filename, content)` | Filename, file text | `{ format, playlists }` | Auto-detects format and parses |

---

## Import/Export Formats

### JSON

```json
[
  {
    "name": "Chill Vibes",
    "description": "Relaxing tracks for the evening",
    "trackCount": 3,
    "tracks": [
      {
        "title": "Blinding Lights",
        "artist": "The Weeknd",
        "album": "After Hours",
        "duration": 200,
        "isrc": "USUG11904201"
      },
      {
        "title": "Levitating",
        "artist": "Dua Lipa",
        "album": "Future Nostalgia",
        "duration": 203,
        "isrc": "GBAHT2000135"
      }
    ]
  }
]
```

**Fields:** `name` (required), `description` (optional), `tracks` (required array). Per track: `title` (required), `artist` (required), `album` (optional), `duration` (seconds, optional), `isrc` (optional but greatly improves matching).

### CSV

```csv
Playlist,Track,Artist,Album,Duration,ISRC
Chill Vibes,Blinding Lights,The Weeknd,After Hours,3:20,USUG11904201
Chill Vibes,Levitating,Dua Lipa,Future Nostalgia,3:23,GBAHT2000135
Workout Mix,Stronger,Kanye West,Graduation,5:12,USUG10700396
```

**Columns:** Playlist (required), Track (required), Artist (required), Album (optional), Duration (m:ss, optional), ISRC (optional).

**Compatibility:** The CSV parser also handles exports from Soundiiz, TuneMyMusic, and other playlist tools. If no "Playlist" column is detected, all tracks are grouped into a single "Imported Playlist".

---

## UI Components

The app is built as a single `App.jsx` file with inline components. Key UI elements:

| Component | Description |
|-----------|-------------|
| `PlatformCard` | Selectable platform tile with icon, name, connected badge, and accent glow |
| `TrackRow` | Single track row with number, title, artist, album, duration, and match badge |
| `PlaylistItem` | Selectable playlist card with checkbox, emoji, name, track count, and expand toggle |
| `ProgressRing` | SVG circular progress indicator used during transfer |
| `Badge` | Small colored label (Exact/Fuzzy/Missing, Connected, etc.) |
| `Chip` | Toggle button used for filters and actions (duplicate strategy, export format) |
| `TransferAnimation` | Source → destination visual with animated progress dots and progress ring |

### Three Main Views

| View | Tab | Description |
|------|-----|-------------|
| Transfer | ↔ Transfer | 6-step wizard: Source → Destination → Select → Review → Transfer → Complete |
| History | ⏱ History | List of past transfers with stats, timestamps, and clear option |
| Import/Export | 📁 Import/Export | File upload for JSON/CSV import, export buttons, format documentation |

---

## Customization

### Adding a New Platform

1. Add the platform config to `src/lib/platforms.js` (name, color, authUrl, apiBase, scopes, clientId, redirectUri).

2. Add an SVG icon to `PLATFORM_ICONS` in the same file.

3. Create `src/lib/<platform>.js` following the pattern of `spotify.js`:
   - `initiateAuth()`, `exchangeCode(code)`, `getValidToken()`
   - `getPlaylists(token)`, `getPlaylistTracks(token, playlistId)`
   - `createPlaylist(token, name)`, `addTracksToPlaylist(token, playlistId, trackIds)`, `searchTrack(token, title, artist)`

4. Add the callback handling in `src/pages/Callback.jsx` and wire the platform into `App.jsx` (connect, load playlists, runTransfer).

5. The platform will appear in the UI when its env vars are set.

### Changing the Theme

Edit CSS variables in `src/styles.css`:

```css
:root {
  --bg: #06060c;                          /* Background */
  --surface: rgba(255, 255, 255, 0.03);   /* Card backgrounds */
  --border: rgba(255, 255, 255, 0.07);    /* Borders */
  --text: #e8e8ed;                        /* Primary text */
  --text-muted: rgba(255, 255, 255, 0.45);/* Secondary text */
  --font: 'Outfit', sans-serif;           /* Display font */
  --mono: 'JetBrains Mono', monospace;    /* Data/code font */
}
```

### Adjusting Match Thresholds

Edit the classification thresholds in `src/lib/matching.js`:

```javascript
// In matchTrack():
if (bestScore >= 0.88) → 'title+artist'  // Lower = more aggressive matching
if (bestScore >= 0.60) → 'fuzzy'          // Lower = fewer "missing" results
// Below 0.60 → 'none'

// Weight distribution:
combined = title × 0.55 + artist × 0.35 + duration × 0.10
```

---

## Deployment

### Vercel (Recommended)

```bash
npm run build
npx vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deploys. Add environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Netlify

```bash
npm run build
```

Drag the `dist/` folder to Netlify, or connect your repo. Add a `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

The redirect rule is essential for React Router to handle client-side routing (especially the `/callback/:platform` routes).

### Docker

```dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

```nginx
# nginx.conf
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Production Redirect URIs

Update your platform app settings with production URLs:

| Platform | Redirect URI |
|----------|-------------|
| Spotify | `https://yourdomain.com/callback/spotify` |
| YouTube | `https://yourdomain.com/callback/youtube` |

Update `.env` accordingly:
```env
SPOTIFY_REDIRECT_URI=https://yourdomain.com/callback/spotify
GOOGLE_REDIRECT_URI=https://yourdomain.com/callback/youtube
```

---

## Roadmap

- [x] YouTube Music — OAuth PKCE + playlists, search, create (Spotify ↔ YouTube both ways)
- [ ] Tidal integration — OAuth + playlist read/write
- [ ] Deezer integration — OAuth + playlist read/write
- [ ] SoundCloud integration — OAuth + playlist read/write
- [ ] Liked/Saved songs — Transfer liked songs, not just playlists
- [ ] Album transfer — Transfer saved albums across platforms
- [ ] Manual match override — Let users manually pick the right match for fuzzy/missing tracks
- [ ] Scheduled transfers — Sync playlists on a recurring schedule
- [ ] Browser extension — One-click transfer from any platform's web player
- [ ] PWA support — Installable with offline capability
- [ ] Batch operations — Transfer entire libraries at once
- [ ] Match preview — Preview matches before committing the transfer
- [ ] Undo transfer — Delete created playlists if something went wrong
- [ ] Analytics dashboard — Visualize your music library overlap across platforms

---

## Contributing

Contributions are welcome! Here's how to get started:

1. **Fork** the repository
2. **Clone** your fork: `git clone https://github.com/yourname/streamswap.git`
3. **Branch**: `git checkout -b feature/my-feature`
4. **Code** your changes
5. **Test** with `npm run dev`
6. **Commit**: `git commit -m 'Add my feature'`
7. **Push**: `git push origin feature/my-feature`
8. **Open a Pull Request**

### Code Style
- React functional components with hooks
- No class components
- CSS-in-JS for component-scoped styles, global CSS for animations/responsive
- Descriptive variable names
- JSDoc comments on exported functions

### Areas That Need Help
- Platform API integrations (YouTube, Tidal, Deezer)
- Unit tests for the matching engine
- Accessibility (ARIA labels, keyboard navigation)
- Internationalization (i18n)
- End-to-end tests with Playwright

---

## License

MIT License

Copyright © 2025 StreamSwap

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
