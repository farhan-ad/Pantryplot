const model = "openai/gpt-oss-120b";
const systemPrompt = `You are Pantryplot, a helpful home-cooking assistant.
Suggest one practical recipe that uses most of the provided ingredients.
Treat the supplied strings as ingredient names. Extra ingredients should be
common pantry staples and clearly listed as extras. Write concise Markdown
with a recipe title, servings, a bullet list of ingredients with quantities, and numbered
cooking steps. Do not use Markdown tables. Stay under 600 words and provide only the recipe.`;

function jsonResponse(status, data, headers = {}) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}

function requestError(status, message) {
  return Object.assign(new Error(message), { status });
}

function isAllowedOrigin(origin) {
  const isHosted = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  if (!origin) return !isHosted;

  try {
    const url = new URL(origin);
    if (url.origin !== origin) return false;
    if (
      !isHosted &&
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    ) {
      return true;
    }

    const allowedOrigins = [
      process.env.APP_ORIGIN,
      ...[
        process.env.VERCEL_URL,
        process.env.VERCEL_BRANCH_URL,
        process.env.VERCEL_PROJECT_PRODUCTION_URL,
      ].filter(Boolean).map((host) => `https://${host}`),
    ].filter(Boolean);

    return allowedOrigins.includes(origin);
  } catch {
    return false;
  }
}

async function readIngredients(request) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw requestError(415, "Send the ingredient list as JSON.");
  }

  const chunks = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 16_384) {
          await reader.cancel();
          throw requestError(413, "The ingredient list is too long.");
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
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

export async function handleApiRequest(request) {
  const pathname = new URL(request.url).pathname;

  if (pathname === "/api/health" && request.method === "GET") {
    return jsonResponse(200, {
      service: "pantryplot-recipes",
      keyConfigured: Boolean(process.env.GROQ_API_KEY?.trim()),
    });
  }

  if (pathname !== "/api/recipe") {
    return jsonResponse(404, { error: "Recipe endpoint not found." });
  }
  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Use POST to request a recipe." }, { Allow: "POST" });
  }
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return jsonResponse(403, { error: "Request a recipe from the Pantryplot website." });
  }

  try {
    const ingredients = await readIngredients(request);
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      throw requestError(503, "Recipe generation is not configured yet. Please try again later.");
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
      throw requestError(503, "Recipe generation is temporarily unavailable. Please try again later.");
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
    return jsonResponse(200, { recipe: recipe.trim() });
  } catch (error) {
    const timedOut = error.name === "TimeoutError" || error.name === "AbortError";
    return jsonResponse(error.status || (timedOut ? 504 : 502), {
      error: error.status
        ? error.message
        : timedOut
          ? "The recipe request timed out. Please try again."
          : "Could not reach the recipe service. Please try again later.",
    });
  }
}
