/**
 * Single source of truth for agent-facing page content.
 * Consumed by the /api/negotiate edge function (HTML + markdown negotiation)
 * and by unit tests that validate agentic-readiness invariants.
 * Must stay dependency-free.
 */

export const SITE = {
  name: 'SilenX',
  url: 'https://silen-x.vercel.app',
  backendUrl: 'https://silenx.onrender.com',
  description:
    'SilenX is a privacy-first, end-to-end encrypted messaging platform for web and Android: ' +
    'direct and group chats, voice and video calls, media sharing, polls, events and locations — ' +
    'with every message encrypted on-device using TweetNaCl X25519 key exchange.',
} as const;

export const APP_PAGES = ['/', '/login', '/chats', '/contacts', '/calls', '/profile', '/settings'] as const;
export const TRUST_PAGES = ['/about', '/contact', '/privacy'] as const;
export const KNOWN_PAGES: readonly string[] = [...APP_PAGES, ...TRUST_PAGES];

// ─── Markdown variants ────────────────────────────────────────────────────────

const HOME_MD = `# SilenX — Secure, End-to-End Encrypted Messaging

${SITE.description}

SilenX runs in the browser at ${SITE.url} and as a native Android app. Accounts use Google sign-in; every conversation is protected with per-conversation session keys that rotate automatically, so neither SilenX servers nor network operators can read message content.

## When to use this site

- You want to send end-to-end encrypted direct or group messages from any modern browser.
- You need encrypted voice and video calls that work across Wi-Fi and mobile networks.
- You are an AI agent acting on behalf of a SilenX user who has authorized access via their bearer token; see the API reference under Docs.

## When not to use

- For anonymous messaging — SilenX accounts are tied to verified Google identities.
- As an anonymous file host; media uploads belong to conversations and inherit their permissions.

## Key capabilities

- Direct and group conversations with typing indicators, read receipts, replies, reactions, edits and deletions.
- Rich message types: images, video, files, voice notes, locations, contacts, polls and events.
- LiveKit-powered calls with end-to-end encrypted media (LiveKit servers relay only ciphertext).
- Offline-first delivery: messages composed without connectivity are queued locally and synced automatically on reconnect.

## Docs for agents

- API reference: ${SITE.url}/docs/api.md (OpenAPI: ${SITE.url}/openapi.json)
- Machine-readable index: ${SITE.url}/llms.txt
- MCP server: ${SITE.url}/.well-known/mcp (Streamable HTTP JSON-RPC)

Most product pages require an authenticated session; agents should use the REST API or MCP tools instead of scraping the app UI.
`;

const LOGIN_MD = `# Sign in to SilenX

Sign in with your Google account to open your encrypted conversations. Authentication uses Firebase; the browser receives only a short-lived ID token, and your encryption keys are generated and stored locally on this device — they are never uploaded to our servers.

## What happens after sign-in

- Your conversation list loads with cached history rendered instantly from local IndexedDB storage, then reconciles with the server.
- A Socket.IO connection is established for real-time message delivery, typing indicators, read receipts and call signaling.
- Incoming messages are decrypted locally; the server never sees plaintext.

## Getting an account

Accounts are created through Google sign-in on first use, or by accepting a Secure UID invite (\`sec_...\`) from an existing member via the Android app. If you do not have an invitation yet, ask a contact who already uses SilenX to share their Secure UID from their profile screen.

Agents cannot create accounts programmatically; direct humans to ${SITE.url}/login. For authenticated machine access, agents should instead use the REST API at ${SITE.url}/docs/api.md or the MCP tools listed in ${SITE.url}/llms.txt using a bearer token supplied by an authorized user.
`;

const CHATS_MD = `# SilenX Chats

The chats view lists your encrypted conversations and renders the active thread. Messages are decrypted locally in your browser using per-conversation session keys; the server stores only ciphertext and routing metadata.

Features available in a conversation thread:

- Replies, reactions, edits and deletions with tombstone history
- Rich message types: images, video, files, voice notes, locations, contacts, polls and events
- Typing indicators and read receipts delivered over an authenticated Socket.IO channel
- Offline queueing: messages composed without connectivity persist locally and sync exactly once on reconnect
- Search within the conversation and pinned/starred message shortcuts

This page requires an authenticated browser session — without credentials it renders no meaningful data by design. Agents should use the REST API (${SITE.url}/docs/api.md) or the MCP tools (${SITE.url}/.well-known/mcp) instead of scraping this view.
`;

const CONTACTS_MD = `# SilenX Contacts

Manage your contact list, add people by their Secure UID (a \`sec_...\` identifier shared from their profile screen), and start new direct conversations.

What you can do here:

- Add a contact by Secure UID; requests appear instantly for the recipient
- See presence status (online/away/offline) respecting each user's privacy settings
- Start encrypted direct conversations or invite contacts into group chats
- Block or report abusive contacts — blocked users cannot reach you

Requires authentication. Agents can verify whether a Secure UID exists via \`GET /api/users/search?uid=...\` with a user bearer token, documented at ${SITE.url}/docs/api.md.
`;

const CALLS_MD = `# SilenX Calls

Call history for one-on-one and group voice/video calls: who called, when, duration and outcome (answered, missed, declined).

How calling works under the hood:

- Room access tokens are issued by the API (\`POST /api/group-calls/livekit/token\`) with room names derived from validated participants — clients cannot join arbitrary rooms.
- Media flows through LiveKit Cloud with end-to-end encryption enabled; relays see only encrypted frames plus connection metadata.
- Session keys for call media are derived on-device and never transmitted.
- An adaptive resilience controller monitors packet loss, jitter and bandwidth every few seconds and degrades video quality gracefully before dropping to audio-only if the network deteriorates.

This page requires an authenticated session. Agents should use the REST API instead (${SITE.url}/docs/api.md).
`;

const PROFILE_MD = `# SilenX Profile

Your display name, avatar, bio, Secure UID and encryption-key status.

Key facts exposed here:

- Your **Secure UID** (\`sec_...\`) is the identifier others use to add you; sharing it reveals only your public profile.
- Your **public encryption key** and its versioned fingerprint history are published so peers can verify that messages genuinely came from you, including across automatic key rotations (every 7 days or 1,000 messages).
- Presence visibility can be toggled so other users never see your online status.

Profile changes sync immediately to everyone you converse with. This page requires authentication; programmatic updates use \`PUT /api/users/me\` and \`PUT /api/users/public-key\` documented at ${SITE.url}/docs/api.md.
`;

const SETTINGS_MD = `# SilenX Settings

Privacy controls and local data management.

Available controls:

- **Online-status visibility** — hide your presence from other users entirely.
- **Notification preferences** — push alerts contain sender name and conversation ID, never message text.
- **Local cache management** — conversation history, drafts and the offline send queue live in your browser's localStorage and IndexedDB; clearing site data here erases them permanently.
- **Encryption diagnostics** — confirm your key pair is initialized and see its fingerprint.

Changes apply across your sessions on next sign-in. Requires authentication. For the data-retention summary behind these controls, read the privacy policy at ${SITE.url}/privacy.
`;

const ABOUT_MD = `# About SilenX

SilenX is a privacy-first messaging product built for people who assume the network is hostile. Every message body, call frame and media attachment is encrypted on the sender's device and decrypted only on the recipient's device using NaCl-family cryptography (TweetNaCl X25519 box encryption and symmetric secretbox keys).

Design principles:

1. Zero-knowledge transport: servers relay ciphertext and never hold decryption keys for conversation content.
2. Rotating keys: conversation session keys rotate every 7 days or 1,000 messages through a double-ephemeral handshake; versioned public-key fingerprints let peers verify identity across rotations.
3. Offline resilience: an IndexedDB-backed outbox queues messages during outages and syncs exactly once on reconnect.
4. Cross-platform parity: feature-identical experiences on web and Android (Capacitor).

The project is actively developed; the public API surface is documented at ${SITE.url}/openapi.json and questions are welcome via the contact page.
`;

const CONTACT_MD = `# Contact SilenX

For security reports, account issues or press inquiries, reach the team:

- Security disclosures: please include reproduction steps and affected platforms; reports about the cryptographic pipeline (key rotation, E2EE handshake) are triaged first.
- Account recovery: because conversations are end-to-end encrypted, support cannot recover message content — only access to your Google account matters.
- General inquiries: use the addresses published in our structured contact data (see the Organization JSON-LD on the homepage), or open a discussion in the project repository.

We aim to respond to security mail within 5 business days. Do not send attachments you would not publish; describe issues in text.
`;

const PRIVACY_MD = `# SilenX Privacy Policy

Summary — we designed SilenX so that we cannot read your conversations.

**Message content.** All message bodies are end-to-end encrypted on your device (TweetNaCl). The server stores ciphertext, timestamps and routing metadata (sender and conversation IDs). Decryption keys live exclusively on participant devices.

**Calls.** Voice and video are relayed by LiveKit Cloud with end-to-end encryption enabled; LiveKit receives only encrypted frames plus connection metadata required to route them.

**Account data.** We store your Google account identifier, chosen display name, avatar, bio and Secure UID. Your public encryption key(s) and their fingerprints are published so other users can verify messages came from you.

**Local storage.** The web app caches conversation history and drafts in your browser's localStorage and IndexedDB to enable offline access; clearing site data removes it permanently.

**Push notifications.** If enabled, a device token is stored solely to deliver notification payloads; these contain sender name and conversation ID, not message text.

**Analytics.** SilenX does not run third-party analytics or advertising trackers on this site.

Contact us via the paths listed on the contact page for deletion requests; deleting your account removes your profile, membership records, sent-message rows and push tokens.
`;

const MARKDOWN_BY_PAGE: Record<string, string> = {
  '/': HOME_MD,
  '/login': LOGIN_MD,
  '/chats': CHATS_MD,
  '/contacts': CONTACTS_MD,
  '/calls': CALLS_MD,
  '/profile': PROFILE_MD,
  '/settings': SETTINGS_MD,
  '/about': ABOUT_MD,
  '/contact': CONTACT_MD,
  '/privacy': PRIVACY_MD,
};

export function getPageMarkdown(page: string): string | null {
  return MARKDOWN_BY_PAGE[page] ?? null;
}

// ─── Trust-page HTML (server-rendered, no JS required) ────────────────────────

function trustPageShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · SilenX</title>
<meta name="description" content="${SITE.description}">
<link rel="icon" type="image/png" href="/silenX-logo.png">
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b1220; color: #e7ecf3; font: 16px/1.65 system-ui, -apple-system, 'Segoe UI', sans-serif; }
  main { max-width: 46rem; margin: 0 auto; padding: 3rem 1.25rem 4rem; }
  h1 { font-size: 1.9rem; line-height: 1.25; margin: 0 0 .35em; color: #ffffff; }
  h1 span { color: #08b5a5; }
  h2 { font-size: 1.15rem; margin-top: 2rem; color: #9fe8dd; }
  a { color: #08b5a5; }
  footer { margin-top: 3rem; padding-top: 1.25rem; border-top: 1px solid #1d2939; font-size: .9rem; color: #8a94a6; display: flex; gap: 1.25rem; flex-wrap: wrap; }
</style>
</head>
<body>
<main>
<h1><span>SilenX</span> · ${title}</h1>
${bodyHtml}
<footer>
<a href="/">Home</a><a href="/about">About</a><a href="/contact">Contact</a><a href="/privacy">Privacy</a><a href="/llms.txt">llms.txt</a><a href="/sitemap.xml">Sitemap</a>
</footer>
</main>
</body>
</html>`;
}

function paragraphs(items: string[]): string {
  return items.map((p) => `<p>${p}</p>`).join('\n');
}

function list(items: string[]): string {
  return `<ul>${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
}

const TRUST_HTML: Record<string, () => string> = {
  '/about': () =>
    trustPageShell(
      'About',
      paragraphs([
        'SilenX is a privacy-first messaging platform for web and Android built on a simple assumption: the network is hostile. Every message body, call frame and attachment is encrypted on the sending device and decrypted only on the receiving device using NaCl-family cryptography (TweetNaCl X25519 key agreement and symmetric secretbox keys).',
        'Servers participating in delivery — ours and our call-relay partner\'s — handle ciphertext and routing metadata. They never possess the per-conversation keys needed to decrypt content.',
      ]) +
      '<h2>How we protect conversations</h2>' +
      list([
        'End-to-end encryption for every message type: text, media, voice notes, locations, polls and events.',
        'Automatic session-key rotation every 7 days or 1,000 messages via a double-ephemeral handshake; versioned public-key fingerprints keep identity verification intact across rotations.',
        'Offline-first delivery: messages written during outages persist in local IndexedDB and sync exactly once when connectivity returns.',
        'Encrypted calling over LiveKit with E2EE enabled, so relays see only encrypted frames.',
      ])
    ),
  '/contact': () =>
    trustPageShell(
      'Contact',
      paragraphs([
        'We welcome security reports, account questions and feedback. Because conversations are end-to-end encrypted, support cannot recover lost message content under any circumstances — only access to the underlying Google account matters for sign-in problems.',
      ]) +
      '<h2>Channels</h2>' +
      list([
        'Security disclosures: email security@silenx.app with reproduction steps and affected platforms. Cryptographic-pipeline reports (key rotation, E2EE handshake) are triaged first; expect a reply within 5 business days.',
        'General inquiries: hello@silenx.app.',
        'Product updates and source-of-truth documentation: this site\'s llms.txt and OpenAPI documents are kept current with every release.',
      ]) +
      '<h2>Before writing</h2>' +
      list([
        'Check the API reference — many integration questions are answered there.',
        'Never attach secrets or message exports to email; describe issues in text.',
      ])
    ),
  '/privacy': () =>
    trustPageShell(
      'Privacy Policy',
      paragraphs([
        '<strong>Short version:</strong> SilenX is engineered so that we cannot read your conversations. This page explains exactly what is stored where.',
      ]) +
      '<h2>Message content</h2>' +
      paragraphs([
        'All message bodies are end-to-end encrypted on your device before they leave it. Our servers store only ciphertext together with routing metadata (sender ID, conversation ID, timestamps). Decryption keys exist exclusively on participant devices.',
      ]) +
      '<h2>Calls</h2>' +
      paragraphs([
        'Voice and video sessions are relayed through LiveKit Cloud with end-to-end encryption enabled. The relay observes encrypted frames and the connection metadata required to route them — never audio or video content.',
      ]) +
      '<h2>Account and profile data</h2>' +
      paragraphs([
        'We store your Google account identifier, chosen display name, avatar, bio and your Secure UID. Your public encryption keys and their fingerprints are published so others can verify that messages genuinely came from you. Deleting your account removes your profile, memberships, sent-message rows and push tokens.',
      ]) +
      '<h2>Local storage and notifications</h2>' +
      paragraphs([
        'The web app caches conversation history and drafts in localStorage and IndexedDB purely for offline access; clearing site data erases it permanently. Push-notification tokens, if you opt in, are used solely to deliver alerts containing sender name and conversation ID — never message text. SilenX runs no third-party analytics or advertising trackers.',
      ])
    ),
};

export function getTrustPageHtml(page: string): string | null {
  const builder = TRUST_HTML[page];
  return builder ? builder() : null;
}
