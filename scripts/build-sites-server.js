import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const serverDir = join(dist, "server");
const hostingDir = join(dist, ".openai");

mkdirSync(serverDir, { recursive: true });
mkdirSync(hostingDir, { recursive: true });
copyFileSync(join(root, ".openai", "hosting.json"), join(hostingDir, "hosting.json"));

function collectFiles(dir, base = "") {
  return Object.fromEntries(
    readdirSync(dir).flatMap((name) => {
      const filePath = join(dir, name);
      const routePath = `${base}/${name}`;
      if (routePath.startsWith("/server") || routePath.startsWith("/.openai")) {
        return [];
      }
      if (statSync(filePath).isDirectory()) {
        return Object.entries(collectFiles(filePath, routePath));
      }
      return [[routePath, readFileSync(filePath, "utf8")]];
    })
  );
}

const files = collectFiles(dist);
files["/"] = files["/index.html"];
for (const [path, body] of Object.entries(files)) {
  if (path.endsWith("/index.html")) {
    files[path.replace(/index\\.html$/, "")] = body;
  }
}

writeFileSync(
  join(serverDir, "index.js"),
  `const files = ${JSON.stringify(files)};

function contentType(pathname) {
  if (pathname.endsWith(".html")) return "text/html; charset=utf-8";
  if (pathname.endsWith(".css")) return "text/css; charset=utf-8";
  if (pathname.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (pathname.endsWith(".json")) return "application/json; charset=utf-8";
  if (pathname.endsWith(".svg")) return "image/svg+xml";
  if (pathname.endsWith(".png")) return "image/png";
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) return "image/jpeg";
  if (pathname.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function serveAsset(pathname) {
  const body = files[pathname] || files["/index.html"];
  if (!body) return new Response("Not found", { status: 404 });
  return new Response(body, {
    headers: {
      "content-type": contentType(pathname),
      "cache-control": pathname.includes("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache"
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    return serveAsset(pathname);
  }
};
`
);
