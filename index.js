const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({
  target: 'https://firestore.googleapis.com',
  changeOrigin: true,
  secure: true
});

proxy.on('proxyRes', function (proxyRes, req, res) {
  const origin = req.headers.origin || '*';
  proxyRes.headers['access-control-allow-origin'] = origin;
  proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';
  proxyRes.headers['access-control-allow-headers'] = req.headers['access-control-request-headers'] || '*';
  proxyRes.headers['access-control-max-age'] = '86400';
  delete proxyRes.headers['set-cookie']; 
});

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  if (req.url === '/ping') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': origin });
    res.end('pong');
    return;
  }

  delete req.headers['origin'];
  delete req.headers['referer'];
  
  req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  delete req.headers['sec-ch-ua'];
  delete req.headers['sec-ch-ua-mobile'];
  delete req.headers['sec-ch-ua-platform'];

  proxy.web(req, res, (err) => {
    if (!res.headersSent) {
      res.writeHead(500);
      res.end('Proxy Error');
    }
  });
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log(`Proxy running on port ${port}`));
