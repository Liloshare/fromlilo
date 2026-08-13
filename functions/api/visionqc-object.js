function jsonError(error, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

function normalizeKey(value) {
  return String(value || "").trim().replace(/^\/+/, "");
}

export async function onRequestGet(context) {
  const bucket = context.env.VISION_QC_DATA;
  if (!bucket) return jsonError("missing_r2_binding:VISION_QC_DATA", 501);

  const url = new URL(context.request.url);
  const key = normalizeKey(url.searchParams.get("key"));
  if (!key || key.includes("..")) return jsonError("invalid_key");

  const object = await bucket.get(key);
  if (!object) return jsonError("object_not_found", 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "private, max-age=300");

  return new Response(object.body, { headers });
}
