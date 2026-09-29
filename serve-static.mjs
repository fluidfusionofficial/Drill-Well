// Minimal dependency-free static server for the exported site in ./out
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const root = path.join(process.cwd(), "out");
const port = Number(process.argv[2] || 3002);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".txt": "text/plain; charset=utf-8",
};

http
  .createServer((request, response) => {
    const url = decodeURIComponent((request.url || "/").split("?")[0]);
    const candidates = [path.join(root, url), path.join(root, url, "index.html"), path.join(root, `${url}.html`)];
    let file = null;
    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        file = candidate;
        break;
      }
    }
    if (!file) {
      const fallback = path.join(root, "404", "index.html");
      if (fs.existsSync(fallback)) {
        response.writeHead(404, { "Content-Type": types[".html"] });
        response.end(fs.readFileSync(fallback));
        return;
      }
      response.writeHead(404, { "Content-Type": types[".txt"] });
      response.end("Not found");
      return;
    }
    const type = types[path.extname(file).toLowerCase()] || "application/octet-stream";
    const body = fs.readFileSync(file);
    response.writeHead(200, { "Content-Type": type, "Content-Length": body.length, "Cache-Control": "no-store" });
    response.end(body);
  })
  .listen(port, () => console.log(`Static export served at http://localhost:${port}/`));
