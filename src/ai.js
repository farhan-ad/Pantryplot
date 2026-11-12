// The private provider key is added by the Node API.
export async function getRecipeFromGroq(ingredients) {
  const response = await fetch("/api/recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Could not get a recipe. Please try again later.");
  }
  if (typeof data.recipe !== "string" || !data.recipe.trim()) {
    throw new Error("The recipe service returned no recipe.");
  }
  return data.recipe;
}
