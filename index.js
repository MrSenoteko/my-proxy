const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, no-transform'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    res.end('pong');
    return;
  }

  const proxyHeaders = { ...req.headers };
  delete proxyHeaders['host'];
  delete proxyHeaders['origin'];
  delete proxyHeaders['referer'];
  delete proxyHeaders['accept-encoding'];

  proxyHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
  const options = {
    method: req.method,
    hostname: 'firestore.googleapis.com',
    path: targetUrl.pathname + targetUrl.search,
    headers: proxyHeaders
  };

  const proxyReq = https.request(options, (proxyRes) => {
    const resHeaders = { ...proxyRes.headers, ...corsHeaders };
    delete resHeaders['set-cookie'];
    delete resHeaders['cache-control'];
    
    res.writeHead(proxyRes.statusCode, resHeaders);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.writeHead(500, corsHeaders);
    res.end(e.message);
  });

  req.pipe(proxyReq);
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log('Proxy is running on port ' + port));
