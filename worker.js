/**
 * Corner Mobile — Cloudflare Worker CORS Proxy
 *
 * Déploiement :
 * 1. Aller sur https://dash.cloudflare.com
 * 2. Workers & Pages > Create Worker
 * 3. Coller ce code > Deploy
 * 4. Copier l'URL du worker (ex: corner-proxy.votre-compte.workers.dev)
 * 5. Mettre cette URL dans les settings de client.html et index.html
 */

export default {
  async fetch(request) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // Get target URL from query param or path
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      // Try path-based: /proxy/https://api.anthropic.com/...
      const pathMatch = url.pathname.match(/^\/proxy\/(.+)$/);
      if (pathMatch) targetUrl = decodeURIComponent(pathMatch[1]);
    }

    if (!targetUrl) {
      return new Response(JSON.stringify({
        error: 'Missing url parameter',
        usage: '?url=https://api.anthropic.com/v1/messages'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Only allow specific APIs
    const allowed = ['api.anthropic.com', 'api.loyverse.com', 'sheets.googleapis.com', 'www.googleapis.com', 'oauth2.googleapis.com'];
    const targetHost = new URL(targetUrl).hostname;
    if (!allowed.some(h => targetHost.endsWith(h))) {
      return new Response(JSON.stringify({ error: 'Host not allowed: ' + targetHost }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Forward the request
    const headers = new Headers();
    for (const [key, value] of request.headers) {
      // Forward all headers except host-related ones
      if (!['host', 'origin', 'referer', 'cf-connecting-ip', 'cf-ray', 'cf-ipcountry'].includes(key.toLowerCase())) {
        headers.set(key, value);
      }
    }

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' ? await request.text() : undefined,
      });

      // Return response with CORS headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', '*');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};
