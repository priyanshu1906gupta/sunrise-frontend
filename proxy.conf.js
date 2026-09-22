const fs = require("fs");
const path = require("path");

const siteRoot = path.resolve(__dirname, "src", "site");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
};

function serveSite(req, res) {
  if (!req.url) return false;
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath !== "/site" && !urlPath.startsWith("/site/")) return false;

  let rel = urlPath === "/site" || urlPath === "/site/" ? "index.html" : urlPath.slice("/site/".length);
  if (!rel || rel.endsWith("/")) rel += "index.html";

  const file = path.normalize(path.join(siteRoot, rel));
  if (!file.startsWith(siteRoot) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    return false;
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[path.extname(file).toLowerCase()] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.end(fs.readFileSync(file));
  return true;
}

module.exports = {
  "/site": {
    target: "http://127.0.0.1:3000",
    secure: false,
    bypass(req, res) {
      if (serveSite(req, res)) {
        return "/__site_served__";
      }
    },
  },
  "/api": {
    target: "http://127.0.0.1:3000",
    secure: false,
    changeOrigin: true,
  },
  "/socket.io": {
    target: "http://127.0.0.1:3000",
    secure: false,
    changeOrigin: true,
    ws: true,
  },
};
