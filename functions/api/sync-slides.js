const PAGE_WIDTH_EMU = 9144000;
const PAGE_HEIGHT_EMU = 5143500;
const MAX_IMAGES_PER_REQUEST = 15;

function jsonError(error, status = 400, detail) {
  return Response.json({ ok: false, error, ...(detail ? { detail } : {}) }, { status });
}

function dataUrlToBytes(dataUrl) {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getAccessToken(env) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) throw new Error(`google_token_refresh_failed:${res.status}:${await res.text()}`);
  const json = await res.json();
  return json.access_token;
}

async function ensurePresentation(env, accessToken, projectId) {
  if (env.DB) {
    const row = await env.DB.prepare(
      "SELECT presentation_id FROM slides_projects WHERE project_id = ?"
    ).bind(projectId).first();
    if (row?.presentation_id) return row.presentation_id;
  }

  const createRes = await fetch("https://slides.googleapis.com/v1/presentations", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ title: `Vision QC - ${projectId}` })
  });
  if (!createRes.ok) throw new Error(`slides_create_failed:${createRes.status}:${await createRes.text()}`);
  const presentation = await createRes.json();
  const presentationId = presentation.presentationId;

  if (env.GOOGLE_SLIDES_FOLDER_ID) {
    const metaRes = await fetch(`https://www.googleapis.com/drive/v3/files/${presentationId}?fields=parents`, {
      headers: { authorization: `Bearer ${accessToken}` }
    });
    const meta = metaRes.ok ? await metaRes.json() : {};
    const removeParents = (meta.parents || []).join(",");
    const moveUrl = new URL(`https://www.googleapis.com/drive/v3/files/${presentationId}`);
    moveUrl.searchParams.set("addParents", env.GOOGLE_SLIDES_FOLDER_ID);
    if (removeParents) moveUrl.searchParams.set("removeParents", removeParents);
    moveUrl.searchParams.set("fields", "id,parents");
    await fetch(moveUrl, {
      method: "PATCH",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  }

  const now = new Date().toISOString();
  if (env.DB) {
    await env.DB.prepare(`
      INSERT INTO slides_projects (project_id, presentation_id, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(project_id) DO UPDATE SET
        presentation_id = excluded.presentation_id,
        updated_at = excluded.updated_at
    `).bind(projectId, presentationId, now, now).run();
  }

  return presentationId;
}

async function uploadDriveImage(accessToken, folderId, filename, pngBytes) {
  const boundary = `visionqc_${crypto.randomUUID().replace(/-/g, "")}`;
  const metadata = JSON.stringify({ name: filename, parents: folderId ? [folderId] : undefined });
  const encoder = new TextEncoder();
  const body = new Blob([
    encoder.encode(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    encoder.encode(`--${boundary}\r\ncontent-type: image/png\r\n\r\n`),
    pngBytes,
    encoder.encode(`\r\n--${boundary}--`)
  ]);

  const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": `multipart/related; boundary=${boundary}`
    },
    body
  });
  if (!res.ok) throw new Error(`drive_upload_failed:${res.status}:${await res.text()}`);
  const json = await res.json();
  return json.id;
}

async function makeFilePublic(accessToken, fileId) {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" })
  });
  if (!res.ok) throw new Error(`drive_permission_failed:${res.status}:${await res.text()}`);
}

async function deleteDriveFile(accessToken, fileId) {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${accessToken}` }
    });
  } catch {
    // best-effort cleanup, image bytes are already copied into the slide by now
  }
}

async function batchUpdate(accessToken, presentationId, requests) {
  const res = await fetch(`https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({ requests })
  });
  if (!res.ok) throw new Error(`slides_batch_update_failed:${res.status}:${await res.text()}`);
  return res.json();
}

export async function onRequestPost(context) {
  const env = context.env;
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REFRESH_TOKEN) {
    return jsonError("google_credentials_not_configured", 501);
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch {
    return jsonError("invalid_json");
  }

  const projectId = String(payload.projectId || "").trim();
  const rawImages = Array.isArray(payload.images) ? payload.images : [];
  if (!projectId) return jsonError("missing_project_id");
  if (!rawImages.length) return jsonError("no_images");
  if (rawImages.length > MAX_IMAGES_PER_REQUEST) return jsonError("too_many_images_per_request");

  const items = [];
  for (const raw of rawImages) {
    const imageKey = String(raw.imageKey || "").trim();
    const imageDataUrl = String(raw.imageDataUrl || "");
    if (!imageKey || !imageDataUrl.startsWith("data:image/")) continue;
    items.push({
      imageKey,
      imageFilename: String(raw.imageFilename || imageKey),
      note: String(raw.note || ""),
      issueTypes: Array.isArray(raw.issueTypes) ? raw.issueTypes.map(String) : [],
      bytes: dataUrlToBytes(imageDataUrl)
    });
  }
  if (!items.length) return jsonError("no_valid_images");

  try {
    const accessToken = await getAccessToken(env);
    const presentationId = await ensurePresentation(env, accessToken, projectId);

    const existingSlideIds = new Map();
    if (env.DB) {
      const placeholders = items.map(() => "?").join(",");
      const rows = await env.DB.prepare(
        `SELECT image_key, slide_object_id FROM slides_pages WHERE project_id = ? AND image_key IN (${placeholders})`
      ).bind(projectId, ...items.map(item => item.imageKey)).all();
      for (const row of rows.results || []) existingSlideIds.set(row.image_key, row.slide_object_id);
    }

    const uploadedFileIds = [];
    const preparedItems = [];
    for (const item of items) {
      const fileName = `visionqc_${projectId}_${item.imageKey}`.replace(/[^\w.-]+/g, "_").slice(0, 150) + ".png";
      const fileId = await uploadDriveImage(accessToken, env.GOOGLE_SLIDES_FOLDER_ID, fileName, item.bytes);
      await makeFilePublic(accessToken, fileId);
      uploadedFileIds.push(fileId);
      preparedItems.push({ ...item, fileId, imageUrl: `https://drive.google.com/uc?export=view&id=${fileId}` });
    }

    const requests = [];
    const slideIdByKey = new Map();
    for (const item of preparedItems) {
      const oldSlideId = existingSlideIds.get(item.imageKey);
      if (oldSlideId) requests.push({ deleteObject: { objectId: oldSlideId } });

      const slideId = `s_${crypto.randomUUID().replace(/-/g, "")}`;
      const imageId = `i_${crypto.randomUUID().replace(/-/g, "")}`;
      slideIdByKey.set(item.imageKey, slideId);

      requests.push({
        createSlide: {
          objectId: slideId,
          slideLayoutReference: { predefinedLayout: "BLANK" }
        }
      });
      requests.push({
        createImage: {
          objectId: imageId,
          url: item.imageUrl,
          elementProperties: {
            pageObjectId: slideId,
            size: {
              width: { magnitude: PAGE_WIDTH_EMU, unit: "EMU" },
              height: { magnitude: PAGE_HEIGHT_EMU, unit: "EMU" }
            },
            transform: { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, unit: "EMU" }
          }
        }
      });
    }

    await batchUpdate(accessToken, presentationId, requests);

    const slideIdList = Array.from(slideIdByKey.values());
    const getRes = await fetch(
      `https://slides.googleapis.com/v1/presentations/${presentationId}?fields=slides(objectId,slideProperties.notesPage.notesProperties.speakerNotesObjectId)`,
      { headers: { authorization: `Bearer ${accessToken}` } }
    );
    if (!getRes.ok) throw new Error(`slides_get_failed:${getRes.status}:${await getRes.text()}`);
    const presentationInfo = await getRes.json();

    const notesIdBySlideId = new Map();
    for (const slide of presentationInfo.slides || []) {
      if (!slideIdList.includes(slide.objectId)) continue;
      const notesId = slide.slideProperties?.notesPage?.notesProperties?.speakerNotesObjectId;
      if (notesId) notesIdBySlideId.set(slide.objectId, notesId);
    }

    const notesRequests = [];
    for (const item of preparedItems) {
      const slideId = slideIdByKey.get(item.imageKey);
      const notesId = notesIdBySlideId.get(slideId);
      if (!notesId) continue;
      const noteText = [
        item.imageFilename,
        item.issueTypes.length ? `ISSUE: ${item.issueTypes.join(", ")}` : "",
        item.note ? `NOTE: ${item.note}` : "",
        `SYNCED: ${new Date().toISOString()}`
      ].filter(Boolean).join("\n");
      notesRequests.push({ insertText: { objectId: notesId, text: noteText } });
    }
    if (notesRequests.length) await batchUpdate(accessToken, presentationId, notesRequests);

    if (env.DB) {
      const now = new Date().toISOString();
      for (const item of preparedItems) {
        const slideId = slideIdByKey.get(item.imageKey);
        await env.DB.prepare(`
          INSERT INTO slides_pages (project_id, image_key, slide_object_id, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(project_id, image_key) DO UPDATE SET
            slide_object_id = excluded.slide_object_id,
            updated_at = excluded.updated_at
        `).bind(projectId, item.imageKey, slideId, now).run();
      }
    }

    context.waitUntil(Promise.all(uploadedFileIds.map(fileId => deleteDriveFile(accessToken, fileId))));

    return Response.json({
      ok: true,
      presentationId,
      presentationUrl: `https://docs.google.com/presentation/d/${presentationId}/edit`,
      updated: preparedItems.length
    });
  } catch (error) {
    console.error("sync_slides_error", error?.message || String(error));
    return jsonError("sync_failed", 502, String(error?.message || error));
  }
}
