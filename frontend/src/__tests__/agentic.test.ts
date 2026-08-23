import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  SITE,
  KNOWN_PAGES,
  TRUST_PAGES,
  getPageMarkdown,
  getTrustPageHtml,
} from '../../api/content';

const root = resolve(__dirname, '../..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf-8');

describe('agentic readiness: content module', () => {
  it('provides markdown for every known page', () => {
    for (const page of KNOWN_PAGES) {
      const md = getPageMarkdown(page);
      expect(md, `missing markdown for ${page}`).toBeTruthy();
      expect(md!.startsWith('# '), `${page} markdown must start with an H1`).toBe(true);
      expect(md!.length, `${page} markdown must exceed 500 chars`).toBeGreaterThan(500);
    }
  });

  it('homepage markdown contains when-to-use guidance and agent docs links', () => {
    const md = getPageMarkdown('/')!;
    expect(md).toContain('When to use this site');
    expect(md).toContain('When not to use');
    expect(md).toContain('/docs/api.md');
    expect(md).toContain('.well-known/mcp');
    expect(md).toContain(SITE.url);
  });

  it('trust pages render server-side HTML with real content and no JS requirement', () => {
    for (const page of TRUST_PAGES) {
      const html = getTrustPageHtml(page);
      expect(html, `missing HTML for ${page}`).toBeTruthy();
      expect(html).toContain('<h1');
      expect(html!.length).toBeGreaterThan(1500);
      // Strip tags and require meaningful visible text.
      const text = html!.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ');
      expect(text.length, `${page} visible text must exceed 500 chars`).toBeGreaterThan(500);
      expect(html).not.toContain('<script');
    }
  });
});

describe('agentic readiness: routing config (real 404s + negotiation)', () => {
  const vercelJson = JSON.parse(read('vercel.json'));

  it('does NOT contain a catch-all SPA rewrite (soft-404 regression guard)', () => {
    const raw = read('vercel.json');
    expect(raw).not.toContain('[^.]'); // legacy catch-all pattern
    for (const rewrite of vercelJson.rewrites) {
      expect(rewrite.source.startsWith('/.well-known') || KNOWN_PAGES.includes(rewrite.source)).toBe(true);
    }
  });

  it('rewrites every known page through the negotiation function', () => {
    const sources = new Set(vercelJson.rewrites.map((r: { source: string }) => r.source));
    for (const page of KNOWN_PAGES) {
      if (page !== '/') {
        expect(sources.has(page), `missing rewrite for ${page}`).toBe(true);
      }
    }
    expect(sources.has('/')).toBe(true);
    expect(sources.has('/.well-known/mcp')).toBe(true);
  });

  it('negotiation function serves markdown and sets Vary: Accept', async () => {
    const mod = await import('../../api/negotiate');
    const response = await mod.default(
      new Request(`https://silen-x.vercel.app/?page=/about`, {
        headers: { accept: 'text/markdown' },
      })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/markdown');
    expect(response.headers.get('vary')).toContain('Accept');
    const body = await response.text();
    expect(body.startsWith('# About SilenX')).toBe(true);
  });

  it('negotiation function returns server-rendered HTML for trust pages', async () => {
    const mod = await import('../../api/negotiate');
    const response = await mod.default(
      new Request(`https://silen-x.vercel.app/?page=/privacy`, { headers: { accept: 'text/html' } })
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('vary')).toContain('Accept');
    expect(await response.text()).toContain('Privacy Policy');
  });

  it('negotiation function rejects unknown pages with a 404', async () => {
    const mod = await import('../../api/negotiate');
    const response = await mod.default(
      new Request('https://silen-x.vercel.app/?page=/definitely-not-real')
    );
    expect(response.status).toBe(404);
  });
});

describe('agentic readiness: MCP endpoint', () => {
  const mod = () => import('../../api/mcp');

  it('GET /.well-known/mcp returns the discovery manifest', async () => {
    const { default: handler } = await mod();
    const res = await handler(new Request('https://silen-x.vercel.app/.well-known/mcp'));
    expect(res.status).toBe(200);
    const manifest = JSON.parse(await res.text());
    expect(manifest.name).toBe('SilenX');
    expect(manifest.transport).toBe('streamable-http');
    expect(manifest.tools.length).toBeGreaterThanOrEqual(3);
  });

  it('POST initialize performs the JSON-RPC handshake', async () => {
    const { default: handler } = await mod();
    const res = await handler(
      new Request('https://silen-x.vercel.app/.well-known/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      })
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(await res.text());
    expect(body.result.protocolVersion).toBeTruthy();
    expect(body.result.serverInfo.name).toBe('SilenX');
    expect(body.result.capabilities.tools).toBeTruthy();
  });

  it('tools/list enumerates tools; unknown methods return -32601', async () => {
    const { default: handler } = await mod();
    const list = await handler(
      new Request('https://silen-x.vercel.app/.well-known/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
      })
    );
    const listed = JSON.parse(await list.text());
    expect(listed.result.tools.map((t: { name: string }) => t.name)).toContain(
      'silenx_service_status'
    );

    const missing = await handler(
      new Request('https://silen-x.vercel.app/.well-known/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'nope' }),
      })
    );
    const err = JSON.parse(await missing.text());
    expect(err.error.code).toBe(-32601);
  });
});

describe('agentic readiness: static machine-readable files', () => {
  it('llms.txt exists with when-to-use guidance and canonical URLs', () => {
    const llms = read('public/llms.txt');
    expect(llms.startsWith('# SilenX')).toBe(true);
    expect(llms).toContain('When to use SilenX');
    expect(llms).toContain('When NOT to use');
    expect(llms).toContain('https://silen-x.vercel.app/.well-known/mcp');
    expect(llms).toContain('openapi.json');
  });

  it('sitemap.xml lists all indexable public URLs with lastmod dates', () => {
    const sitemap = read('public/sitemap.xml');
    const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs.length).toBeGreaterThanOrEqual(5);
    for (const loc of locs) {
      expect(loc.startsWith(`${SITE.url}/`) || loc === SITE.url).toBe(true);
    }
    for (const required of ['/', '/about', '/contact', '/privacy']) {
      expect(locs.some((loc) => new URL(loc).pathname === required)).toBe(true);
    }
    expect(sitemap).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
  });

  it('robots.txt references the sitemap and shields authenticated app routes', () => {
    const robots = read('public/robots.txt');
    expect(robots).toContain('Sitemap: https://silen-x.vercel.app/sitemap.xml');
    expect(robots).toContain('Disallow: /chats');
  });

  it('openapi.json is valid 3.1 and documents key endpoints', () => {
    const spec = JSON.parse(read('public/openapi.json'));
    expect(spec.openapi).toMatch(/^3\.1/);
    for (const path of [
      '/health',
      '/api/users/public-key',
      '/api/users/{id}/public-keys',
      '/api/conversations',
      '/api/group-calls/livekit/token',
    ]) {
      expect(spec.paths[path], `missing ${path} in OpenAPI spec`).toBeTruthy();
    }
  });

  it('404.html points agents back at machine-readable resources', () => {
    const notFound = read('public/404.html');
    expect(notFound).toContain('404');
    expect(notFound).toContain('sitemap.xml');
    expect(notFound).toContain('llms.txt');
    expect(notFound).toContain('docs/api.md');
  });

  it('docs/api.md covers auth model and core endpoints', () => {
    const docs = read('public/docs/api.md');
    expect(docs).toContain('Authorization: Bearer');
    expect(docs).toContain('/api/conversations');
    expect(docs).toContain('/health');
  });
});

describe('agentic readiness: index.html shell', () => {
  const html = read('index.html');

  it('declares complete metadata signals', () => {
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toContain('rel="canonical" href="https://silen-x.vercel.app/"');
    expect(html).toContain('property="og:image"');
    expect(html).toContain('property="og:type"');
    expect(html).not.toContain('SlienX'); // brand typo must not regress
  });

  it('embeds valid JSON-LD SoftwareApplication and Organization schemas', () => {
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
      (m) => JSON.parse(m[1])
    );
    expect(blocks).toHaveLength(2);

    const app = blocks.find((b) => b['@type'] === 'SoftwareApplication');
    expect(app?.name).toBe('SilenX');
    expect(app?.offers).toBeTruthy();

    const org = blocks.find((b) => b['@type'] === 'Organization');
    expect(org?.contactPoint?.length).toBeGreaterThanOrEqual(1);
    expect(org?.address).toBeTruthy();
  });

  it('ships prerendered no-JS homepage content (H1 + 500+ chars)', () => {
    const rootStart = html.indexOf('<div id="root">');
    const rootEnd = html.indexOf('</div>', html.indexOf('</section>'));
    const prerendered = html.slice(rootStart, rootEnd);
    expect(prerendered).toContain('<h1');
    const text = prerendered.replace(/<[^>]+>/g, ' ').trim();
    expect(text.length).toBeGreaterThan(500);
    expect(text).toContain('End-to-End Encrypted');
  });
});
