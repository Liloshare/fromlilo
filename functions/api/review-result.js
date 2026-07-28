const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  let payload;

  try {
    payload = await context.request.json();
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

  if (context.env.DB) {
    await context.env.DB.prepare(`
      INSERT INTO review_results (
        user_email,
        source_type,
        image_key,
        image_filename,
        annotation_filename,
        action,
        note,
        issue_types,
        missing_class,
        box_count,
        status,
        updated_at
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
    `).bind(
      record.userEmail,
      record.sourceType,
      record.imageKey,
      record.imageFilename,
      record.annotationFilename,
      record.action,
      record.note,
      JSON.stringify(record.issueTypes),
      record.missingClass,
      record.boxCount,
      record.status,
      record.updatedAt
    ).run();
  }

  return Response.json({ ok: true });
}
