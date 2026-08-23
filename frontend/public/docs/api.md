# SilenX API Reference

Base URL: `https://silenx.onrender.com`
OpenAPI 3.1 spec: [`/openapi.json`](https://silen-x.vercel.app/openapi.json)

## Authentication

All `/api/*` endpoints require a Firebase ID token obtained by signing in through a SilenX app (Google sign-in). Tokens cannot be minted outside the app flow.

```
Authorization: Bearer <Firebase ID token>
```

Expired or invalid tokens receive `401 {"message": "Invalid or expired token. Please sign in again."}`.

## Endpoints

### Service

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/health` | none | Liveness probe; returns `{ status: 'ok', ... }` |

### Users & keys

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/users/me` | bearer | Current user profile |
| PUT | `/api/users/me` | bearer | Update displayName, bio, avatarUrl, showOnlineStatus |
| PUT | `/api/users/public-key` | bearer | Publish/rotate public encryption key (versioned history + SHA-256 fingerprint maintained server-side) |
| GET | `/api/users/{id}/public-key` | bearer | Current public key, version and fingerprint |
| GET | `/api/users/{id}/public-keys` | bearer | Full versioned key history (for decrypting historical messages) |
| GET | `/api/users/search?uid=sec_xxxx` | bearer | Public profile lookup by Secure UID |

### Conversations & messages

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/api/conversations` | bearer | List conversations with member profiles and last-message previews |
| POST | `/api/conversations` | bearer | Create/fetch direct conversation: `{ "type": "direct", "recipientUid": "sec_xxxx" }` |
| GET | `/api/conversations/{id}/messages` | bearer | Messages for one conversation (**ciphertext only** — bodies are end-to-end encrypted with TweetNaCl and decryptable solely on member devices) |

### Calls

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/group-calls/livekit/token` | bearer | Issue LiveKit room token. Body: `{ mode: "direct", targetUserId }` or `{ mode: "group", groupId }`. Rooms are named `direct_<sorted user ids>` / `group_<groupId>`; tokens expire in 1 hour; media is end-to-end encrypted (LiveKit relays ciphertext frames). |

## Real-time transport

Message delivery, typing indicators, read receipts and call signaling run over Socket.IO on the same host (`https://silenx.onrender.com`). Clients authenticate the socket with a Firebase ID token in the handshake auth object.

## MCP access

Agents can call a subset of these capabilities as MCP tools over Streamable HTTP:

```
POST https://silen-x.vercel.app/.well-known/mcp
Content-Type: application/json

{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

Then `tools/list` and `tools/call`. Available tools: `silenx_service_status`, `silenx_lookup_public_profile`, `silenx_list_conversations`, `silenx_get_api_docs`.

## Rate limits & conduct

Endpoints are authenticated per user; automated abuse of lookup endpoints results in token-level blocking. Message content is never exposed in plaintext through any endpoint — do not attempt to scrape the web app instead; product pages require an authenticated browser session.
