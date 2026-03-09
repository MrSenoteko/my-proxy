const http = require('http');
const zlib = require('zlib'); // Встроенный архиватор Node.js

const server = http.createServer(async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    return res.end('pong - GZIP compression active!');
  }

  try {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    const fetchHeaders = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      'accept': 'application/json'
    };

    const allowed = ['content-type', 'authorization', 'x-goog-api-client', 'x-goog-request-params', 'x-firebase-gmpid'];
    for (const key of allowed) {
      if (req.headers[key]) fetchHeaders[key] = req.headers[key];
    }

    const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: fetchHeaders,
      body: (req.method !== 'GET' && req.method !== 'HEAD') ? bodyBuffer : undefined,
    });

    const responseData = await response.arrayBuffer();
    const rawBuffer = Buffer.from(responseData);

    // 🔥 МАГИЯ СЖАТИЯ: Уменьшаем размер базы в 10-20 раз для телефона! 🔥
    zlib.gzip(rawBuffer, (err, zippedBuffer) => {
      if (err) {
        res.writeHead(500, corsHeaders);
        return res.end('Compression error');
      }

      const resHeaders = { ...corsHeaders };
      if (response.headers.get('content-type')) {
        resHeaders['Content-Type'] = response.headers.get('content-type');
      }
      
      // Говорим мобильному браузеру, что это крошечный архив, а не огромный текст
      resHeaders['Content-Encoding'] = 'gzip'; 
      resHeaders['Content-Length'] = zippedBuffer.length;

      res.writeHead(response.status, resHeaders);
      res.end(zippedBuffer); // Отдаем сжатый архив
    });

  } catch (e) {
    res.writeHead(500, corsHeaders);
    res.end('Error: ' + e.message);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log('GZIP Proxy running'));
