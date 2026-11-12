import assert from "node:assert/strict";
import { test } from "node:test";
import { getRecipeFromGroq } from "../src/ai.js";

const ingredients = ["rice", "tomatoes", "beans", "garlic"];
const rateLimitMessage = "Too many recipe requests. Wait a minute and try again.";
const fallbackMessage = "Could not get a recipe. Please try again later.";

test("shows a useful message for Vercel firewall JSON errors", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({
    error: { code: "429", message: "Too Many Requests", id: "test-request" },
  }, { status: 429 }));
  await assert.rejects(getRecipeFromGroq(ingredients), { message: rateLimitMessage });
});

test("handles a non-JSON rate-limit response too", async (context) => {
  context.mock.method(globalThis, "fetch", async () => new Response("Too Many Requests", { status: 429 }));
  await assert.rejects(getRecipeFromGroq(ingredients), { message: rateLimitMessage });
});

test("preserves readable API errors", async (context) => {
  const message = "The recipe service reached its request limit. Wait a little and try again.";
  context.mock.method(globalThis, "fetch", async () => Response.json({ error: message }, { status: 429 }));
  await assert.rejects(getRecipeFromGroq(ingredients), { message });
});

test("does not display objects from other error responses", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({
    error: { message: "Provider details" },
  }, { status: 502 }));
  await assert.rejects(getRecipeFromGroq(ingredients), { message: fallbackMessage });
});

test("handles a null JSON error response", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json(null, { status: 502 }));
  await assert.rejects(getRecipeFromGroq(ingredients), { message: fallbackMessage });
});

test("rejects a successful response without a recipe", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json(null));
  await assert.rejects(getRecipeFromGroq(ingredients), { message: "The recipe service returned no recipe." });
});

test("still returns valid recipe Markdown", async (context) => {
  context.mock.method(globalThis, "fetch", async () => Response.json({ recipe: "# Tomato rice" }));
  assert.equal(await getRecipeFromGroq(ingredients), "# Tomato rice");
});
