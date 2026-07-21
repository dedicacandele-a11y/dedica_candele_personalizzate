const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || 5173);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "127.0.0.1"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const reactBuildPath = resolveReactBuildPath(pathname);
  const filePath = reactBuildPath || path.resolve(root, `.${pathname}`);
  if (!filePath.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      const fallbackPath = resolveReactFallbackPath(pathname);
      if (fallbackPath) {
        response.writeHead(200, { "Content-Type": types[".html"] });
        response.end(fs.readFileSync(fallbackPath));
        return;
      }
      response.writeHead(404);
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": types[path.extname(filePath)] || "application/octet-stream",
    });
    response.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Static test server listening on http://127.0.0.1:${port}`);
});

function resolveReactBuildPath(pathname) {
  const distRoot = path.join(root, "dist-react");
  if (pathname === "/index.html") {
    const reactHtml = path.join(distRoot, "index.html");
    return fs.existsSync(reactHtml) ? reactHtml : null;
  }

  if (pathname.startsWith("/assets/")) {
    const distAsset = path.resolve(distRoot, `.${pathname}`);
    if (distAsset.startsWith(distRoot) && fs.existsSync(distAsset)) return distAsset;
  }

  return null;
}

function resolveReactFallbackPath(pathname) {
  if (path.extname(pathname)) return null;
  const reactHtml = path.join(root, "dist-react", "index.html");
  return fs.existsSync(reactHtml) ? reactHtml : null;
}
