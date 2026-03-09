const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  // CORS-заголовки для браузера
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'OPTIONS, GET, POST, PUT, PATCH, DELETE',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    return res.end();
  }

  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    return res.end('pong - final stream fix');
  }

  // Настраиваем запрос к Google
  const options = {
    hostname: 'firestore.googleapis.com',
    port: 443,
    path: req.url,
    method: req.method,
    headers: {
      ...req.headers,
      host: 'firestore.googleapis.com',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
    }
  };

  // Удаляем всё, что может выдать мобильный телефон или сломать кодировку
  delete options.headers['origin'];
  delete options.headers['referer'];
  delete options.headers['sec-ch-ua'];
  delete options.headers['sec-ch-ua-mobile'];
  delete options.headers['sec-ch-ua-platform'];
  delete options.headers['accept-encoding']; 

  // Отправляем запрос в Google
  const proxyReq = https.request(options, (proxyRes) => {
    let body = [];
    proxyRes.on('data', (chunk) => body.push(chunk));
    
    proxyRes.on('end', () => {
      const payload = Buffer.concat(body);
      const resHeaders = { ...proxyRes.headers, ...corsHeaders };
      
      delete resHeaders['set-cookie'];
      delete resHeaders['transfer-encoding']; // Убираем бесконечный поток для мобилки
      resHeaders['content-length'] = payload.length; // Говорим телефону точный размер
      
      res.writeHead(proxyRes.statusCode, resHeaders);
      res.end(payload);
    });
  });

  proxyReq.on('error', (err) => {
    res.writeHead(500, corsHeaders);
    res.end(err.message);
  });

  // 🔥 САМОЕ ГЛАВНОЕ: Прямая труба от телефона к Гуглу без ручного ожидания 🔥
  req.pipe(proxyReq);
});

server.listen(process.env.PORT || 10000, () => console.log('Direct pipe proxy running'));
