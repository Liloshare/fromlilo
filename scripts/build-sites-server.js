import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const serverDir = join(dist, "server");
const hostingDir = join(dist, ".openai");

mkdirSync(serverDir, { recursive: true });
mkdirSync(hostingDir, { recursive: true });
copyFileSync(join(root, ".openai", "hosting.json"), join(hostingDir, "hosting.json"));

writeFileSync(
  join(serverDir, "index.js"),
  `import manifest from "__STATIC_CONTENT_MANIFEST";

const assetManifest = JSON.parse(manifest);

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

async function serveAsset(env, pathname) {
  const key = assetManifest[pathname.slice(1)] || assetManifest[pathname];
  if (!key) return null;
  const body = await env.__STATIC_CONTENT.get(key, "arrayBuffer");
  if (!body) return null;
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
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    return (await serveAsset(env, pathname))
      || (await serveAsset(env, "/index.html"))
      || new Response("Not found", { status: 404 });
  }
};
`
);
