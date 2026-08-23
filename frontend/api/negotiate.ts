/**
 * Vercel Edge Function: HTTP content negotiation for agent crawlers.
 *
 * - `Accept: text/markdown` → serves the page as markdown
 *   (Content-Type: text/markdown, with `Vary: Accept, Accept-Encoding`
 *   so CDN caches never mix HTML and markdown variants).
 * - Regular browsers → app pages get the SPA shell; /about, /contact and
 *   /privacy get fully server-rendered static HTML (no JS required).
 *
 * Routed from vercel.json rewrites: only KNOWN page paths reach this function.
 * Unknown paths never match a rewrite, miss the filesystem, and receive a
 * real HTTP 404 via public/404.html.
 */
import { getPageMarkdown, getTrustPageHtml, KNOWN_PAGES } from './content';

export const config = { runtime: 'edge' };

const NEGOTIATION_HEADERS: Record<string, string> = {
  Vary: 'Accept, Accept-Encoding',
  'Cache-Control': 'public, max-age=0, must-revalidate',
};

function wantsMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;
  return acceptHeader
    .split(',')
    .some((part) => part.trim().toLowerCase().startsWith('text/markdown'));
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const page = url.searchParams.get('page') || '/';

  if (!KNOWN_PAGES.includes(page)) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }

  // Markdown variant for agents.
  if (wantsMarkdown(request.headers.get('accept'))) {
    const markdown = getPageMarkdown(page);
    if (markdown) {
      return new Response(markdown, {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          ...NEGOTIATION_HEADERS,
        },
      });
    }
  }

  // Server-rendered trust pages — real content without JavaScript.
  const trustHtml = getTrustPageHtml(page);
  if (trustHtml) {
    return new Response(trustHtml, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...NEGOTIATION_HEADERS,
      },
    });
  }

  // App pages: stream the SPA shell so client-side routing takes over.
  try {
    const shell = await fetch(new URL('/index.html', url.origin), {
      headers: { accept: 'text/html' },
    });
    return new Response(shell.body, {
      status: shell.status,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...NEGOTIATION_HEADERS,
      },
    });
  } catch (error) {
    console.error('[negotiate] failed to load SPA shell:', error);
    return new Response('<!doctype html><title>SilenX</title><h1>SilenX</h1><p>Service temporarily unavailable.</p>', {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}
