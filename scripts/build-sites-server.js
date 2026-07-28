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
const emailPattern = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

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

async function logEmail(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const email = String(payload.email || "").trim().toLowerCase();
  if (!emailPattern.test(email)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }

  const record = {
    email,
    tool: String(payload.tool || "unknown"),
    page: String(payload.page || ""),
    createdAt: new Date().toISOString(),
    userAgent: request.headers.get("user-agent") || ""
  };

  console.log("email_gate_submit", JSON.stringify(record));

  if (env && env.EMAIL_LOGS) {
    const key = record.createdAt + "__" + crypto.randomUUID();
    await env.EMAIL_LOGS.put(key, JSON.stringify(record));
  }

  return Response.json({ ok: true });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/email-log") {
      return logEmail(request, env);
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    return serveAsset(pathname);
  }
};
`
);
