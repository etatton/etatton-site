import { EmailMessage } from "cloudflare:email";

const TO_ADDRESS = "etatton@gmail.com";
const FROM_ADDRESS = "website@etatton.com";
const MAX = { name: 200, email: 320, topic: 100, message: 8000 };

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Strip CR/LF so user input can never inject extra MIME headers. */
const clean = (v, limit) =>
  String(v ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, limit);

/** RFC 2047 encode so non-ASCII names don't corrupt the Subject header. */
const encodeHeader = (s) =>
  /^[\x20-\x7E]*$/.test(s) ? s : `=?UTF-8?B?${btoa(unescape(encodeURIComponent(s)))}?=`;

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  // Honeypot: bots fill hidden fields. Return 200 so they don't retry.
  if (clean(body.company_website, 100)) return json({ ok: true });

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const topic = clean(body.topic, MAX.topic) || "General";
  const message = String(body.message ?? "").trim().slice(0, MAX.message);

  if (!name || !email || !message) {
    return json({ error: "Name, email and message are all required." }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return json({ error: "That email address doesn't look valid." }, 400);
  }

  if (!env.SEND_EMAIL) {
    // Binding not configured — fail loudly so the client falls back to mailto
    // rather than telling the visitor their message was sent when it wasn't.
    console.error("SEND_EMAIL binding is not configured on this Pages project.");
    return json({ error: "Mail transport unavailable." }, 500);
  }

  const submitted = new Date().toUTCString();
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const country = request.cf?.country || "unknown";
  const messageId = `<${crypto.randomUUID()}@etatton.com>`;

  const text = [
    "New enquiry from etatton.com",
    "",
    `Name:    ${name}`,
    `Email:   ${email}`,
    `Topic:   ${topic}`,
    `Sent:    ${submitted}`,
    `Origin:  ${country} (${ip})`,
    "",
    "-----------------------------------------",
    "",
    message,
    "",
  ].join("\r\n");

  const raw = [
    `From: etatton.com <${FROM_ADDRESS}>`,
    `To: <${TO_ADDRESS}>`,
    `Reply-To: ${encodeHeader(name)} <${email}>`,
    `Message-ID: ${messageId}`,
    `Date: ${submitted}`,
    `Subject: ${encodeHeader(`Website enquiry — ${topic} — ${name}`)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="utf-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    text,
  ].join("\r\n");

  try {
    await env.SEND_EMAIL.send(new EmailMessage(FROM_ADDRESS, TO_ADDRESS, raw));
    return json({ ok: true });
  } catch (err) {
    console.error("Contact form send failed:", err?.message || err);
    return json({ error: "Could not send message." }, 502);
  }
}

// Explicit per-method handlers only — a catch-all `onRequest` export would
// take over POST as well and break the form.
export const onRequestGet = () => json({ error: "Method not allowed." }, 405);
export const onRequestPut = () => json({ error: "Method not allowed." }, 405);
export const onRequestDelete = () => json({ error: "Method not allowed." }, 405);
