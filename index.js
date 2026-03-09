const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    'Access-Control-Max-Age': '86400',
    // 🔥 ЗАПРЕЩАЕМ МОБИЛЬНЫМ ОПТИМИЗАТОРАМ ТРОГАТЬ ДАННЫЕ 🔥
    'Cache-Control': 'no-transform, no-store',
    'X-Content-Type-Options': 'nosniff'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    res.end('pong - turbo mobile fix applied');
    return;
  }

  // Маскировка под ПК (удаляем все следы мобилки)
  const proxyHeaders = { ...req.headers };
  delete proxyHeaders['host'];
  delete proxyHeaders['origin'];
  delete proxyHeaders['referer'];
  proxyHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
  proxyHeaders['sec-ch-ua-mobile'] = '?0';
  proxyHeaders['sec-ch-ua-platform'] = '"Windows"';

  const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
  const options = {
    method: req.method,
    hostname: 'firestore.googleapis.com',
    path: targetUrl.pathname + targetUrl.search,
    headers: proxyHeaders
  };

  // 📦 СОБИРАЕМ ТЕЛО ЗАПРОСА (для POST запросов Firestore Lite)
  let body = [];
  req.on('data', (chunk) => body.push(chunk));
  req.on('end', () => {
    const data = Buffer.concat(body);

    const proxyReq = https.request(options, (proxyRes) => {
      let responseData = [];
      proxyRes.on('data', (chunk) => responseData.push(chunk));
      
      proxyRes.on('end', () => {
        const finalBuffer = Buffer.concat(responseData);
        const resHeaders = { ...proxyRes.headers, ...corsHeaders };
        
        // 🔥 УДАЛЯЕМ ПРИЗНАК "ПОТОКА", ЧТОБЫ МОБИЛКА НЕ ЖДАЛА 🔥
        delete resHeaders['transfer-encoding'];
        resHeaders['Content-Length'] = finalBuffer.length;
        resHeaders['Connection'] = 'keep-alive';

        res.writeHead(proxyRes.statusCode, resHeaders);
        res.end(finalBuffer);
      });
    });

    proxyReq.on('error', (e) => {
      res.writeHead(500, corsHeaders);
      res.end('Error: ' + e.message);
    });

    if (data.length > 0) proxyReq.write(data);
    proxyReq.end();
  });
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log('Proxy running on port ' + port));
