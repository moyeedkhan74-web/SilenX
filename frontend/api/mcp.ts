/**
 * SilenX MCP server — Model Context Protocol over Streamable HTTP.
 *
 * Served at /.well-known/mcp (rewritten to this function by vercel.json):
 *   GET  → discovery manifest (name, transport, tool list)
 *   POST → JSON-RPC 2.0: initialize | ping | tools/list | tools/call
 *
 * Stateful-free implementation: no session IDs are issued, which the
 * Streamable HTTP transport permits for stateless servers.
 *
 * Tools proxy the public SilenX REST API. Endpoints requiring user identity
 * take an explicit `bearerToken` parameter supplied by the calling agent —
 * the server never stores credentials.
 */
import { SITE } from './content';

const BACKEND_URL = process.env.BACKEND_API_URL || SITE.backendUrl;
const PROTOCOL_VERSION = '2025-06-18';

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

async function backendFetch(path: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // keep text
  }
  if (!res.ok) {
    throw new Error(`Backend responded ${res.status}: ${typeof parsed === 'string' ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 200)}`);
  }
  return parsed;
}

const TOOLS: Array<{
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler?: ToolHandler;
}> = [
  {
    name: 'silenx_service_status',
    description: 'Check whether the SilenX API backend is up and healthy.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => backendFetch('/health'),
  },
  {
    name: 'silenx_lookup_public_profile',
    description:
      'Look up a SilenX user\'s public profile by their Secure UID (e.g. "sec_ab12cd34"). Returns display name, avatar and status. Requires a valid user bearerToken because lookups are authenticated.',
    inputSchema: {
      type: 'object',
      properties: {
        uid: { type: 'string', description: 'Secure UID, with or without the sec_ prefix' },
        bearerToken: { type: 'string', description: 'Firebase ID token of the requesting SilenX user' },
      },
      required: ['uid', 'bearerToken'],
      additionalProperties: false,
    },
    handler: async (args) =>
      backendFetch(`/api/users/search?uid=${encodeURIComponent(String(args.uid || ''))}`, {
        headers: { Authorization: `Bearer ${String(args.bearerToken || '')}` },
      }),
  },
  {
    name: 'silenx_list_conversations',
    description:
      "List the authenticated SilenX user's encrypted conversations (id, type, members, last message preview). Message bodies are NOT included — they are end-to-end encrypted and only readable on user devices.",
    inputSchema: {
      type: 'object',
      properties: {
        bearerToken: { type: 'string', description: 'Firebase ID token of the SilenX user' },
      },
      required: ['bearerToken'],
      additionalProperties: false,
    },
    handler: async (args) =>
      backendFetch('/api/conversations', {
        headers: { Authorization: `Bearer ${String(args.bearerToken || '')}` },
      }),
  },
  {
    name: 'silenx_get_api_docs',
    description: 'Return the SilenX REST API reference as markdown.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const res = await fetch(`${SITE.url}/docs/api.md`);
      return { markdown: await res.text() };
    },
  },
];

// ─── JSON-RPC plumbing ────────────────────────────────────────────────────────

function rpcResult(id: JsonRpcRequest['id'], result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    },
  });
}

function rpcError(id: JsonRpcRequest['id'], code: number, message: string): Response {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function manifest(): Record<string, unknown> {
  return {
    name: 'SilenX',
    title: 'SilenX secure messaging API',
    version: '1.0.0',
    protocolVersion: PROTOCOL_VERSION,
    transport: 'streamable-http',
    endpoint: `${SITE.url}/.well-known/mcp`,
    description: SITE.description,
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
    docs: {
      apiReference: `${SITE.url}/docs/api.md`,
      openapi: `${SITE.url}/openapi.json`,
      llmsIndex: `${SITE.url}/llms.txt`,
    },
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool || !tool.handler) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const output = await tool.handler(args);
  // MCP tools/call results wrap content items.
  return {
    content: [{ type: 'text', text: typeof output === 'string' ? output : JSON.stringify(output, null, 2) }],
  };
}

export default async function handler(request: Request): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, MCP-Protocol-Version, Mcp-Session-Id, Authorization',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Discovery manifest.
  if (request.method === 'GET') {
    return new Response(JSON.stringify(manifest(), null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Vary: 'Accept',
        ...corsHeaders,
      },
    });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { Allow: 'GET, POST, OPTIONS', ...corsHeaders },
    });
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  if (Array.isArray(body)) {
    return rpcError(null, -32600, 'Batch requests are not supported');
  }

  const { id, method, params } = body;

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'SilenX', title: 'SilenX secure messaging', version: '1.0.0' },
      });

    case 'notifications/initialized':
      // Notification: no response body per JSON-RPC when id is absent.
      return new Response(null, { status: 202, headers: corsHeaders });

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, {
        tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
      });

    case 'tools/call': {
      const name = String(params?.name || '');
      const args = (params?.arguments as Record<string, unknown>) || {};
      try {
        return rpcResult(id, await callTool(name, args));
      } catch (error) {
        return rpcResult(id, {
          content: [{ type: 'text', text: `Tool error: ${error instanceof Error ? error.message : String(error)}` }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id ?? null, -32601, `Method not found: ${String(method)}`);
  }
}
