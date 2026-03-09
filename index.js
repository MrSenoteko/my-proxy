const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
    'Access-Control-Allow-Headers': '*',
    // Принудительно отключаем мобильные протоколы, которые режут в РФ
    'Alt-Svc': 'clear', 
    'Cache-Control': 'no-cache, no-transform'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  // Настройка прямого соединения с Google
  const options = {
    hostname: 'firestore.googleapis.com',
    port: 443,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      'host': 'firestore.googleapis.com',
      // Маскируемся под ПК, чтобы провайдер не включал мобильные фильтры
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    }
  };

  // Удаляем мобильные метки, на которые реагирует ТСПУ
  delete options.headers['origin'];
  delete options.headers['referer'];
  delete options.headers['sec-ch-ua-mobile'];

  const proxyReq = https.request(options, (proxyRes) => {
    // Собираем ответ полностью, чтобы отдать его одним куском (это быстрее для мобилок)
    let data = [];
    proxyRes.on('data', chunk => data.push(chunk));
    proxyRes.on('end', () => {
      const buffer = Buffer.concat(data);
      const finalHeaders = { ...proxyRes.headers, ...corsHeaders };
      delete finalHeaders['transfer-encoding'];
      finalHeaders['content-length'] = buffer.length;

      res.writeHead(proxyRes.statusCode, finalHeaders);
      res.end(buffer);
    });
  });

  proxyReq.on('error', e => {
    res.writeHead(500, corsHeaders);
    res.end(e.message);
  });

  req.pipe(proxyReq);
});

server.listen(process.env.PORT || 10000);
