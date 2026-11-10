// Minimal static file server for the exported site (used by Playwright and `pnpm start`).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(process.argv[2] ?? 'out');
const port = Number(process.argv[3] ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  const candidate = path.join(root, clean);
  if (!candidate.startsWith(root)) return null;
  for (const p of [candidate, path.join(candidate, 'index.html'), `${candidate}.html`]) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null;
}

http
  .createServer((req, res) => {
    const file = resolveFile(req.url ?? '/');
    if (!file) {
      const notFound = path.join(root, '404.html');
      res.writeHead(404, { 'content-type': types['.html'] });
      res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not found');
      return;
    }
    const ext = path.extname(file);
    const headers = { 'content-type': types[ext] ?? 'application/octet-stream' };
    // Compress text like the production host does, so local performance checks are realistic.
    const text = ['.html', '.js', '.css', '.json', '.svg', '.txt'].includes(ext);
    if (text && /\bgzip\b/.test(req.headers['accept-encoding'] ?? '')) {
      res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'accept-encoding' });
      fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
      return;
    }
    res.writeHead(200, headers);
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Serving ${root} on http://localhost:${port}`));
