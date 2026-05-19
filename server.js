const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const DIR = __dirname;
const PORT = 8765;

const DEEPSEEK_HOST = 'api.deepseek.com';

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 代理 DeepSeek API
  if (req.url.startsWith('/api/deepseek')) {
    const apiPath = req.url.replace('/api/deepseek', '');
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      const options = {
        hostname: DEEPSEEK_HOST,
        port: 443,
        path: apiPath || '/v1/chat/completions',
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers['authorization'] || '',
          'Content-Length': Buffer.byteLength(body)
        }
      };
      const proxyReq = https.request(options, proxyRes => {
        res.writeHead(proxyRes.statusCode, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        proxyRes.pipe(res);
      });
      proxyReq.on('error', err => {
        console.error('Proxy error:', err.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: { message: 'Proxy error: ' + err.message } }));
      });
      proxyReq.write(body);
      proxyReq.end();
    });
    return;
  }

  // 静态文件服务
  let filePath = req.url === '/' ? '/history-characters.html' : req.url;
  filePath = path.join(DIR, filePath.replace(/\?.*$/, ''));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + filePath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
    res.writeHead(200, { 'Content-Type': (types[ext] || 'text/plain') + '; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[史鉴人物志] 服务器已启动: http://127.0.0.1:${PORT}`);
  console.log(`[代理] DeepSeek API 代理: http://127.0.0.1:${PORT}/api/deepseek/v1/chat/completions`);
});
