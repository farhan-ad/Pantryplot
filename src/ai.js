// The private provider key is added by the Node API.
export async function getRecipeFromGroq(ingredients) {
  const response = await fetch("/api/recipe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ingredients }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallbackMessage = response.status === 429
      ? "Too many recipe requests. Wait a minute and try again."
      : "Could not get a recipe. Please try again later.";
    const message = typeof data?.error === "string" && data.error.trim()
      ? data.error
      : fallbackMessage;
    throw new Error(message);
  }
  if (typeof data?.recipe !== "string" || !data.recipe.trim()) {
    throw new Error("The recipe service returned no recipe.");
  }
  return data.recipe;
}
