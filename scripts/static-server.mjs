import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(process.argv[2] || 'frontend');
const port = Number(process.argv[3] || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const clean = path.normalize(decoded).replace(/^([.][.][/\\])+/, '');
  const candidate = path.resolve(root, '.' + clean);
  if (candidate !== root && !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

const server = http.createServer((req, res) => {
  try {
    let filePath = safePath(req.url);
    if (!filePath) return void res.writeHead(400).end('Bad Request');
    let stat;
    try { stat = fs.statSync(filePath); } catch {}
    if (stat?.isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!fs.existsSync(filePath)) {
      // Pretty-route fallback for the static SPA-like pages.
      const clean = decodeURIComponent((req.url || '/').split('?')[0]).replace(/\/$/, '');
      const fallback = clean.startsWith('/app/trade')
        ? path.join(root, 'app', 'trade', 'index.html')
        : clean === '/app'
          ? path.join(root, 'app', 'index.html')
          : clean === '/docs'
            ? path.join(root, 'docs', 'index.html')
            : clean === '/sdk'
              ? path.join(root, 'sdk', 'index.html')
              : clean === '/privacy'
                ? path.join(root, 'privacy', 'index.html')
                : clean === '/cookies'
                  ? path.join(root, 'cookies', 'index.html')
                  : clean === '/whitepaper'
                    ? path.join(root, 'whitepaper', 'index.html')
                    : path.join(root, 'index.html');
      filePath = fallback;
    }
    if (!fs.existsSync(filePath)) return void res.writeHead(404).end('Not Found');
    const extension = path.extname(filePath).toLowerCase();
    res.setHeader('Content-Type', mime[extension] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    fs.createReadStream(filePath).pipe(res);
  } catch {
    if (!res.headersSent) res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[frontend] http://localhost:${port}`);
  console.log(`[frontend] serving ${root}`);
});
