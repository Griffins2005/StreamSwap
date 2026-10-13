// Turns service failures into what StreamSwap can do and the steps a person should take.

const NAMES = {
  spotify: "Spotify",
  youtube: "YouTube Music",
  tidal: "Tidal",
  deezer: "Deezer",
  apple: "Apple Music",
};

const LINK_HANDLES =
  "StreamSwap can open a playlist on the Spotify account you signed in with, a playlist on the YouTube account you signed in with, or a public Deezer playlist. A link to one song, an album, or an artist will not load.";

function nameOf(platform) {
  return NAMES[platform] || "This service";
}

function messageOf(err) {
  if (err == null) return "";
  if (typeof err === "string") return err;
  return err.message != null ? String(err.message) : String(err);
}

function isDeveloperOnly(msg) {
  return /\.env|api key|client id|client_secret|credentials|configured|developer|oauth consent|cloud console|redirect uri/i.test(msg);
}

function isNotFound(msg) {
  return /resource not found|not found|not accessible|unknown playlist|invalid playlist|\b404\b/i.test(msg);
}

function isRateLimit(err, msg) {
  return err?.name === "RateLimitError" || err instanceof Error && err.name === "RateLimitError" || msg === "RATE_LIMIT";
}

function guide(title, handles, steps, extra = {}) {
  return { title, handles, steps, ...extra };
}

function ownedPlaylistSteps(platform) {
  const name = nameOf(platform);
  if (platform === "spotify") {
    return [
      "Skip the link if the playlist is already on your Spotify account. Tap Spotify, then Continue, and choose it from the list.",
      "If it belongs to someone else, or it is a Spotify-made list such as Discover Weekly, open it in Spotify and add the songs to a playlist you own.",
      "Come back and pick that playlist from your account, or paste the new link.",
    ];
  }
  if (platform === "youtube") {
    return [
      "Skip the link if the playlist is already on your YouTube account. Tap YouTube Music, then Continue, and choose it from the list.",
      "If it is someone else's, open it on YouTube and save a copy, or set your own playlist to Public and copy the share link again.",
      "Paste the playlist link, not a link to one video.",
    ];
  }
  if (platform === "deezer") {
    return [
      "Open the playlist in Deezer and confirm it is public. Private playlists cannot be loaded from a link.",
      "Copy the playlist link again. A song or album link will not load.",
      "Paste it here and tap Load playlist. Deezer does not need a sign-in for a public playlist.",
    ];
  }
  return [
    `Open ${name} and copy the share link for a playlist on your account.`,
    "Paste that link here and tap Load playlist.",
  ];
}

export function explainUserError(err, context = {}) {
  const where = context.where || "general";
  const platform = context.platform || "";
  const name = nameOf(platform);
  const msg = messageOf(err);
  const kind = err?.kind || err?.message;

  if (msg.startsWith("SAVED_FOLLOW")) {
    return guide(
      "This playlist is now in your Spotify library.",
      "Spotify allowed StreamSwap to save the playlist to your account. It still will not share the song list, so this link cannot start a move.",
      [
        "Open Spotify. The playlist should be in Your Library.",
        "Add the songs to a new playlist you own.",
        "Come back, tap Spotify, then Continue, and pick that new playlist.",
      ]
    );
  }

  if (msg.startsWith("SAVE_REFUSED")) {
    return guide(
      "Spotify did not allow this playlist to be saved or read.",
      "StreamSwap can save a copy when Spotify shares the songs, and it can read playlists you already own. This link was refused.",
      ownedPlaylistSteps("spotify")
    );
  }

  if (msg.startsWith("UNSUPPORTED_LINK") || /unsupported or invalid link/i.test(msg)) {
    return guide(
      "This link is not a playlist StreamSwap can open.",
      LINK_HANDLES,
      [
        "In Spotify, YouTube, or Deezer, open the playlist and use Share, then copy the link.",
        "Paste that link here and tap Load playlist.",
        "Or skip the box: tap the service, sign in, and pick the playlist from your account.",
      ]
    );
  }

  if (msg.startsWith("NEED_SIGNIN")) {
    if (where === "preview" || where === "transfer") {
      return guide(
        `Sign in to ${name} before this move.`,
        "StreamSwap reads songs from the service you started with and adds matches on the service you chose. Both need a sign-in, unless the source is a public Deezer link.",
        [
          `Go back and tap ${name}.`,
          "Finish sign-in and allow playlist access. This browser remembers it.",
          "Return here and look up the songs again.",
        ]
      );
    }
    return guide(
      `Sign in to ${name} before loading this link.`,
      LINK_HANDLES,
      [
        `Tap ${name} above and finish sign-in. This browser remembers it afterward.`,
        "Paste the link again and tap Load playlist.",
        "If the playlist is already on that account, tap Continue and pick it from the list instead.",
      ]
    );
  }

  if (err?.name === "YouTubeQuotaError" || kind === "YOUTUBE_SEARCH_QUOTA" || kind === "YOUTUBE_UNIT_QUOTA") {
    const adding = kind === "YOUTUBE_UNIT_QUOTA";
    return guide(
      adding
        ? "YouTube's daily limit for adding songs is used up."
        : "YouTube's daily limit for looking up songs is used up.",
      "StreamSwap can still move songs it has already found. A new lookup uses one of 100 searches per day, and adding a song uses a separate YouTube limit.",
      adding
        ? [
            "Songs already added stay on the YouTube playlist.",
            "Come back tomorrow and start the move again. It continues where it stopped.",
            "Songs already found do not use another search.",
          ]
        : [
            "Move the songs already marked found. That does not use another search.",
            "Leave the rest for tomorrow, when the search limit resets.",
            "Start the lookup again then. Songs already found are reused.",
          ]
    );
  }

  if (isRateLimit(err, msg)) {
    const wait = err?.retryAfterSec ? `about ${err.retryAfterSec} seconds` : "a minute";
    const saved = Number(context.saved) || 0;
    return guide(
      `${name === "This service" ? "The service" : name} asked StreamSwap to slow down.`,
      saved > 0
        ? `${saved} songs already handled are saved. StreamSwap continues from there when you start again.`
        : "Songs already handled are saved. StreamSwap continues from there when you start again.",
      [
        `Wait ${wait}, then try again.`,
        "Start the same move again. It resumes instead of starting over.",
        "If it stops again, wait a little longer before the next try.",
      ]
    );
  }

  if (msg.startsWith("SPOTIFY_NEED_PERMISSION")) {
    return guide(
      "Spotify blocked this because the saved sign-in is missing playlist permission.",
      "StreamSwap can read your playlists and create a new one after you allow access.",
      [
        "Tap Reconnect Spotify.",
        "Choose Allow when Spotify asks to view and change your playlists.",
        "Come back and start the move again.",
      ],
      { reconnect: "spotify" }
    );
  }

  if (msg.startsWith("TIDAL_NEED_PERMISSION")) {
    return guide(
      "Tidal blocked this because the saved sign-in is missing playlist permission.",
      "StreamSwap can read your playlists and create a new one after you allow access.",
      [
        "Tap Reconnect Tidal.",
        "Choose Allow when Tidal asks.",
        "Come back and start the move again.",
      ],
      { reconnect: "tidal" }
    );
  }

  if (/TOKEN_EXPIRED|token expired|invalid_grant|sign-in failed|token exchange failed|missing code verifier/i.test(msg)) {
    const who = name === "This service" ? "The sign-in" : `The ${name} sign-in`;
    return guide(
      `${who} expired.`,
      "StreamSwap keeps a sign-in on this browser and refreshes it in the background. This one could not be refreshed.",
      [
        `Tap Disconnect on ${name === "This service" ? "the service" : name}, then sign in again.`,
        "Allow playlist access when it asks.",
        "Try the playlist again. The new sign-in stays on this browser.",
      ]
    );
  }

  if (where === "signin" && /access_denied|denied|cancel/i.test(msg)) {
    const steps = platform === "youtube"
      ? [
          "Go back to StreamSwap and tap YouTube Music again.",
          "On the page that says Google hasn't verified this app, click Advanced, then Go to StreamSwap.",
          "Allow access to your YouTube account when Google asks.",
        ]
      : [
          `Go back to StreamSwap and tap ${name} again.`,
          "Choose Allow so StreamSwap can read and create playlists.",
          "After it succeeds, this browser remembers the sign-in.",
        ];
    return guide(
      `${name} sign-in was cancelled.`,
      "StreamSwap finishes sign-in only after you allow playlist access.",
      steps
    );
  }

  if (where === "file" || /json must be an array|csv file is empty/i.test(msg)) {
    return guide(
      "This file could not be read as playlists.",
      "StreamSwap opens a JSON file that is a list of playlists, or a CSV whose first row names the playlist, track, and artist.",
      [
        "On the Transfer page, load your playlists and use Export JSON or Export CSV.",
        "Open that file here.",
        "A spreadsheet needs a header row and at least one song.",
      ]
    );
  }

  if ((where === "link" || where === "library") && (isNotFound(msg) || /forbidden|\b403\b/i.test(msg))) {
    return guide(
      `${name} could not open this playlist.`,
      where === "link" ? LINK_HANDLES : `StreamSwap lists playlists on the ${name} account you signed in with.`,
      where === "library"
        ? [
            `Tap Disconnect on ${name}, then sign in again.`,
            "If the list is still empty, that account may have no playlists yet.",
            "You can paste a playlist link you own on the first page instead.",
          ]
        : ownedPlaylistSteps(platform)
    );
  }

  if (isDeveloperOnly(msg) || /isn't available|not configured/i.test(msg)) {
    return guide(
      `${name} is not ready to connect on this site.`,
      "Spotify and YouTube Music are the services set up for sign-in here. Tidal, Deezer, and Apple Music stay unavailable until they are turned on.",
      [
        "Use Spotify or YouTube Music for this move.",
        "If you were already signed in, tap Disconnect and sign in again.",
        "Try the playlist again after the new sign-in.",
      ]
    );
  }

  if (where === "link") {
    return guide(
      `${name} could not load this link.`,
      LINK_HANDLES,
      ownedPlaylistSteps(platform)
    );
  }

  if (where === "library") {
    return guide(
      `Could not load playlists from ${name}.`,
      `StreamSwap lists playlists on the ${name} account you signed in with.`,
      [
        `Tap Disconnect on ${name}, then sign in again.`,
        "If it still fails, wait a minute and try once more.",
        "You can paste a playlist link you own on the first page instead.",
      ]
    );
  }

  return guide(
    "This step did not finish.",
    "StreamSwap can look songs up and add the ones it finds. Songs already handled stay saved.",
    [
      "Go back one step and try again.",
      "If it keeps failing, disconnect the service and sign in again.",
      "Then start the same move. It continues from the songs already done.",
    ]
  );
}
