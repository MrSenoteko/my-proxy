const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    'Access-Control-Max-Age': '86400'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    res.end('pong - proxy is alive!');
    return;
  }

  const proxyHeaders = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
    'accept': req.headers['accept'] || '*/*',
    'content-type': req.headers['content-type'] || 'application/json',
  };
  if (req.headers['authorization']) proxyHeaders['authorization'] = req.headers['authorization'];
  if (req.headers['x-goog-api-client']) proxyHeaders['x-goog-api-client'] = req.headers['x-goog-api-client'];
  if (req.headers['x-firebase-gmpid']) proxyHeaders['x-firebase-gmpid'] = req.headers['x-firebase-gmpid'];

  const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
  const options = {
    method: req.method,
    hostname: 'firestore.googleapis.com',
    path: targetUrl.pathname + targetUrl.search,
    headers: proxyHeaders
  };

  let clientBody = [];
  req.on('data', chunk => clientBody.push(chunk));
  req.on('end', () => {
    
    const proxyReq = https.request(options, (proxyRes) => {
      let serverBody = [];
      
      proxyRes.on('data', chunk => serverBody.push(chunk));
      
      proxyRes.on('end', () => {
        const finalBuffer = Buffer.concat(serverBody);
        const resHeaders = { ...corsHeaders };
        
        if (proxyRes.headers['content-type']) {
          resHeaders['Content-Type'] = proxyRes.headers['content-type'];
        }
        resHeaders['Content-Length'] = finalBuffer.length;
        
        res.writeHead(proxyRes.statusCode, resHeaders);
        res.end(finalBuffer);
      });
    });

    proxyReq.on('error', (e) => {
      res.writeHead(500, corsHeaders);
      res.end('Proxy Error: ' + e.message);
    });

    if (clientBody.length > 0) {
      proxyReq.write(Buffer.concat(clientBody));
    }
    proxyReq.end();
  });
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log('Buffered Proxy running on port ' + port));
