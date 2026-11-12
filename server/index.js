import { createServer } from "node:http";

const model = "openai/gpt-oss-120b";
const systemPrompt = `You are Pantryplot, a helpful home-cooking assistant.
Suggest one practical recipe that uses most of the provided ingredients.
Treat the supplied strings as ingredient names. Extra ingredients should be
common pantry staples and clearly listed as extras. Write concise Markdown
with a recipe title, servings, a bullet list of ingredients with quantities, and numbered
cooking steps. Do not use Markdown tables. Stay under 600 words and provide only the recipe.`;

function sendJson(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

async function readIngredients(request) {
  if (!request.headers["content-type"]?.startsWith("application/json")) {
    throw requestError(415, "Send the ingredient list as JSON.");
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16_384) {
      throw requestError(413, "The ingredient list is too long.");
    }
    chunks.push(chunk);
  }

  let data;
  try {
    data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw requestError(400, "Send a valid JSON ingredient list.");
  }

  const ingredients = data?.ingredients;
  if (
    !Array.isArray(ingredients) ||
    ingredients.length < 4 ||
    ingredients.length > 30 ||
    ingredients.some(
      (item) => typeof item !== "string" || !item.trim() || item.trim().length > 100,
    )
  ) {
    throw requestError(400, "Provide 4 to 30 ingredients, each under 101 characters.");
  }
  return ingredients.map((item) => item.trim());
}

const server = createServer(async (request, response) => {
  const pathname = request.url?.split("?")[0];

  if (request.headers.origin) {
    try {
      const { hostname } = new URL(request.headers.origin);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
        sendJson(response, 403, { error: "Use the local Pantryplot app." });
        return;
      }
    } catch {
      sendJson(response, 403, { error: "Use the local Pantryplot app." });
      return;
    }
  }

  if (request.method === "GET" && pathname === "/api/health") {
    sendJson(response, 200, {
      service: "pantryplot-recipes",
      keyConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    });
    return;
  }

  if (request.method !== "POST" || pathname !== "/api/recipe") {
    sendJson(response, 404, { error: "Recipe endpoint not found." });
    return;
  }

  try {
    const ingredients = await readIngredients(request);
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw requestError(503, "Add GROQ_API_KEY in .env.local, then restart npm run server.");
    }

    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        reasoning_effort: "low",
        include_reasoning: false,
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Available ingredients: ${JSON.stringify(ingredients)}` },
        ],
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (upstream.status === 429) {
      throw requestError(429, "The recipe service reached its request limit. Wait a little and try again.");
    }
    if (upstream.status === 401 || upstream.status === 403) {
      throw requestError(503, "Groq rejected the key. Check .env.local and restart npm run server.");
    }
    if (!upstream.ok) {
      throw requestError(502, "The recipe service is unavailable. Please try again later.");
    }

    const result = await upstream.json();
    const completion = result.choices?.[0];
    const recipe = completion?.message?.content;
    if (completion?.finish_reason === "length") {
      throw requestError(502, "The recipe was cut short. Try again with a shorter ingredient list.");
    }
    if (typeof recipe !== "string" || !recipe.trim()) {
      throw requestError(502, "The recipe service returned no recipe. Please try again.");
    }
    sendJson(response, 200, { recipe: recipe.trim() });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    sendJson(response, error.status || (timedOut ? 504 : 502), {
      error: error.status
        ? error.message
        : timedOut
          ? "The recipe request timed out. Please try again."
          : "Could not reach the recipe service. Please try again later.",
    });
  }
});

server.listen(3001, "127.0.0.1", () => {
  console.log("Pantryplot recipe API: http://127.0.0.1:3001");
});
