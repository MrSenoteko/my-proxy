const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';

  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }

  const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
  const options = {
    method: req.method,
    hostname: 'firestore.googleapis.com',
    path: targetUrl.pathname + targetUrl.search,
    headers: { ...req.headers }
  };

  delete options.headers['host'];
  delete options.headers['origin'];
  delete options.headers['referer'];

  const proxyReq = https.request(options, (proxyRes) => {
    const resHeaders = { ...proxyRes.headers, ...corsHeaders };

    if (proxyRes.headers['set-cookie']) {
      resHeaders['set-cookie'] = proxyRes.headers['set-cookie'].map(cookie => 
        cookie.replace(/Domain=[^;]+;?\s*/gi, "")
              .replace(/SameSite=[^;]+/gi, "SameSite=None") + "; Secure"
      );
    }

    res.writeHead(proxyRes.statusCode, resHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.writeHead(500);
    res.end(e.message);
  });

  req.pipe(proxyReq);
});

const port = process.env.PORT || 10000;
server.listen(port);
