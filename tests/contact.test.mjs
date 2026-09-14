import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  onRequestPost,
  onRequestGet,
} from '../functions/api/contact.js';

/** Minimal stand-in for a Pages Functions request. */
function postRequest(body, { raw = false } = {}) {
  return new Request('https://etatton.com/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: raw ? body : JSON.stringify(body),
  });
}

/** env.MAILER is a Service binding: an object with a .fetch() returning a Response. */
function mailer(status, text = '') {
  const calls = [];
  return {
    calls,
    binding: {
      fetch: async (url, init) => {
        calls.push({ url, init });
        return new Response(text, { status });
      },
    },
  };
}

const VALID = {
  name: 'Ed Tatton',
  email: 'ed@example.com',
  message: 'Hello there, this is a message.',
};

test('invalid JSON body → 400', async () => {
  const res = await onRequestPost({ request: postRequest('{not json', { raw: true }), env: {} });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'Invalid request body.');
});

test('honeypot filled → 200 ok:true and no mail sent', async () => {
  const m = mailer(200);
  const res = await onRequestPost({
    request: postRequest({ ...VALID, company_website: 'https://spam.example' }),
    env: { MAILER: m.binding },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(m.calls.length, 0, 'honeypot submissions must never reach the mailer');
});

test('missing fields → 400', async () => {
  for (const body of [
    { email: VALID.email, message: VALID.message },
    { name: VALID.name, message: VALID.message },
    { name: VALID.name, email: VALID.email },
    {},
  ]) {
    const res = await onRequestPost({ request: postRequest(body), env: {} });
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).error, 'Name, email and message are all required.');
  }
});

test('bad email → 400', async () => {
  for (const email of ['nope', 'a@b', 'a b@example.com', '@example.com', 'a@example.']) {
    const res = await onRequestPost({ request: postRequest({ ...VALID, email }), env: {} });
    assert.equal(res.status, 400, email);
    assert.equal((await res.json()).error, "That email address doesn't look valid.");
  }
});

test('no env.MAILER → 500', async () => {
  const res = await onRequestPost({ request: postRequest(VALID), env: {} });
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'Mail transport unavailable.');
});

test('MAILER returns 200 → 200 ok:true, and topic defaults to General', async () => {
  const m = mailer(200);
  const res = await onRequestPost({ request: postRequest(VALID), env: { MAILER: m.binding } });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
  assert.equal(m.calls.length, 1);
  const sent = JSON.parse(m.calls[0].init.body);
  assert.equal(sent.name, VALID.name);
  assert.equal(sent.email, VALID.email);
  assert.equal(sent.message, VALID.message);
  assert.equal(sent.topic, 'General', 'the 3-field form sends no topic; the function supplies one');
});

test('MAILER returns 500 → 502', async () => {
  const m = mailer(500, 'upstream exploded');
  const res = await onRequestPost({ request: postRequest(VALID), env: { MAILER: m.binding } });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error, 'Could not send message.');
});

test('GET → 405', async () => {
  const res = await onRequestGet();
  assert.equal(res.status, 405);
  assert.equal((await res.json()).error, 'Method not allowed.');
});

test('CR/LF in name is stripped so headers cannot be injected', async () => {
  const m = mailer(200);
  await onRequestPost({
    request: postRequest({ ...VALID, name: 'Ed\r\nBcc: someone@example.com' }),
    env: { MAILER: m.binding },
  });
  const sent = JSON.parse(m.calls[0].init.body);
  assert.ok(!/[\r\n]/.test(sent.name));
});
