import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import api from "../api/index.js";

const envNames = ["GROQ_API_KEY", "NODE_ENV", "VERCEL", "APP_ORIGIN",
  "VERCEL_URL", "VERCEL_BRANCH_URL", "VERCEL_PROJECT_PRODUCTION_URL"];
let savedEnv;
beforeEach(() => {
  savedEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
  for (const name of envNames) delete process.env[name];
  process.env.GROQ_API_KEY = "test-only-key";
});
afterEach(() => {
  for (const name of envNames) {
    if (savedEnv[name] === undefined) delete process.env[name];
    else process.env[name] = savedEnv[name];
  }
});

function request({ ingredients = [" garlic ", "rice", "tomatoes", "beans"],
  origin = "http://localhost:5173", body = JSON.stringify({ ingredients }),
  contentType = "application/json" } = {}) {
  return new Request("https://pantryplot.vercel.app/api/recipe", {
    method: "POST", headers: { "Content-Type": contentType,
      ...(origin === null ? {} : { Origin: origin }) }, body,
  });
}
function provider(context, status = 200, content = "# Rice and beans", finish = "stop") {
  return context.mock.method(globalThis, "fetch", async () => Response.json({
    choices: [{ finish_reason: finish, message: { content } }],
  }, { status }));
}

test("returns recipe Markdown and sends trimmed ingredients only to the provider", async (context) => {
  const upstream = provider(context);
  const response = await api.fetch(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { recipe: "# Rice and beans" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  const [url, options] = upstream.mock.calls[0].arguments;
  assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
  assert.equal(options.headers.Authorization, "Bearer test-only-key");
  const payload = JSON.parse(options.body);
  assert.ok(payload.messages[1].content.includes('["garlic","rice","tomatoes","beans"]'));
  assert.equal(payload.max_completion_tokens, 2048);
});

test("hosted API accepts only configured production, preview, branch and custom origins", async (context) => {
  provider(context);
  process.env.VERCEL = "1";
  process.env.VERCEL_URL = "pantryplot-preview.vercel.app";
  process.env.VERCEL_BRANCH_URL = "pantryplot-git-main.vercel.app";
  process.env.VERCEL_PROJECT_PRODUCTION_URL = "pantryplot.vercel.app";
  process.env.APP_ORIGIN = "https://pantryplot.example";
  for (const origin of ["https://pantryplot.vercel.app", "https://pantryplot-preview.vercel.app",
    "https://pantryplot-git-main.vercel.app", "https://pantryplot.example"]) {
    assert.equal((await api.fetch(request({ origin }))).status, 200, origin);
  }
  for (const origin of ["https://unrelated.vercel.app",
    "https://pantryplot.vercel.app.attacker.example", "http://localhost:5173",
    "null", "not-a-url", null]) {
    assert.equal((await api.fetch(request({ origin }))).status, 403, String(origin));
  }
});

test("local development permits localhost and command-line requests", async (context) => {
  provider(context);
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173", "http://[::1]:5173", null]) {
    assert.equal((await api.fetch(request({ origin }))).status, 200);
  }
  assert.equal((await api.fetch(request({ origin: "https://unrelated.example" }))).status, 403);
});

test("rejects malformed JSON and non-JSON content before contacting the provider", async (context) => {
  const upstream = provider(context);
  assert.equal((await api.fetch(request({ body: "{" }))).status, 400);
  for (const contentType of ["text/plain", "application/json-invalid"]) {
    assert.equal((await api.fetch(request({ contentType }))).status, 415);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("rejects invalid ingredient counts and values", async (context) => {
  const upstream = provider(context);
  for (const ingredients of [[], ["rice", "beans", "salt"], Array(31).fill("rice"),
    ["rice", "beans", "salt", " "], ["rice", "beans", "salt", 12],
    ["rice", "beans", "salt", "a".repeat(101)], null]) {
    assert.equal((await api.fetch(request({ ingredients }))).status, 400);
  }
  assert.equal(upstream.mock.callCount(), 0);
});

test("enforces the body limit for chunked input too", async (context) => {
  const upstream = provider(context);
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode(" ".repeat(8192)));
    controller.enqueue(new TextEncoder().encode(" ".repeat(8193)));
    controller.close();
  } });
  const response = await api.fetch(new Request("http://localhost:3001/api/recipe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body, duplex: "half",
  }));
  assert.equal(response.status, 413);
  assert.equal(upstream.mock.callCount(), 0);
});

test("keeps credential errors out of visitor-facing messages", async (context) => {
  delete process.env.GROQ_API_KEY;
  const missing = await api.fetch(request());
  assert.equal(missing.status, 503);
  assert.doesNotMatch(await missing.text(), /env.local|npm run|test-only-key/);
  process.env.GROQ_API_KEY = "test-only-key";
  provider(context, 401);
  const rejected = await api.fetch(request());
  assert.equal(rejected.status, 503);
  assert.doesNotMatch(await rejected.text(), /env.local|npm run|test-only-key/);
});

test("passes provider rate limits back as a readable error", async (context) => {
  provider(context, 429);
  const response = await api.fetch(request());
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /request limit/);
});

test("handles provider failures without exposing their response", async (context) => {
  provider(context, 500);
  assert.equal((await api.fetch(request())).status, 502);
});

test("handles a timed-out provider request", async (context) => {
  context.mock.method(globalThis, "fetch", async () => {
    throw new DOMException("Test timeout", "TimeoutError");
  });
  const response = await api.fetch(request());
  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /timed out/);
});

test("rejects empty or truncated recipes", async (context) => {
  const upstream = provider(context, 200, " ");
  assert.equal((await api.fetch(request())).status, 502);
  upstream.mock.mockImplementation(async () => Response.json({
    choices: [{ finish_reason: "length", message: { content: "# Unfinished" } }],
  }));
  const response = await api.fetch(request());
  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /cut short/);
});

test("health endpoint reveals configuration status but never the credential", async () => {
  process.env.VERCEL = "1";
  const response = await api.fetch(new Request("https://pantryplot.vercel.app/api/health"));
  assert.deepEqual(await response.json(), { service: "pantryplot-recipes", keyConfigured: true });
});

test("unknown routes and unsupported methods never generate recipes", async (context) => {
  const upstream = provider(context);
  assert.equal((await api.fetch(new Request("http://localhost/api/unknown"))).status, 404);
  const response = await api.fetch(new Request("http://localhost/api/recipe"));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
  assert.equal(upstream.mock.callCount(), 0);
});
