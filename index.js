const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
    'Access-Control-Max-Age': '86400'
  };

  // 1. Быстрый ответ на проверку CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // 2. Проверка работоспособности
  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    res.end('pong - proxy is alive!');
    return;
  }

  // 3. Отбираем только самые необходимые заголовки (скрываем, что мы с телефона)
  const proxyHeaders = {
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
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

  // Читаем запрос от сайта
  let clientBody = [];
  req.on('data', chunk => clientBody.push(chunk));
  req.on('end', () => {
    
    // Запрашиваем данные у Google
    const proxyReq = https.request(options, (proxyRes) => {
      let serverBody = [];
      
      // 🔥 ПРОКСИ СОБИРАЕТ ВСЕ КУСОЧКИ В СЕБЯ 🔥
      proxyRes.on('data', chunk => serverBody.push(chunk));
      
      // Когда Гугл всё отдал, отправляем ЦЕЛИКОМ на телефон
      proxyRes.on('end', () => {
        const finalBuffer = Buffer.concat(serverBody);
        
        const resHeaders = { ...corsHeaders };
        resHeaders['Content-Type'] = proxyRes.headers['content-type'] || 'application/json';
        resHeaders['Content-Length'] = finalBuffer.length; // Телефон сразу знает размер
        
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
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log(`Proxy running on port ${port}`));
