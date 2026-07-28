const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function onRequestPost(context) {
  let payload;

  try {
    payload = await context.request.json();
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
    ip:
      context.request.headers.get("cf-connecting-ip") ||
      context.request.headers.get("x-forwarded-for") ||
      "",
    userAgent: context.request.headers.get("user-agent") || ""
  };

  console.log("email_gate_submit", JSON.stringify(record));

  if (context.env.EMAIL_LOGS) {
    const key = `${record.createdAt}__${crypto.randomUUID()}`;
    await context.env.EMAIL_LOGS.put(key, JSON.stringify(record));
  }

  return Response.json({ ok: true });
}
