// The private provider key is added by our local Node server.
export async function getRecipeFromGroq(ingredients) {
  const response = await fetch("/api/recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Start npm run server, then try the recipe again.");
  }
  if (typeof data.recipe !== "string" || !data.recipe.trim()) {
    throw new Error("The recipe service returned no recipe.");
  }
  return data.recipe;
}
