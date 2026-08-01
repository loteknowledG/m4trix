const http = require('http');
const { URL } = require('url');

const PORT = 3000;
const DEFAULT_LMSTUDIO = 'http://localhost:11434';

const proxy = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsedUrl.pathname;

  if (pathname === '/v1/chat/completions' || pathname === '/v1/models') {
    const targetUrl = process.env.LMSTUDIO_URL || DEFAULT_LMSTUDIO;
    const target = `${targetUrl}${pathname}`;

    const body = [];
    for await (const chunk of req) {
      body.push(chunk);
    }
    const bodyStr = Buffer.concat(body).toString();

    try {
      const proxyRes = await fetch(target, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        },
        body: bodyStr || undefined,
      });

      res.writeHead(proxyRes.status, {
        'Content-Type': proxyRes.headers.get('Content-Type') || 'application/json',
      });

      for await (const chunk of proxyRes.body) {
        res.write(chunk);
      }
      res.end();
    } catch (err) {
      console.error(`Proxy error: ${err.message}`);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found. Use /v1/chat/completions or /v1/models' }));
  }
});

proxy.listen(PORT, () => {
  console.log(`LLM Proxy running on http://localhost:${PORT}`);
  console.log(`Point LM Studio URL to this proxy.`);
  console.log(`Set LMSTUDIO_URL env var to override default (${DEFAULT_LMSTUDIO})`);
});
