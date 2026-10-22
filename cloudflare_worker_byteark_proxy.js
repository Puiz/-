
// Cloudflare Worker - ByteArk HLS Proxy (deploy ฟรี)
// 1. ไปที่ https://dash.cloudflare.com -> Workers -> Create Worker
// 2. วางโค้ดนี้แล้ว Deploy
// 3. เอา URL ที่ได้ เช่น https://byteark-proxy.yourname.workers.dev/?url= ใส่ในเว็บ

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return new Response('Usage: ?url=https://example.com/playlist.m3u8', { status: 400 });
    }

    // Allow only byteark domains for security (แก้ได้)
    // if (!targetUrl.includes('byteark.com')) return new Response('Forbidden', {status:403});

    let reqHeaders = new Headers();
    reqHeaders.set('User-Agent', 'Mozilla/5.0');
    reqHeaders.set('Referer', 'https://nextstep-sooyp4zfonli.stream-playlist.byteark.com/');
    reqHeaders.set('Origin', 'https://nextstep-sooyp4zfonli.stream-playlist.byteark.com');

    let response = await fetch(targetUrl, {
      headers: reqHeaders,
      cf: { cacheTtl: 60 }
    });

    let contentType = response.headers.get('content-type') || '';

    // If it's m3u8 playlist, rewrite segment URLs to go through this proxy again
    if (targetUrl.includes('.m3u8') || contentType.includes('mpegurl') || contentType.includes('x-mpegURL')) {
      let text = await response.text();
      let baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
      
      // Rewrite URLs
      let rewritten = text.split('\n').map(line => {
        line = line.trim();
        if (!line || line.startsWith('#')) return line;
        // Absolute http url
        if (line.startsWith('http://') || line.startsWith('https://')) {
          return `${url.origin}${url.pathname}?url=${encodeURIComponent(line)}`;
        }
        // Relative url
        if (line) {
          let absolute = baseUrl + line;
          return `${url.origin}${url.pathname}?url=${encodeURIComponent(absolute)}`;
        }
        return line;
      }).join('\n');

      return new Response(rewritten, {
        headers: {
          'Content-Type': 'application/vnd.apple.mpegurl',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Cache-Control': 'no-cache'
        }
      });
    }

    // For .ts segments and others, just proxy with CORS
    let newHeaders = new Headers(response.headers);
    newHeaders.set('Access-Control-Allow-Origin', '*');
    newHeaders.set('Access-Control-Allow-Headers', '*');
    newHeaders.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    newHeaders.delete('content-security-policy');

    return new Response(response.body, {
      status: response.status,
      headers: newHeaders
    });
  }
}
