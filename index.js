const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    'Access-Control-Max-Age': '86400',
  };

  // Отвечаем на предварительные запросы браузера (CORS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // 🔥 ЭТО НАШ БУДИЛЬНИК 🔥
  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    res.end('pong');
    return;
  }

  // Направляем запросы в Google
  const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
  const options = {
    method: req.method,
    hostname: 'firestore.googleapis.com',
    path: targetUrl.pathname + targetUrl.search,
    headers: { ...req.headers }
  };

  // Удаляем лишнее
  delete options.headers['host'];
  delete options.headers['origin'];
  delete options.headers['referer'];
  delete options.headers['accept-encoding']; // Чтобы данные не ломались

  const proxyReq = https.request(options, (proxyRes) => {
    const resHeaders = { ...proxyRes.headers, ...corsHeaders };
    delete resHeaders['set-cookie']; // В Lite-версии куки не нужны
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
server.listen(port, () => console.log('Proxy is awake on port ' + port));
