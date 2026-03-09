const http = require('http');

const server = http.createServer(async (req, res) => {
  // CORS-заголовки
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
    return res.end('pong - strict headers allowlist active!');
  }

  try {
    // 1. Читаем запрос от сайта
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const bodyBuffer = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    // 🔥 2. СТРОГИЙ ФИЛЬТР ЗАГОЛОВКОВ 🔥
    // Навсегда удаляем Save-Data и все скрытые мобильные маркеры
    const fetchHeaders = {
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36',
      'accept': 'application/json'
    };

    // Пропускаем ТОЛЬКО эти заголовки, остальной мусор от телефона блокируем
    const allowed = [
      'content-type',
      'authorization',
      'x-goog-api-client',
      'x-goog-request-params',
      'x-firebase-gmpid'
    ];

    for (const key of allowed) {
      if (req.headers[key]) {
        fetchHeaders[key] = req.headers[key];
      }
    }

    // 3. Делаем идеальный запрос к Google
    const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: fetchHeaders,
      body: (req.method !== 'GET' && req.method !== 'HEAD') ? bodyBuffer : undefined,
    });

    // 4. Получаем данные и превращаем в простой файл
    const responseData = await response.arrayBuffer();

    const resHeaders = { ...corsHeaders };
    if (response.headers.get('content-type')) {
      resHeaders['content-type'] = response.headers.get('content-type');
    }
    resHeaders['content-length'] = responseData.byteLength;

    res.writeHead(response.status, resHeaders);
    res.end(Buffer.from(responseData));

  } catch (e) {
    res.writeHead(500, corsHeaders);
    res.end('Error: ' + e.message);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log('Strict Proxy running'));
