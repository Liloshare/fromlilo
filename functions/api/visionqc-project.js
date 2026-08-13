function jsonError(error, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

function normalizeProject(value) {
  return String(value || "").trim().replace(/^\/+|\/+$/g, "");
}

export async function onRequestGet(context) {
  const bucket = context.env.VISION_QC_DATA;
  if (!bucket) return jsonError("missing_r2_binding:VISION_QC_DATA", 501);

  const url = new URL(context.request.url);
  const project = normalizeProject(url.searchParams.get("project"));
  if (!project || project.includes("..")) return jsonError("invalid_project");

  const key = `projects/${project}/manifest.json`;
  const object = await bucket.get(key);
  if (!object) return jsonError("project_manifest_not_found", 404);

  let manifest;
  try {
    manifest = JSON.parse(await object.text());
  } catch {
    return jsonError("invalid_manifest_json", 500);
  }

  return Response.json({ ok: true, project, manifest });
}
