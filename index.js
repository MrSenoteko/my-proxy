const http = require('http');
const httpProxy = require('http-proxy');

const proxy = httpProxy.createProxyServer({
  target: 'https://firestore.googleapis.com',
  changeOrigin: true,
  secure: true
});

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '*';


  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  delete req.headers['host'];
  delete req.headers['origin'];
  delete req.headers['referer'];

  proxy.web(req, res, (err) => {
    console.error('Proxy error:', err);
    res.writeHead(500);
    res.end('Proxy error');
  });
});

const port = process.env.PORT || 10000;
server.listen(port, () => {
  console.log(`Proxy running on port ${port}`);
});
