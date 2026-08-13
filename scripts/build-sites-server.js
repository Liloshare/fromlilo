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
    const directoryPath = path.replace(/index\.html$/, "");
    files[directoryPath] = body;
    if (directoryPath.length > 1) {
      files[directoryPath.replace(/\/$/, "")] = body;
    }
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

async function saveReviewResult(request, env) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userEmail = String(payload.userEmail || "").trim().toLowerCase();
  const sourceType = String(payload.sourceType || "").trim();
  const imageKey = String(payload.imageKey || "").trim();
  const imageFilename = String(payload.imageFilename || "").trim();
  const action = String(payload.action || "").trim();

  if (!emailPattern.test(userEmail)) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!["r2", "local"].includes(sourceType) || !imageKey || !imageFilename || !action) {
    return Response.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  const record = {
    userEmail,
    sourceType,
    imageKey,
    imageFilename,
    annotationFilename: String(payload.annotationFilename || ""),
    action,
    note: String(payload.note || ""),
    issueTypes: Array.isArray(payload.issueTypes) ? payload.issueTypes : [],
    missingClass: String(payload.missingClass || ""),
    boxCount: Number.isFinite(Number(payload.boxCount)) ? Number(payload.boxCount) : 0,
    status: String(payload.status || ""),
    updatedAt: new Date().toISOString()
  };

  console.log("review_result_submit", JSON.stringify(record));

  if (env && env.DB) {
    await env.DB.prepare(\`
      INSERT INTO review_results (
        user_email, source_type, image_key, image_filename, annotation_filename,
        action, note, issue_types, missing_class, box_count, status, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_email, source_type, image_key)
      DO UPDATE SET
        image_filename = excluded.image_filename,
        annotation_filename = excluded.annotation_filename,
        action = excluded.action,
        note = excluded.note,
        issue_types = excluded.issue_types,
        missing_class = excluded.missing_class,
        box_count = excluded.box_count,
        status = excluded.status,
        updated_at = excluded.updated_at
    \`).bind(
      record.userEmail, record.sourceType, record.imageKey, record.imageFilename,
      record.annotationFilename, record.action, record.note,
      JSON.stringify(record.issueTypes), record.missingClass, record.boxCount,
      record.status, record.updatedAt
    ).run();
  }

  return Response.json({ ok: true });
}

function jsonError(error, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

function normalizeCloudPath(value) {
  return String(value || "").trim().replace(/^\\/+|\\/+$/g, "");
}

async function loadVisionQcProject(request, env) {
  if (!env || !env.VISION_QC_DATA) return jsonError("missing_r2_binding:VISION_QC_DATA", 501);
  const url = new URL(request.url);
  const project = normalizeCloudPath(url.searchParams.get("project"));
  if (!project || project.includes("..")) return jsonError("invalid_project");

  const key = "projects/" + project + "/manifest.json";
  const object = await env.VISION_QC_DATA.get(key);
  if (!object) return jsonError("project_manifest_not_found", 404);

  let manifest;
  try {
    manifest = JSON.parse(await object.text());
  } catch {
    return jsonError("invalid_manifest_json", 500);
  }

  return Response.json({ ok: true, project, manifest });
}

async function loadVisionQcObject(request, env) {
  if (!env || !env.VISION_QC_DATA) return jsonError("missing_r2_binding:VISION_QC_DATA", 501);
  const url = new URL(request.url);
  const key = normalizeCloudPath(url.searchParams.get("key"));
  if (!key || key.includes("..")) return jsonError("invalid_key");

  const object = await env.VISION_QC_DATA.get(key);
  if (!object) return jsonError("object_not_found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");
  return new Response(object.body, { headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/api/email-log") {
      return logEmail(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/review-result") {
      return saveReviewResult(request, env);
    }
    if (request.method === "GET" && url.pathname === "/api/visionqc-project") {
      return loadVisionQcProject(request, env);
    }
    if (request.method === "GET" && url.pathname === "/api/visionqc-object") {
      return loadVisionQcObject(request, env);
    }
    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    return serveAsset(pathname);
  }
};
`
);
