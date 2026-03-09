const http = require('http');

const server = http.createServer(async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': req.headers.origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Max-Age': '86400'
  };

  // 1. Мгновенный ответ браузеру на проверку безопасности
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.url === '/ping') {
    res.writeHead(200, corsHeaders);
    res.end('pong - fetch proxy is alive!');
    return;
  }

  try {
    // 2. Читаем запрос от вашего сайта
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

    // 3. Собираем заголовки для Google (маскируемся под ПК)
    const targetUrl = new URL(req.url, 'https://firestore.googleapis.com');
    const fetchHeaders = {};
    
    for (const [key, value] of Object.entries(req.headers)) {
      const k = key.toLowerCase();
      // Удаляем accept-encoding, чтобы Node.js сам скачал сжатый архив и распаковал его
      if (!['host', 'origin', 'referer', 'connection', 'accept-encoding'].includes(k)) {
        fetchHeaders[k] = value;
      }
    }
    
    fetchHeaders['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36';
    fetchHeaders['sec-ch-ua-mobile'] = '?0';
    fetchHeaders['sec-ch-ua-platform'] = '"Windows"';

    // 4. Молниеносный запрос к Google
    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: fetchHeaders,
      body: (req.method !== 'GET' && req.method !== 'HEAD') ? body : undefined,
    });

    // 5. Конвертируем ответ в монолитный блок (чтобы мобилка не зависала на чтении потока)
    const responseData = await response.arrayBuffer();

    // 6. Отдаем телефону с точным указанием размера (Content-Length)
    const resHeaders = { ...corsHeaders };
    resHeaders['Content-Type'] = response.headers.get('content-type') || 'application/json';
    resHeaders['Content-Length'] = responseData.byteLength;

    res.writeHead(response.status, resHeaders);
    res.end(Buffer.from(responseData));

  } catch (e) {
    res.writeHead(500, corsHeaders);
    res.end('Error: ' + e.message);
  }
});

const port = process.env.PORT || 10000;
server.listen(port, () => console.log('Fetch Proxy running on port ' + port));
