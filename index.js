const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  // 🔥 1. Убиваем CORS и проблемные мобильные протоколы 🔥
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    // ВОТ ОНА, МАГИЯ: Строго запрещаем Chrome использовать HTTP/3 (UDP), который режут операторы РФ
    'Alt-Svc': 'clear' 
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    return res.end('pong - anti-quic TCP forced');
  }

  // 2. Надежно читаем запрос от телефона
  let clientBody = [];
  req.on('data', chunk => clientBody.push(chunk));
  
  req.on('end', () => {
    const bodyBuffer = Buffer.concat(clientBody);

    // 3. Формируем заголовки для Google
    const proxyHeaders = { ...req.headers };
    delete proxyHeaders['host'];
    delete proxyHeaders['origin'];
    delete proxyHeaders['referer'];
    delete proxyHeaders['accept-encoding']; // Заставляем гугл отдать чистый текст
    delete proxyHeaders['sec-ch-ua'];
    delete proxyHeaders['sec-ch-ua-mobile'];
    delete proxyHeaders['sec-ch-ua-platform'];
    
    // Всегда маскируемся под ПК для Google
    proxyHeaders['host'] = 'firestore.googleapis.com';
    proxyHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36';
    
    if (bodyBuffer.length > 0) {
        proxyHeaders['content-length'] = bodyBuffer.length;
    }

    const options = {
      hostname: 'firestore.googleapis.com',
      port: 443,
      path: req.url,
      method: req.method,
      headers: proxyHeaders
    };

    // 4. Запрашиваем данные у Google
    const proxyReq = https.request(options, (proxyRes) => {
      let serverBody = [];
      proxyRes.on('data', chunk => serverBody.push(chunk));
      
      proxyRes.on('end', () => {
        const finalPayload = Buffer.concat(serverBody);
        const resHeaders = { ...proxyRes.headers, ...corsHeaders };
        
        // Удаляем всё, что заставляет мобилку "ждать" конца потока
        delete resHeaders['transfer-encoding'];
        delete resHeaders['set-cookie'];
        
        // Указываем телефону точный размер файла, чтобы он скачал его мгновенно
        resHeaders['content-length'] = finalPayload.length;
        
        res.writeHead(proxyRes.statusCode, resHeaders);
        res.end(finalPayload);
      });
    });

    proxyReq.on('error', (err) => {
      res.writeHead(500, corsHeaders);
      res.end('Proxy Error: ' + err.message);
    });

    if (bodyBuffer.length > 0) {
      proxyReq.write(bodyBuffer);
    }
    proxyReq.end();
  });
});

server.listen(process.env.PORT || 10000, () => console.log('Anti-QUIC Proxy started'));
